#!/usr/bin/env node
/**
 * Berglander: In Testing Queue (tier-change unknown bristle material).
 * Does not re-run Agent 2.
 */
import { createServiceClient } from './agent2/supabase.mjs'

const BERGLANDER_ID = '656eb9ab-ea52-4eca-bd44-4903d6b2d00e'
const INPUT_ID = '5e938506-3f77-4433-b4b0-8aeb29a9dc82'

const TESTING_QUEUE_REASON =
  'Basting brush bristle material unconfirmed. Material could be nylon food contact (hazard 0.68, likely High Risk tier) or silicone food grade (hazard 0.15, likely Excellent tier). Tier outcome changes dramatically based on confirmation. Cannot score until bristle material is confirmed via manufacturer inquiry or product inspection.'

const TIER_NOTES_APPEND =
  '\n\n7. UNKNOWN BRISTLE MATERIAL — TIER-CHANGE RULE (In Testing Queue): Primary food-contact bristles are undisclosed. Plausible materials span different tiers: nylon polyamide food contact (hazard 0.68, High Risk tier likely) vs food-grade silicone verified (hazard 0.15, Excellent tier likely). Tier outcome would change dramatically if confirmed. score_basis set to In Testing Queue; product held from Agent 3 until bristle material is confirmed via manufacturer inquiry or product inspection. This is Scenario A (tier would change) — NOT Scenario B (same tier regardless).'

async function main() {
  const supabase = createServiceClient()

  const { data: row, error: fetchErr } = await supabase
    .from('scoring_inputs')
    .select('inputs')
    .eq('input_id', INPUT_ID)
    .single()

  if (fetchErr) throw fetchErr

  const inputs = { ...(row.inputs ?? {}) }
  inputs.score_basis = 'In Testing Queue'
  inputs.human_review_required = true
  inputs.human_review_reason = TESTING_QUEUE_REASON
  const prior = inputs.normalization_notes ?? ''
  if (!prior.includes('TIER-CHANGE RULE (In Testing Queue)')) {
    inputs.normalization_notes = prior + TIER_NOTES_APPEND
  }

  const { error: inputError } = await supabase
    .from('scoring_inputs')
    .update({
      inputs,
      human_review_required: true,
      human_review_reason: TESTING_QUEUE_REASON,
      review_status: 'submitted',
    })
    .eq('input_id', INPUT_ID)

  if (inputError) throw inputError

  const { error: productError } = await supabase
    .from('products')
    .update({
      agent_status: 'in_testing_queue',
      score_basis: 'In Testing Queue',
      testing_queue_reason: TESTING_QUEUE_REASON,
    })
    .eq('product_id', BERGLANDER_ID)

  if (productError) throw productError

  console.log('Berglander → in_testing_queue')
  console.log('  score_basis: In Testing Queue')
  console.log('  scoring_inputs:', INPUT_ID, '(submitted, not approved)')
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
