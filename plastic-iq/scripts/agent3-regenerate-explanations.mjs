#!/usr/bin/env node
/**
 * Refresh explanation_draft on approved product_scores using stored scores + component NPRs.
 * Does not recalculate or update PAC score, tier, or other scoring fields.
 *
 *   node scripts/agent3-regenerate-explanations.mjs
 */
import { regenerateExplanationDraft } from './agent3/algorithm.mjs'
import { fetchApprovedEvidence } from './agent2/supabase.mjs'
import { createServiceClient } from './agent1/supabase.mjs'

async function main() {
  const supabase = createServiceClient()

  const { data: scores, error } = await supabase
    .from('product_scores')
    .select(
      'score_id, product_id, input_id, pac_safety_score, tier, displayed_confidence_range, component_nprs, explanation_draft',
    )
    .eq('review_status', 'approved')
    .order('run_timestamp', { ascending: true })

  if (error) throw new Error(`Failed to load approved scores: ${error.message}`)
  if (!scores?.length) {
    console.log('No approved product_scores found.')
    return
  }

  console.log(`Regenerating explanation_draft for ${scores.length} approved score(s)…\n`)

  let updated = 0
  let skipped = 0
  const failures = []

  for (const score of scores) {
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('product_id, product_name, brand')
      .eq('product_id', score.product_id)
      .single()

    if (productError || !product) {
      failures.push({ score_id: score.score_id, reason: productError?.message ?? 'product not found' })
      continue
    }

    let inputs = null
    if (score.input_id) {
      const { data: inputRow, error: inputError } = await supabase
        .from('scoring_inputs')
        .select('inputs')
        .eq('input_id', score.input_id)
        .maybeSingle()
      if (inputError) {
        failures.push({ product: product.product_name, reason: inputError.message })
        continue
      }
      inputs = inputRow?.inputs ?? null
    }

    if (!inputs) {
      const { data: fallback, error: fallbackError } = await supabase
        .from('scoring_inputs')
        .select('inputs')
        .eq('product_id', score.product_id)
        .eq('review_status', 'approved')
        .order('review_timestamp', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (fallbackError) {
        failures.push({ product: product.product_name, reason: fallbackError.message })
        continue
      }
      inputs = fallback?.inputs ?? null
    }

    if (!inputs) {
      failures.push({
        product: product.product_name,
        reason: 'no approved scoring_inputs',
      })
      continue
    }

    const componentResults = score.component_nprs?.components ?? []
    let evidence = null
    try {
      evidence = await fetchApprovedEvidence(supabase, score.product_id)
    } catch {
      /* pathway falls back to normalization use-case fields */
    }
    const explanationDraft = regenerateExplanationDraft({
      inputs,
      componentResults,
      pacScore: score.pac_safety_score,
      tier: score.tier,
      displayedConfidenceRange: score.displayed_confidence_range,
      brand: product.brand,
      evidence,
      ingredientTransparencyScore: score.ingredient_transparency_score,
    })

    if (explanationDraft === score.explanation_draft) {
      skipped++
      console.log(`= ${product.product_name} (unchanged)`)
      continue
    }

    const { error: updateError } = await supabase
      .from('product_scores')
      .update({ explanation_draft: explanationDraft })
      .eq('score_id', score.score_id)

    if (updateError) {
      failures.push({ product: product.product_name, reason: updateError.message })
      continue
    }

    updated++
    console.log(`✓ ${product.product_name} (${score.pac_safety_score} ${score.tier})`)
  }

  console.log(`\nDone: ${updated} updated, ${skipped} unchanged, ${failures.length} failed.`)
  if (failures.length) {
    console.log('\nFailures:')
    for (const f of failures) console.log(`  - ${f.product ?? f.score_id}: ${f.reason}`)
    process.exit(1)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
