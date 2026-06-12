#!/usr/bin/env node
/**
 * Phase 5.5 — HexClad validation → lock readiness (fixtures only; no live agents).
 * Run: npm run test:agent1-hexclad-validation-lock-readiness
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  buildSystemValidation,
  NON_DETECT_MITIGATION_FACTOR,
  METHODOLOGY_VERSION,
  MATERIAL_LOOKUP_VERSION,
} from '../src/lib/lockedInput/buildSystemValidation.ts'
import {
  buildLockedInputPackage,
  checkLockEligibility,
} from '../src/lib/lockedInput/buildLockedInputPackage.ts'
import {
  buildHexCladReviewedPayloadFixture,
  buildLodgeReviewedPayloadFixture,
} from '../src/shared/agent1/fixtures/systemValidation.fixture.mjs'
import { FIXTURE_LODGE_PRODUCT } from '../src/shared/agent1/fixtures/lodgeProposedInput.fixture.mjs'
import { getMaterial } from '../scripts/agent2/deterministic/material-taxonomy.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const hexProduct = {
  product_id: '00000000-0000-4000-8000-000000000002',
  product_name: 'HexClad Hybrid Nonstick 10 Inch Frying Pan',
  brand: 'HexClad',
  category: 'Kitchen',
  subcategory: 'Cookware',
}

function buildHexValidationContext() {
  const reviewed = buildHexCladReviewedPayloadFixture()
  const validationResult = buildSystemValidation({
    reviewed_payload: reviewed,
    product: hexProduct,
    proposed_input_id: 'hex-proposed-fixture',
    evidence_id: '00000000-0000-4000-8000-000000000020',
  })
  const proposed = {
    proposed_input_id: 'hex-proposed-fixture',
    product_id: hexProduct.product_id,
    evidence_id: '00000000-0000-4000-8000-000000000020',
    reviewed_payload: reviewed,
    reviewed_at: reviewed.reviewed_at ?? new Date().toISOString(),
  }
  const validation = {
    validation_id: 'hex-validation-fixture',
    validation_status: validationResult.validation_status,
    validation_payload: validationResult.validation_payload,
    blockers: validationResult.blockers,
    validated_at: validationResult.validated_at,
  }
  return { reviewed, proposed, validation, validationResult }
}

// 1–4. Full HexClad validation passes without synthetic patch
const hexCtx = buildHexValidationContext()
assert.equal(hexCtx.validationResult.validation_status, 'passed')
assert.equal(hexCtx.validationResult.blockers.length, 0)
assert.equal(hexCtx.validationResult.validation_payload.unresolved_canonical_material_ids?.length ?? 0, 0)
assert.ok(
  !hexCtx.validationResult.blockers.some((b) =>
    ['UNKNOWN_CANONICAL_MATERIAL_ID', 'CAP_PROPRIETARY_CONFLICT', 'NON_DETECT_INELIGIBLE_MATERIAL'].includes(
      b.code,
    ),
  ),
)
console.log('✓ HexClad validation passes with no canonical/cap/non-detect blockers')

// 5–7. Known-category proprietary vs unknown cap; Non-Detect on primary only
const vp = hexCtx.validationResult.validation_payload
assert.equal(vp.known_category_proprietary_validation, true)
assert.equal(vp.unknown_coating_cap_validation, false)
const hexPrimaryLookup = vp.material_lookups.find(
  (m) => m.resolved_material_taxonomy_id === 'hybrid_stainless_nonstick_food_contact',
)
const hexPrimaryMit = vp.non_detect_mitigation.find(
  (m) => m.reviewed_component_id === hexPrimaryLookup.reviewed_component_id,
)
const hexSubstrateLookup = vp.material_lookups.find((l) => l.reviewed_component_role === 'structural')
assert.equal(hexSubstrateLookup?.reviewed_is_score_driving, true)
const hexSubstrateUse = vp.use_conditions.find(
  (u) => u.reviewed_component_id === hexSubstrateLookup?.reviewed_component_id,
)
assert.equal(hexSubstrateUse?.final_contact_intimacy, 0.1)
const hexHandleLookup = vp.material_lookups.find((l) => l.reviewed_component_role === 'handle')
assert.equal(hexHandleLookup?.reviewed_is_score_driving, true)
const hexCoatingLookup = vp.material_lookups.find((l) => l.reviewed_component_role === 'coating')
assert.equal(hexCoatingLookup?.reviewed_is_score_driving, false)
const hexPeaksMit = vp.non_detect_mitigation.find((m) => {
  const lookup = vp.material_lookups.find((l) => l.reviewed_component_id === m.reviewed_component_id)
  return lookup?.resolved_material_taxonomy_id === 'laser_etched_stainless_surface'
})
assert.equal(hexPrimaryMit.non_detect_validation_status, 'applied')
assert.equal(hexPrimaryMit.mitigation_factor, NON_DETECT_MITIGATION_FACTOR)
assert.equal(hexPeaksMit?.non_detect_validation_status, 'not_applicable')
assert.equal(hexPrimaryLookup.material_hazard_value, getMaterial('hybrid_stainless_nonstick_food_contact')?.hazard)
console.log('✓ HexClad known-category proprietary; Non-Detect 0.58 on hybrid only; structural + handle CI weighting')

// 8–11. Lock package fields
assert.equal(checkLockEligibility(hexCtx).eligible, true)
const hexLocked = buildLockedInputPackage({
  proposed: hexCtx.proposed,
  validation: hexCtx.validation,
})
assert.equal(hexLocked.locked_transparency_badge, 'Documentation Incomplete')
assert.equal(hexLocked.locked_layer_4a_total, -3)
const hexScoreDrivingLocked = hexLocked.locked_components.filter((c) => c.locked_is_score_driving)
assert.equal(hexScoreDrivingLocked.length, 4)
const hexLockedPrimary = hexLocked.locked_components.find(
  (c) => c.locked_component_role === 'primary_food_contact',
)
assert.ok(hexLockedPrimary.locked_canonical_material_id)
assert.equal(hexLockedPrimary.locked_resolved_material_taxonomy_id, 'hybrid_stainless_nonstick_food_contact')
assert.equal(hexLocked.methodology_version, METHODOLOGY_VERSION)
assert.equal(hexLocked.material_lookup_version, MATERIAL_LOOKUP_VERSION)
assert.equal(hexLocked.locked_cap_triggered, false)
console.log('✓ HexClad lock package created with locked_* fields and version stamps')

// 12–13. Lodge regression
const lodgeResult = buildSystemValidation({
  reviewed_payload: buildLodgeReviewedPayloadFixture(),
  product: FIXTURE_LODGE_PRODUCT,
})
assert.equal(lodgeResult.validation_status, 'passed')
const lodgePrimary = lodgeResult.validation_payload.material_lookups.find(
  (m) => m.reviewed_component_role === 'primary_food_contact',
)
assert.equal(lodgePrimary.resolved_material_taxonomy_id, 'cast_iron')
assert.equal(lodgePrimary.material_hazard_value, 0.03)
assert.equal(lodgePrimary.base_migration_value, 0.035)
const lodgeMit = lodgeResult.validation_payload.non_detect_mitigation.find(
  (m) => m.reviewed_component_id === lodgePrimary.reviewed_component_id,
)
assert.notEqual(lodgeMit.mitigation_factor, NON_DETECT_MITIGATION_FACTOR)
const lodgeLocked = buildLockedInputPackage({
  proposed: {
    proposed_input_id: 'lodge-p',
    product_id: FIXTURE_LODGE_PRODUCT.product_id,
    evidence_id: 'lodge-e',
    reviewed_payload: buildLodgeReviewedPayloadFixture(),
  },
  validation: {
    validation_id: 'lodge-v',
    validation_status: lodgeResult.validation_status,
    validation_payload: lodgeResult.validation_payload,
    blockers: lodgeResult.blockers,
  },
})
assert.ok(lodgeLocked.locked_components.length >= 1)
console.log('✓ Lodge validation and lock still pass after HexClad fixes')

// 15–16. Agent 3/4 isolation
for (const rel of ['scripts/agent3/runner.mjs', 'scripts/agent3/algorithm.mjs', 'scripts/agent4/constants.mjs']) {
  const src = readFileSync(join(root, rel), 'utf8')
  assert.ok(!src.includes('buildLockedInputPackage'), `${rel} must not import lock builder`)
}
console.log('✓ Agent 3/4 do not import locked-input services')

// 19. Old path unchanged
const agent1Runner = readFileSync(join(root, 'scripts/agent1/runner.mjs'), 'utf8')
assert.ok(!agent1Runner.includes('createLockedInputPackageFromValidation'))
console.log('✓ Old Agent 1 → Agent 2 path unchanged')

console.log('\nAll Phase 5.5 HexClad validation-lock readiness tests passed.')
