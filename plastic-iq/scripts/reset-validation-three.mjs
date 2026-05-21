#!/usr/bin/env node
/**
 * Full wipe for three validation products — ALL four agents (1–4).
 * Deletes evidence, scoring_inputs, scores, QA. Sets agent_status → unscored.
 *
 * Usage:
 *   node scripts/reset-validation-three.mjs           # dry-run
 *   node scripts/reset-validation-three.mjs --apply
 */
import { createServiceClient } from './agent1/supabase.mjs'

const VALIDATION_PRODUCTS = [
  'Lodge 10.25 Inch Cast Iron Skillet',
  'Branch Basics Multi Purpose Concentrate for Dish Washing',
  'HexClad Hybrid Nonstick 10 Inch Frying Pan',
]

const apply = process.argv.includes('--apply')

async function main() {
  const sb = createServiceClient()
  const { data: products, error } = await sb
    .from('products')
    .select('product_id, product_name, agent_status')
    .in('product_name', VALIDATION_PRODUCTS)

  if (error) throw error
  if (!products?.length) throw new Error('No matching products found')

  console.log(apply ? 'APPLYING full reset (agents 1–4)…\n' : 'DRY RUN (pass --apply to execute)\n')

  for (const p of products) {
    const id = p.product_id

    const { data: qa } = await sb.from('product_qa').select('qa_id').eq('product_id', id)
    const { data: scores } = await sb.from('product_scores').select('score_id').eq('product_id', id)
    const { data: inputs } = await sb.from('scoring_inputs').select('input_id').eq('product_id', id)
    const { data: evidence } = await sb
      .from('product_evidence')
      .select('evidence_id, bundle_version, review_status')
      .eq('product_id', id)

    console.log(`${p.product_name}`)
    console.log(`  current agent_status: ${p.agent_status}`)
    console.log(
      `  will delete: ${evidence?.length ?? 0} evidence, ${inputs?.length ?? 0} inputs, ${scores?.length ?? 0} scores, ${qa?.length ?? 0} QA`,
    )
    console.log(`  after reset: agent_status → unscored (run Agent 1 first in admin)\n`)

    if (!apply) continue

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
      })
      .eq('product_id', id)
    if (pErr) throw pErr
  }

  console.log(
    apply
      ? 'Done. Admin: Agent 1 → approve → Agent 2 → approve → Agent 3 → approve → Agent 4'
      : 'Re-run with --apply to wipe.',
  )
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
