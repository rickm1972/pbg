#!/usr/bin/env node
/**
 * Reset Agent 2 only for Lodge, HexClad, T-Fal — does NOT run Agent 2.
 * Deletes scoring_inputs, product_scores, product_qa; sets agent_status → evidence_approved.
 *
 * Usage:
 *   npm run agent2:reset-three              # dry-run (preview)
 *   npm run agent2:reset-three -- --apply   # delete + reset status
 *
 * Then YOU run Agent 2 (Admin Run tab, or):
 *   npm run agent2 -- --name "Lodge 10.25 Inch Cast Iron Skillet"
 *   npm run agent2 -- --name "HexClad Hybrid Nonstick 10 Inch Frying Pan"
 *   npm run agent2 -- --name "T-Fal Ultimate Hard Anodized Nonstick Fry Pan Set 3 Piece"
 */
import { createServiceClient } from './agent1/supabase.mjs'

const PRODUCT_NAMES = [
  'Lodge 10.25 Inch Cast Iron Skillet',
  'HexClad Hybrid Nonstick 10 Inch Frying Pan',
  'T-Fal Ultimate Hard Anodized Nonstick Fry Pan Set 3 Piece',
]

const apply = process.argv.includes('--apply')

async function resetAgent2ForProduct(sb, product) {
  const id = product.product_id
  const { data: qa } = await sb.from('product_qa').select('qa_id').eq('product_id', id)
  const { data: scores } = await sb.from('product_scores').select('score_id').eq('product_id', id)
  const { data: inputs } = await sb.from('scoring_inputs').select('input_id').eq('product_id', id)

  const deleted = {
    scoring_inputs: inputs?.length ?? 0,
    product_scores: scores?.length ?? 0,
    product_qa: qa?.length ?? 0,
  }

  if (qa?.length) await sb.from('product_qa').delete().eq('product_id', id)
  if (scores?.length) await sb.from('product_scores').delete().eq('product_id', id)
  if (inputs?.length) await sb.from('scoring_inputs').delete().eq('product_id', id)

  await sb
    .from('products')
    .update({ agent_status: 'evidence_approved' })
    .eq('product_id', id)

  return deleted
}

async function main() {
  const sb = createServiceClient()
  const { data: products, error } = await sb
    .from('products')
    .select('product_id, product_name, agent_status')
    .in('product_name', PRODUCT_NAMES)

  if (error) throw error
  if (!products?.length) throw new Error('No matching products found')

  const missing = PRODUCT_NAMES.filter((n) => !products.some((p) => p.product_name === n))
  if (missing.length) throw new Error(`Products not in DB: ${missing.join('; ')}`)

  console.log(
    apply
      ? 'APPLY — deleting Agent 2/3/4 rows only (will NOT run Agent 2)\n'
      : 'DRY RUN — pass --apply to delete\n',
  )

  for (const name of PRODUCT_NAMES) {
    const product = products.find((p) => p.product_name === name)
    if (!product) continue
    console.log(`${product.product_name}`)
    console.log(`  id: ${product.product_id}`)
    console.log(`  status now: ${product.agent_status}`)
    if (!apply) {
      console.log('  → will delete scoring_inputs, product_scores, product_qa')
      console.log('  → will set agent_status → evidence_approved\n')
      continue
    }

    const deleted = await resetAgent2ForProduct(sb, product)
    console.log(
      `  deleted: ${deleted.scoring_inputs} scoring_inputs, ${deleted.product_scores} scores, ${deleted.product_qa} QA`,
    )
    console.log('  agent_status → evidence_approved\n')
  }

  console.log(
    apply
      ? 'Done. Run Agent 2 yourself (Admin → Agent 2 → Run, or npm run agent2 -- --name "...").'
      : 'Re-run with: npm run agent2:reset-three -- --apply',
  )
}

main().catch((err) => {
  console.error(err.message ?? err)
  process.exit(1)
})
