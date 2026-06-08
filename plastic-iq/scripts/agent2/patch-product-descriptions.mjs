#!/usr/bin/env node
/**
 * Optional CLI — recompute product_description on stored scoring_inputs without Agent 1.
 * Normal workflow: re-run Agent 2 from Admin → Run Agent 2 (or Re-run on Awaiting review).
 *
 *   node scripts/agent2/patch-product-descriptions.mjs
 *   node scripts/agent2/patch-product-descriptions.mjs --apply
 */
import { createServiceClient } from '../agent1/supabase.mjs'
import { fetchApprovedEvidence } from './supabase.mjs'
import { buildWhyThisScoreOptions } from './why-this-score-map.mjs'
import { runProductDescriptionStep } from './deterministic/product-description-generate.mjs'

const VALIDATION_NAMES = [
  'Lodge 10.25 Inch Cast Iron Skillet',
  'HexClad Hybrid Nonstick 10 Inch Frying Pan',
  'T-Fal Ultimate Hard Anodized Nonstick Fry Pan Set 3 Piece',
]

const apply = process.argv.includes('--apply')
const allApproved = process.argv.includes('--all-approved')

async function scoringInputsForProduct(sb, productId) {
  const { data, error } = await sb
    .from('scoring_inputs')
    .select('input_id, product_id, inputs, review_status, run_timestamp')
    .eq('product_id', productId)
    .eq('review_status', 'approved')
    .order('review_timestamp', { ascending: false })
  if (error) throw error
  return data ?? []
}

async function patchRow(sb, product, row) {
  const inputs = row.inputs ?? {}
  const evidence = await fetchApprovedEvidence(sb, product.product_id)
  const whyThisScore = buildWhyThisScoreOptions(evidence, inputs)
  const descResult = runProductDescriptionStep({
    product,
    evidence,
    inputs,
    whyThisScore,
  })

  const before = String(inputs.product_description ?? '').trim()
  const nextInputs = { ...inputs }

  if (nextInputs.status === 'description_generation_failed') {
    delete nextInputs.status
  }
  nextInputs.product_description = descResult.product_description ?? null
  nextInputs.product_description_status = descResult.product_description_status
  nextInputs.product_description_warnings = descResult.product_description_warnings ?? []
  if (descResult.description_word_count != null) {
    nextInputs.description_word_count = descResult.description_word_count
  }
  if (descResult.flagged_missing_fields?.length) {
    nextInputs.flagged_missing_fields = descResult.flagged_missing_fields
  } else {
    delete nextInputs.flagged_missing_fields
  }

  const after = String(nextInputs.product_description ?? '').trim()
  console.log(`\n${product.product_name} (${row.review_status})`)
  console.log(`  input_id: ${row.input_id}`)
  if (before === after) {
    console.log('  → unchanged')
  } else {
    console.log(`  before: ${before.slice(0, 100)}${before.length > 100 ? '…' : ''}`)
    console.log(`  after:  ${after.slice(0, 100)}${after.length > 100 ? '…' : ''}`)
  }

  if (apply && before !== after) {
    const { error } = await sb
      .from('scoring_inputs')
      .update({ inputs: nextInputs })
      .eq('input_id', row.input_id)
    if (error) throw error
    console.log('  → saved')
  }

  const ok = descResult.product_description_status === 'generated'
  return { ok, changed: before !== after }
}

async function main() {
  const sb = createServiceClient()

  let products
  if (allApproved) {
    const { data: scores, error } = await sb
      .from('scoring_inputs')
      .select('product_id')
      .eq('review_status', 'approved')
    if (error) throw error
    const ids = [...new Set((scores ?? []).map((r) => r.product_id))]
    const { data, error: pErr } = await sb
      .from('products')
      .select('product_id, product_name, brand, active')
      .in('product_id', ids)
      .eq('active', true)
    if (pErr) throw pErr
    products = data ?? []
  } else {
    const { data, error } = await sb
      .from('products')
      .select('product_id, product_name, brand, active')
      .in('product_name', VALIDATION_NAMES)
    if (error) throw error
    products = data ?? []
  }

  console.log(
    apply
      ? `APPLY — patching product_description on ${products.length} product(s)\n`
      : `DRY RUN — pass --apply to write\n`,
  )

  let changed = 0
  let failed = 0
  for (const product of products) {
    const rows = await scoringInputsForProduct(sb, product.product_id)
    if (!rows.length) {
      console.log(`\n${product.product_name}: no scoring_inputs — skip`)
      continue
    }
    for (const row of rows) {
      if (!row?.inputs) continue
      const result = await patchRow(sb, product, row)
      if (!result.ok) failed++
      if (result.changed) changed++
    }
  }

  console.log(`\nDone. ${changed} description(s) ${apply ? 'updated' : 'would change'}.${failed ? ` ${failed} failed generation.` : ''}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
