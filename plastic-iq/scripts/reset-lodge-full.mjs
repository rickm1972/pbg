#!/usr/bin/env node
/**
 * Full pipeline wipe for Lodge only — Agents 1–4 (fresh start).
 * Deletes evidence, scoring_inputs, scores, QA. Sets agent_status → unscored.
 *
 * Usage:
 *   npm run reset:lodge           # dry-run
 *   npm run reset:lodge -- --apply
 */
import { createServiceClient } from './agent1/supabase.mjs'

const LODGE_NAME = 'Lodge 10.25 Inch Cast Iron Skillet'
const apply = process.argv.includes('--apply')

async function main() {
  const sb = createServiceClient()
  const { data: product, error } = await sb
    .from('products')
    .select('product_id, product_name, agent_status')
    .eq('product_name', LODGE_NAME)
    .maybeSingle()

  if (error) throw error
  if (!product) throw new Error(`Product not found: ${LODGE_NAME}`)

  const id = product.product_id

  const { data: qa } = await sb.from('product_qa').select('qa_id').eq('product_id', id)
  const { data: scores } = await sb.from('product_scores').select('score_id').eq('product_id', id)
  const { data: inputs } = await sb.from('scoring_inputs').select('input_id').eq('product_id', id)
  const { data: evidence } = await sb
    .from('product_evidence')
    .select('evidence_id')
    .eq('product_id', id)

  console.log(apply ? 'APPLYING full Lodge reset (agents 1–4)…\n' : 'DRY RUN (pass --apply to execute)\n')
  console.log(product.product_name)
  console.log(`  product_id: ${id}`)
  console.log(`  current agent_status: ${product.agent_status}`)
  console.log(
    `  will delete: ${evidence?.length ?? 0} evidence, ${inputs?.length ?? 0} scoring_inputs, ${scores?.length ?? 0} scores, ${qa?.length ?? 0} QA`,
  )
  console.log('  will clear: pac_safety_score, tier, score_basis, active_evidence_id')
  console.log('  after reset: agent_status → unscored\n')

  if (!apply) {
    console.log('Then: Admin → Agent 1 → Run Agent 1 → check Lodge → Run Agent 1.')
    return
  }

  if (qa?.length) {
    const { error: qErr } = await sb.from('product_qa').delete().eq('product_id', id)
    if (qErr) throw qErr
  }
  if (scores?.length) {
    const { error: sErr } = await sb.from('product_scores').delete().eq('product_id', id)
    if (sErr) throw sErr
  }
  if (inputs?.length) {
    const { error: iErr } = await sb.from('scoring_inputs').delete().eq('product_id', id)
    if (iErr) throw iErr
  }
  if (evidence?.length) {
    const { error: eErr } = await sb.from('product_evidence').delete().eq('product_id', id)
    if (eErr) throw eErr
  }

  const { error: pErr } = await sb
    .from('products')
    .update({
      agent_status: 'unscored',
      pac_safety_score: null,
      tier: null,
      score_basis: null,
      active_evidence_id: null,
    })
    .eq('product_id', id)
  if (pErr) throw pErr

  console.log('Done. Lodge is unscored with no pipeline artifacts — run Agent 1 in admin.')
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
