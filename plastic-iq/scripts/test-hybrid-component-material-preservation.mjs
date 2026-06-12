#!/usr/bin/env node
/**
 * Hybrid cookware — ceramic nonstick bands apply component-specifically, not product-wide.
 * Run: npm run test:hybrid-component-material-preservation
 */
import assert from 'node:assert/strict'
import { runAgent2NormalizationPipeline } from './agent2/deterministic/pipeline.mjs'
import { prepareAgent3ScoringInputs } from './agent3/prepare-scoring-inputs.mjs'
import { scoreNormalization } from './agent3/algorithm.mjs'
import { buildHexCladGate2V3ApprovedScoringInputs } from './agent3/fixtures/hexclad-gate2-v3.fixture.mjs'
import {
  buildGate1ApprovalEligibilityHexCladV7Evidence,
} from '../src/shared/agent1/fixtures/gate1ApprovalEligibilityHexCladV7.fixture.mjs'
import {
  CERAMIC_LAB_NON_DETECT_MIGRATION,
  CERAMIC_NONSTICK_BASE_HAZARD,
  isKnownProprietaryCeramicNonstickMaterial,
} from '../src/shared/agent2/proprietary-ceramic-nonstick.mjs'
import { escalator1Eligible } from '../src/shared/agent3/escalator-eligibility.mjs'

const HEX_PRODUCT = {
  product_id: 'fixture-hybrid-component-preservation',
  product_name: 'HexClad Hybrid Nonstick 10 Inch Frying Pan',
  brand: 'HexClad',
  subcategory: 'Cookware',
}

const evidence = buildGate1ApprovalEligibilityHexCladV7Evidence()
evidence.review_status = 'approved'
evidence.agent_metadata.certifications_verified = []

const { inputs } = runAgent2NormalizationPipeline(HEX_PRODUCT, evidence)

const terraBond = inputs.components.find((c) =>
  /terrabond|valleys/i.test(`${c.component_name ?? ''} ${c.material ?? ''}`),
)
const peaks = inputs.components.find((c) =>
  /peak|laser.etched/i.test(`${c.component_name ?? ''} ${c.material ?? ''}`),
)
const handle = inputs.components.find((c) => /\bhandle\b/i.test(c.component_name ?? ''))

assert.ok(terraBond, 'TerraBond valley coating component present')
assert.ok(peaks, 'stainless peak component present')
assert.ok(handle, 'handle component present')

assert.equal(peaks.material_id, 'laser_etched_stainless_surface')
assert.equal(terraBond.material_id, 'terrabond_proprietary')

assert.ok(isKnownProprietaryCeramicNonstickMaterial(terraBond.material_id, terraBond, evidence))
assert.equal(
  isKnownProprietaryCeramicNonstickMaterial(peaks.material_id, peaks, evidence),
  false,
  'stainless peaks must not match ceramic nonstick eligibility',
)
assert.equal(
  isKnownProprietaryCeramicNonstickMaterial(handle.material_id, handle, evidence),
  false,
  'handle must not match ceramic nonstick eligibility',
)
console.log('✓ ceramic eligibility is component-specific, not product-wide')

assert.equal(terraBond.material_hazard, CERAMIC_NONSTICK_BASE_HAZARD)
assert.equal(terraBond.adjusted_migration_potential, CERAMIC_LAB_NON_DETECT_MIGRATION)
assert.equal(terraBond.inert_protection_applies, false)
assert.equal(terraBond.ceramic_lab_migration_mitigated, true)
console.log('✓ TerraBond valleys: ceramic hazard 0.35 + lab-mitigated migration 0.22')

assert.equal(peaks.material_hazard, 0.03)
assert.equal(peaks.adjusted_migration_potential, 0.02)
assert.equal(peaks.inert_protection_applies, true)
assert.ok(!/ceramic nonstick sol-gel/i.test(peaks.material_hazard_table_entry ?? ''))
console.log('✓ stainless peaks: inert stainless 0.03/0.02 with inert protection')

assert.equal(handle.material_hazard, 0.03)
assert.equal(handle.adjusted_migration_potential, 0.02)
assert.equal(handle.inert_protection_applies, true)
console.log('✓ handle unchanged (stainless inert)')

const prepared = prepareAgent3ScoringInputs(inputs, evidence)
const preparedPeaks = prepared.components.find((c) =>
  /peak|laser.etched/i.test(`${c.component_name ?? ''} ${c.material ?? ''}`),
)
const preparedTerra = prepared.components.find((c) =>
  /terrabond|valleys/i.test(`${c.component_name ?? ''} ${c.material ?? ''}`),
)
assert.equal(preparedTerra.material_hazard, 0.35)
assert.equal(preparedTerra.adjusted_migration_potential, 0.22)
assert.equal(preparedPeaks.material_hazard, 0.03)
assert.equal(preparedPeaks.adjusted_migration_potential, 0.02)
assert.equal(preparedPeaks.inert_protection_applies, true)
assert.equal(preparedPeaks.ceramic_lab_migration_mitigated, undefined)
console.log('✓ prepareAgent3ScoringInputs preserves per-component material identity')

assert.equal(prepared.layer_4a?.net_adjustment, -3)
assert.equal(prepared.layer_4a?.unknown_coating_cap_applies, false)
assert.ok(
  prepared.layer_4a?.negative_adjustments?.some((n) =>
    /proprietary food-contact coating chemistry undisclosed/i.test(n.reason),
  ),
)
console.log('✓ Layer 4A remains -3 proprietary chemistry undisclosed')

assert.equal(escalator1Eligible(preparedTerra, prepared, evidence), false)
const result = scoreNormalization(prepared, { agent2Layer4b: inputs.layer_4b, evidence })
assert.equal(result.escalator_applied, null)
assert.equal(result.transparency_badge, 'Documentation Incomplete')
console.log('✓ PFAS/PTFE escalator remains blocked')

const { inputs: fixtureInputs, evidence: fixtureEvidence } = buildHexCladGate2V3ApprovedScoringInputs()
const fixturePrepared = prepareAgent3ScoringInputs(fixtureInputs, fixtureEvidence)
const fixtureResult = scoreNormalization(fixturePrepared, {
  agent2Layer4b: fixtureInputs.layer_4b,
  evidence: fixtureEvidence,
})

assert.ok(fixtureResult.pac_safety_score > 70, 'corrected score above bad 70 run')
assert.ok(fixtureResult.pac_safety_score > 66, 'corrected score above Caraway 66')
assert.ok(fixtureResult.pac_safety_score >= 75 && fixtureResult.pac_safety_score <= 82)
assert.equal(fixtureResult.tier, 'Good')
assert.equal(fixtureResult.layer_4a_net, -3)

console.log('\n--- Corrected HexClad expected score (in-memory) ---')
for (const c of fixtureResult.component_nprs.components) {
  console.log(
    `${c.component_name}: NPR ${c.final_npr.toFixed(3)} (hazard ${c.material_hazard}, migration ${c.adjusted_migration_potential}, inert ${c.inert_protection_applied})`,
  )
}
console.log(`weighted NPR: ${fixtureResult.weighted_npr.toFixed(4)}`)
console.log(`raw before Layer 4A: ${fixtureResult.calculation.raw_score.toFixed(2)}`)
console.log(`Layer 4A: ${fixtureResult.layer_4a_net}`)
console.log(`final: ${fixtureResult.pac_safety_score} (${fixtureResult.tier})`)
console.log(`confidence: ${fixtureResult.displayed_confidence_range}`)

console.log('\nAll hybrid component material preservation tests passed.')
