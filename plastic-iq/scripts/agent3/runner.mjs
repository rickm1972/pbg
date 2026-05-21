import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { projectRoot } from '../lib/env.mjs'
import { ALGORITHM_VERSION, formatCalculationTrace, scoreNormalization } from './algorithm.mjs'
import {
  createServiceClient,
  fetchApprovedScoringInputs,
  fetchProductById,
  fetchProductByName,
  insertProductScore,
  updateAgentStatus,
} from './supabase.mjs'

const CAN_RUN_STATUSES = new Set([
  'normalization_approved',
  'scoring_review_pending',
  'scoring_approved',
])

export async function runAgent3({ productId, productName, dryRun = false }) {
  const supabase = createServiceClient()
  const product = productId
    ? await fetchProductById(supabase, productId)
    : await fetchProductByName(supabase, productName)

  const id = product.product_id
  console.log(`\n=== Agent 3: ${product.product_name} (${id}) ===\n`)

  if (!CAN_RUN_STATUSES.has(product.agent_status)) {
    const reason = `Agent 3 requires normalization_approved, scoring_review_pending, or scoring_approved (current: ${product.agent_status})`
    console.log(`Stopped: ${reason}`)
    return { ok: false, product, reason }
  }

  if (!dryRun) {
    await updateAgentStatus(supabase, id, 'scoring_in_progress')
    console.log('Step 1: agent_status → scoring_in_progress')
  } else {
    console.log('Step 1: (dry run) skip status update')
  }

  const scoringInput = await fetchApprovedScoringInputs(supabase, id)
  console.log(
    `Step 2: loaded approved normalization (${scoringInput.input_id}, v${scoringInput.algorithm_version})`,
  )

  const inputs = scoringInput.inputs
  console.log(`Step 3–14: running V2.3.4 algorithm on ${inputs.components?.length ?? 0} components…`)

  const result = scoreNormalization(inputs, { brand: product.brand })

  if (result.pac_safety_score !== 99 && product.product_name.includes('Lodge') && product.product_name.includes('Cast Iron')) {
    console.log('\n*** CALIBRATION FAILED — Lodge must score exactly 99 ***\n')
    console.log(formatCalculationTrace(result))
    if (!dryRun) {
      await updateAgentStatus(supabase, id, 'normalization_approved')
    }
    return {
      ok: false,
      product,
      reason: `Lodge calibration failed: expected score 99, got ${result.pac_safety_score}`,
      scoringInput,
      result,
    }
  }

  console.log(formatCalculationTrace(result))
  console.log(`\nPAC Safety Score: ${result.pac_safety_score} (${result.tier})`)
  console.log(`Displayed range: ${result.displayed_confidence_range}`)
  console.log(`Transparency: ${result.transparency_badge}`)

  if (dryRun) {
    return { ok: true, product, scoringInput, result, dryRun: true }
  }

  const scoreRow = await insertProductScore(supabase, {
    product_id: id,
    input_id: scoringInput.input_id,
    pac_safety_score: result.pac_safety_score,
    tier: result.tier,
    displayed_confidence_range: result.displayed_confidence_range,
    transparency_badge: result.transparency_badge,
    weighted_npr: result.weighted_npr,
    component_nprs: result.component_nprs,
    escalator_applied: result.escalator_applied,
    layer_4a_net: result.layer_4a_net,
    ingredient_transparency_score: result.ingredient_transparency_score,
    explanation_draft: result.explanation_draft,
    algorithm_version: ALGORITHM_VERSION,
    review_status: 'pending_review',
  })

  console.log(`Step 14: saved product_scores (${scoreRow.score_id})`)

  await updateAgentStatus(supabase, id, 'scoring_review_pending')
  console.log('Step 14: agent_status → scoring_review_pending')

  const outDir = join(projectRoot, 'scripts/output')
  mkdirSync(outDir, { recursive: true })
  const outPath = join(outDir, `agent3-${id}.json`)
  writeFileSync(
    outPath,
    JSON.stringify({ product, scoringInput, result, scoreRow }, null, 2),
    'utf8',
  )
  console.log(`  output: ${outPath}`)

  return { ok: true, product, scoringInput, result, scoreRow }
}

export function formatScoringSummary(run) {
  if (!run.ok) {
    return `Agent 3 stopped: ${run.reason ?? 'unknown error'}`
  }
  const r = run.result
  return [
    `Product: ${run.product.product_name}`,
    `PAC Safety Score: ${r.pac_safety_score} (${r.tier})`,
    `Range: ${r.displayed_confidence_range}`,
    `Transparency: ${r.transparency_badge}`,
    `Weighted NPR: ${r.weighted_npr}`,
    `Layer 4A net: ${r.layer_4a_net}`,
    r.ingredient_transparency_score != null
      ? `ITS: ${r.ingredient_transparency_score}`
      : 'ITS: n/a',
  ].join('\n')
}
