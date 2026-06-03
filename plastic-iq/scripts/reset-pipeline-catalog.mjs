#!/usr/bin/env node
/**
 * Full wipe for every **active** pipeline product — agents 1–4.
 * Deletes evidence, scoring_inputs, scores, QA. Sets agent_status → unscored.
 *
 * After apply: only Agent 1 Run tab shows products until you approve and advance.
 *
 * Usage:
 *   node scripts/reset-pipeline-catalog.mjs              # dry-run
 *   node scripts/reset-pipeline-catalog.mjs --apply
 *   node scripts/reset-pipeline-catalog.mjs --apply --subcategory "Frying Pans"
 */
import { createServiceClient } from './agent1/supabase.mjs'

const apply = process.argv.includes('--apply')
const subcategoryIdx = process.argv.indexOf('--subcategory')
const subcategoryFilter =
  subcategoryIdx >= 0 ? process.argv[subcategoryIdx + 1]?.trim() : null

async function resetProduct(sb, p) {
  const id = p.product_id

  const { data: qa } = await sb.from('product_qa').select('qa_id').eq('product_id', id)
  const { data: scores } = await sb.from('product_scores').select('score_id').eq('product_id', id)
  const { data: inputs } = await sb.from('scoring_inputs').select('input_id').eq('product_id', id)
  const { data: evidence } = await sb
    .from('product_evidence')
    .select('evidence_id')
    .eq('product_id', id)

  console.log(`${p.product_name}${p.subcategory ? ` · ${p.subcategory}` : ''}`)
  console.log(`  was: ${p.agent_status}`)
  console.log(
    `  delete: ${evidence?.length ?? 0} evidence, ${inputs?.length ?? 0} inputs, ${scores?.length ?? 0} scores, ${qa?.length ?? 0} QA → unscored`,
  )

  if (!apply) return

  if (qa?.length) {
    const { error } = await sb.from('product_qa').delete().eq('product_id', id)
    if (error) throw error
  }
  if (scores?.length) {
    const { error } = await sb.from('product_scores').delete().eq('product_id', id)
    if (error) throw error
  }
  if (inputs?.length) {
    const { error } = await sb.from('scoring_inputs').delete().eq('product_id', id)
    if (error) throw error
  }
  if (evidence?.length) {
    const { error } = await sb.from('product_evidence').delete().eq('product_id', id)
    if (error) throw error
  }

  const { error: pErr } = await sb
    .from('products')
    .update({
      agent_status: 'unscored',
      pac_safety_score: null,
      tier: null,
      score_basis: null,
      testing_queue_reason: null,
    })
    .eq('product_id', id)
  if (pErr) throw pErr
}

async function main() {
  const sb = createServiceClient()
  let query = sb
    .from('products')
    .select('product_id, product_name, subcategory, agent_status')
    .eq('active', true)
    .order('product_name')

  if (subcategoryFilter) {
    query = query.eq('subcategory', subcategoryFilter)
  }

  const { data: products, error } = await query
  if (error) throw error
  if (!products?.length) {
    throw new Error(
      subcategoryFilter
        ? `No active products for subcategory "${subcategoryFilter}"`
        : 'No active pipeline products found',
    )
  }

  console.log(
    apply ? 'APPLYING pipeline catalog reset…\n' : 'DRY RUN (pass --apply to execute)\n',
  )
  if (subcategoryFilter) {
    console.log(`Filter: subcategory = "${subcategoryFilter}" (${products.length} products)\n`)
  } else {
    console.log(`${products.length} active catalog products\n`)
  }

  for (const p of products) {
    await resetProduct(sb, p)
    console.log('')
  }

  console.log(
    apply
      ? 'Done. Refresh Admin → Agent 1 Run tab. Agents 2–4 Run tabs stay empty until you approve each step.'
      : 'Pass --apply to reset. Optional: --subcategory "Frying Pans"',
  )
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
