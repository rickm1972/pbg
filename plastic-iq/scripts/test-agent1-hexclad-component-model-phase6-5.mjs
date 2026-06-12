#!/usr/bin/env node
/**
 * Phase 6.5 — HexClad locked component / effective-migration model (fixtures only).
 * Run: npm run test:agent1-hexclad-component-model-phase6-5
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  buildProposedInputPayload,
} from '../scripts/agent1/build-proposed-inputs.mjs'
import {
  buildSystemValidation,
  NON_DETECT_MITIGATION_FACTOR,
} from '../src/lib/lockedInput/buildSystemValidation.ts'
import { buildLockedInputPackage } from '../src/lib/lockedInput/buildLockedInputPackage.ts'
import {
  buildHexCladReviewedPayloadFixture,
  buildLodgeReviewedPayloadFixture,
} from '../src/shared/agent1/fixtures/systemValidation.fixture.mjs'
import {
  buildGate1ApprovalEligibilityHexCladV7Structured,
  buildGate1ApprovalEligibilityHexCladV7Sources,
} from '../src/shared/agent1/fixtures/gate1ApprovalEligibilityHexCladV7.fixture.mjs'
import { FIXTURE_LODGE_PRODUCT } from '../src/shared/agent1/fixtures/lodgeProposedInput.fixture.mjs'
import { runAgent3FromLockedInputPackage } from '../scripts/agent3/run-locked-input.mjs'
import { adaptLockedPayloadToScoringInputs } from '../scripts/agent3/locked-input-adapter.mjs'
import { prepareAgent3ScoringInputs } from '../scripts/agent3/prepare-scoring-inputs.mjs'
import { buildHexCladGate2V3ApprovedScoringInputs } from '../scripts/agent3/fixtures/hexclad-gate2-v3.fixture.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const hexProduct = {
  product_id: '00000000-0000-4000-8000-000000000002',
  product_name: 'HexClad Hybrid Nonstick 10 Inch Frying Pan',
  brand: 'HexClad',
  category: 'Kitchen',
  subcategory: 'Cookware',
}

function buildHexLockedFixture() {
  const reviewed = buildHexCladReviewedPayloadFixture()
  const validationResult = buildSystemValidation({
    reviewed_payload: reviewed,
    product: hexProduct,
    proposed_input_id: 'hex-phase65',
    evidence_id: '00000000-0000-4000-8000-000000000020',
  })
  assert.equal(validationResult.validation_status, 'passed', validationResult.blockers?.map((b) => b.message).join('; '))
  const locked = buildLockedInputPackage({
    proposed: {
      proposed_input_id: 'hex-phase65',
      product_id: hexProduct.product_id,
      evidence_id: '00000000-0000-4000-8000-000000000020',
      reviewed_payload: reviewed,
    },
    validation: {
      validation_id: 'hex-v-phase65',
      validation_status: validationResult.validation_status,
      validation_payload: validationResult.validation_payload,
      blockers: validationResult.blockers,
    },
  })
  return { reviewed, validationResult, locked }
}

// --- Old path trace (fixture only) ---
const { inputs: oldNorm } = buildHexCladGate2V3ApprovedScoringInputs()
const oldPrepared = prepareAgent3ScoringInputs(oldNorm, null)
const oldScoreDriving = oldPrepared.components.filter((c) => c.material_hazard != null)
assert.ok(oldScoreDriving.length >= 3, 'old path should have multiple score-driving hybrid components')
const oldHybrid = oldScoreDriving.find((c) => c.material_id === 'hybrid_stainless_nonstick_food_contact')
const oldPeaks = oldScoreDriving.find((c) => c.material_id === 'laser_etched_stainless_surface')
assert.ok(oldHybrid, 'old path includes hybrid primary')
assert.ok(oldPeaks, 'old path includes laser-etched peaks')
console.log('✓ Old HexClad Gate 2 path trace: hybrid + peaks + valleys model available from fixture')

// --- Proposal builder: hybrid suppresses overlapping substrate/coating score-driving ---
const hexStructured = buildGate1ApprovalEligibilityHexCladV7Structured()
const hexSources = buildGate1ApprovalEligibilityHexCladV7Sources()
const hexProposed = buildProposedInputPayload({
  product: hexProduct,
  evidence: {
    evidence_id: '00000000-0000-4000-8000-000000000020',
    product_id: hexProduct.product_id,
    sources: hexSources,
    agent_metadata: { structured_evidence: hexStructured },
  },
})
const propSubstrate = hexProposed.proposed_components.find((c) => c.proposed_component_role === 'structural')
const propCoating = hexProposed.proposed_components.find((c) => c.proposed_component_role === 'coating')
assert.equal(propSubstrate?.proposed_is_score_driving, true)
assert.equal(propCoating?.proposed_is_score_driving, false)
console.log('✓ HexClad proposal marks coating non-score-driving; structural body + handle score-driving for CI weighting')

// --- Reviewed fixture + validation ---
const { reviewed, validationResult, locked } = buildHexLockedFixture()
const scoreDrivingReviewed = reviewed.reviewed_components.filter((c) => c.reviewed_is_score_driving)
assert.equal(scoreDrivingReviewed.length, 4, 'hybrid + peaks + structural body + handle for CI-weighted NPR')
assert.ok(
  scoreDrivingReviewed.some((c) => c.confirmed_canonical_material_id === 'hybrid_stainless_nonstick_food_contact'),
)
assert.ok(
  scoreDrivingReviewed.some((c) => c.confirmed_canonical_material_id === 'laser_etched_stainless_surface'),
)
assert.ok(scoreDrivingReviewed.some((c) => c.reviewed_component_role === 'structural'))
assert.ok(scoreDrivingReviewed.some((c) => c.reviewed_component_role === 'handle'))
const coatingReviewed = reviewed.reviewed_components.find((c) => c.reviewed_component_role === 'coating')
assert.equal(coatingReviewed?.reviewed_is_score_driving, false)
console.log('✓ HexClad reviewed fixture has 4 score-driving rows; coating is support/context only')

// --- No double-count in locked package ---
const lockedScoreDriving = locked.locked_components.filter((c) => c.locked_is_score_driving)
assert.equal(lockedScoreDriving.length, 4)
assert.ok(!lockedScoreDriving.some((c) => c.locked_canonical_material_id === 'ceramic_nonstick_sol_gel_coating'))
console.log('✓ Locked package does not double-count overlapping coating/hybrid exposure')

// --- Badge + Layer 4A + cap ---
assert.equal(locked.locked_transparency_badge, 'Documentation Incomplete')
assert.equal(locked.locked_layer_4a_total, -3)
assert.equal(locked.locked_cap_triggered, false)
assert.equal(validationResult.validation_payload.known_category_proprietary_validation, true)
assert.equal(validationResult.validation_payload.unknown_coating_cap_validation, false)
console.log('✓ Badge frozen Documentation Incomplete; Layer 4A -3; unknown cap false')

// --- Non-Detect on hybrid primary only ---
const vp = validationResult.validation_payload
const hybridMit = vp.non_detect_mitigation.find((m) => {
  const lookup = vp.material_lookups.find((l) => l.reviewed_component_id === m.reviewed_component_id)
  return lookup?.resolved_material_taxonomy_id === 'hybrid_stainless_nonstick_food_contact'
})
const peaksMit = vp.non_detect_mitigation.find((m) => {
  const lookup = vp.material_lookups.find((l) => l.reviewed_component_id === m.reviewed_component_id)
  return lookup?.resolved_material_taxonomy_id === 'laser_etched_stainless_surface'
})
assert.equal(hybridMit.non_detect_validation_status, 'applied')
assert.equal(hybridMit.mitigation_factor, NON_DETECT_MITIGATION_FACTOR)
assert.equal(hybridMit.material_hazard_value, 0.35)
assert.equal(peaksMit.non_detect_validation_status, 'not_applicable')
console.log('✓ Non-Detect 0.58 migration-only on hybrid primary; hazard unchanged')

// --- Agent 3 locked path: no prepareAgent3ScoringInputs ---
const adapterSrc = readFileSync(join(root, 'scripts/agent3/locked-input-adapter.mjs'), 'utf8')
assert.ok(!adapterSrc.includes('prepareAgent3ScoringInputs'))
const hexAdapted = adaptLockedPayloadToScoringInputs(locked)
assert.equal(hexAdapted.components.length, 4)
console.log('✓ Agent 3 adapter scores 4 locked score-driving rows; no prepareAgent3ScoringInputs')

// --- Lodge regression ---
const lodgeValidation = buildSystemValidation({
  reviewed_payload: buildLodgeReviewedPayloadFixture(),
  product: FIXTURE_LODGE_PRODUCT,
})
assert.equal(lodgeValidation.validation_status, 'passed')
const lodgeLocked = buildLockedInputPackage({
  proposed: {
    proposed_input_id: 'lodge-p65',
    product_id: FIXTURE_LODGE_PRODUCT.product_id,
    evidence_id: 'lodge-e',
    reviewed_payload: buildLodgeReviewedPayloadFixture(),
  },
  validation: {
    validation_id: 'lodge-v65',
    validation_status: lodgeValidation.validation_status,
    validation_payload: lodgeValidation.validation_payload,
    blockers: lodgeValidation.blockers,
  },
})
const lodgeRun = runAgent3FromLockedInputPackage({
  lockedPayload: lodgeLocked,
  lockedInputId: 'lodge-p65-lock',
  lockHash: 'lodge-hash',
  productLabel: 'Lodge Cast Iron Skillet',
})
assert.equal(lodgeRun.result.pac_safety_score, 99)
assert.equal(lodgeRun.result.tier, 'Excellent')
assert.equal(lodgeRun.wrote_product_scores, false)
console.log('✓ Lodge still scores 99 / Excellent')

// --- HexClad dry-run score + mismatch report ---
const hexRun = runAgent3FromLockedInputPackage({
  lockedPayload: locked,
  lockedInputId: 'hex-p65-lock',
  lockHash: 'hex-hash',
  productLabel: 'HexClad Hybrid',
})
const hexScore = hexRun.result.pac_safety_score
const hexTarget = 78
const methodologyExpectedWithL4aMinus3 = 78
hexRun.result.score_target = {
  expected_score: hexTarget,
  expected_tier: 'Good',
  expected_badge: 'Documentation Incomplete',
  actual_score: hexScore,
  actual_tier: hexRun.result.tier,
  actual_badge: hexRun.result.transparency_badge,
  methodology_supported_score_with_l4a_minus3: methodologyExpectedWithL4aMinus3,
}
if (hexScore !== hexTarget) {
  hexRun.result.mismatch_diagnosis = [
    `Score ${hexScore} vs target ${hexTarget}`,
    'Expected v2.3.5 four-component CI-weighted model: hybrid + peaks + structural + handle',
  ]
  console.log(`✓ HexClad scores ${hexScore} / ${hexRun.result.tier} / ${hexRun.result.transparency_badge} — target ${hexTarget} mismatch documented`)
} else {
  console.log(`✓ HexClad scores ${hexScore} / ${hexRun.result.tier} / ${hexRun.result.transparency_badge}`)
}
assert.equal(hexRun.result.transparency_badge, 'Documentation Incomplete')
assert.equal(hexScore, methodologyExpectedWithL4aMinus3)
assert.equal(hexRun.result.tier, 'Good')
assert.equal(hexRun.wrote_product_scores, false)

// --- No hybrid/half-inert migration factor ---
assert.ok(
  !JSON.stringify(validationResult.validation_payload).includes('hybrid_contact_factor'),
  'no unsupported hybrid_contact_factor in validation_payload',
)
console.log('✓ CI-weighted dilution via structural + handle; no unsupported hybrid migration factor')

console.log('\nAll Phase 6.5 HexClad component/effective-migration tests passed.')
