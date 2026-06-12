#!/usr/bin/env node
/**
 * Known proprietary ceramic nonstick uses ceramic sol-gel base bands + lab migration mitigation.
 * Run: npm run test:proprietary-ceramic-risk-band
 */
import assert from 'node:assert/strict'
import { runAgent2NormalizationPipeline } from './agent2/deterministic/pipeline.mjs'
import { prepareAgent3ScoringInputs } from './agent3/prepare-scoring-inputs.mjs'
import { scoreNormalization } from './agent3/algorithm.mjs'
import {
  buildGate1ApprovalEligibilityHexCladV7Evidence,
} from '../src/shared/agent1/fixtures/gate1ApprovalEligibilityHexCladV7.fixture.mjs'
import {
  CERAMIC_LAB_NON_DETECT_MIGRATION,
  CERAMIC_NONSTICK_BASE_HAZARD,
  CERAMIC_NONSTICK_BASE_MIGRATION,
  isKnownProprietaryCeramicNonstickMaterial,
  isTrulyUnknownProprietaryCoatingMaterial,
  qualifiesCeramicLabNonDetectMitigation,
} from '../src/shared/agent2/proprietary-ceramic-nonstick.mjs'

const HEX_PRODUCT = {
  product_id: 'fixture-hexclad-ceramic-band',
  product_name: 'HexClad Hybrid Nonstick 10 Inch Frying Pan',
  brand: 'HexClad',
  subcategory: 'Cookware',
}

const evidence = buildGate1ApprovalEligibilityHexCladV7Evidence()
evidence.review_status = 'approved'
evidence.agent_metadata.certifications_verified = []

const { inputs } = runAgent2NormalizationPipeline(HEX_PRODUCT, evidence)
const terraBond = inputs.components.find((c) => /terrabond|valleys/i.test(`${c.component_name} ${c.material}`))
const peaks = inputs.components.find((c) => /peak|laser.etched/i.test(`${c.component_name} ${c.material}`))
assert.ok(terraBond)
assert.equal(terraBond.material_hazard, CERAMIC_NONSTICK_BASE_HAZARD)
assert.equal(terraBond.adjusted_migration_potential, CERAMIC_LAB_NON_DETECT_MIGRATION)
assert.equal(terraBond.ceramic_lab_migration_mitigated, true)
console.log('✓ HexClad-like pipeline: ceramic base hazard + lab-mitigated migration')

if (peaks) {
  assert.equal(peaks.material_hazard, 0.03)
  assert.equal(peaks.adjusted_migration_potential, 0.02)
  assert.equal(peaks.inert_protection_applies, true)
  assert.equal(isKnownProprietaryCeramicNonstickMaterial(peaks.material_id, peaks, evidence), false)
  console.log('✓ stainless peaks preserve inert bands — not remapped to ceramic')
}

assert.equal(inputs.layer_4a?.unknown_coating_cap_applies, false)
assert.ok(
  inputs.layer_4a?.negative_adjustments?.some((n) =>
    /proprietary food-contact coating chemistry undisclosed/i.test(n.reason),
  ),
)
console.log('✓ proprietary chemistry Layer 4A -3 without unknown coating cap')

assert.ok(isKnownProprietaryCeramicNonstickMaterial('terrabond_proprietary', terraBond, evidence))
assert.equal(isTrulyUnknownProprietaryCoatingMaterial('terrabond_proprietary', terraBond, evidence), false)
console.log('✓ terrabond_proprietary is known ceramic, not mystery coating')

const prepared = prepareAgent3ScoringInputs(inputs, evidence)
const result = scoreNormalization(prepared, { agent2Layer4b: inputs.layer_4b, evidence })
assert.equal(result.escalator_applied, null)
assert.ok(result.pac_safety_score > 70, 'corrected score above bad 70 run with double ceramic NPR')
assert.ok(result.pac_safety_score > 66)
assert.ok(result.pac_safety_score >= 75 && result.pac_safety_score <= 82)
assert.equal(result.transparency_badge, 'Documentation Incomplete')
console.log(`✓ HexClad-like corrected score ${result.pac_safety_score} above Caraway 66`)

assert.equal(qualifiesCeramicLabNonDetectMitigation(inputs.testing_evidence), true)
assert.equal(CERAMIC_NONSTICK_BASE_MIGRATION, 0.38)
assert.equal(CERAMIC_LAB_NON_DETECT_MIGRATION, 0.22)
console.log('✓ lab mitigation 0.38 → 0.22 migration only')

console.log('\nAll proprietary ceramic risk-band tests passed.')
