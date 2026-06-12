#!/usr/bin/env node
/**
 * Phase 6 — Agent 3 locked-input adapter + parallel scoring path (fixtures only).
 * Run: npm run test:agent3-locked-input-path
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  adaptLockedPayloadToScoringInputs,
  validateLockedPayloadForScoring,
  LockedInputAdapterError,
} from '../scripts/agent3/locked-input-adapter.mjs'
import {
  scoreLockedInputPackage,
  formatLockedInputMathBreakdownTables,
  LOCKED_SCORING_METHODOLOGY_VERSION,
  LOCKED_SCORING_MATERIAL_LOOKUP_VERSION,
} from '../scripts/agent3/score-locked-input.mjs'
import { runAgent3FromLockedInputPackage } from '../scripts/agent3/run-locked-input.mjs'
import { prepareAgent3ScoringInputs } from '../scripts/agent3/prepare-scoring-inputs.mjs'
import { buildSystemValidation } from '../src/lib/lockedInput/buildSystemValidation.ts'
import { buildLockedInputPackage } from '../src/lib/lockedInput/buildLockedInputPackage.ts'
import {
  buildLodgeReviewedPayloadFixture,
  buildHexCladReviewedPayloadFixture,
} from '../src/shared/agent1/fixtures/systemValidation.fixture.mjs'
import { FIXTURE_LODGE_PRODUCT } from '../src/shared/agent1/fixtures/lodgeProposedInput.fixture.mjs'
import { NON_DETECT_MITIGATION_FACTOR } from '../src/lib/lockedInput/buildSystemValidation.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

function buildLockedFixture(reviewed, product, id) {
  const validationResult = buildSystemValidation({
    reviewed_payload: reviewed,
    product,
    proposed_input_id: id,
    evidence_id: id,
  })
  assert.equal(validationResult.validation_status, 'passed')
  const proposed = {
    proposed_input_id: id,
    product_id: product.product_id,
    evidence_id: id,
    reviewed_payload: reviewed,
  }
  const validation = {
    validation_id: id,
    validation_status: validationResult.validation_status,
    validation_payload: validationResult.validation_payload,
    blockers: validationResult.blockers,
  }
  return buildLockedInputPackage({ proposed, validation })
}

const lodgeLocked = buildLockedFixture(
  buildLodgeReviewedPayloadFixture(),
  FIXTURE_LODGE_PRODUCT,
  'lodge-locked-fixture',
)
const hexProduct = {
  product_id: '00000000-0000-4000-8000-000000000002',
  category: 'Kitchen',
  subcategory: 'Cookware',
  product_name: 'HexClad Hybrid Nonstick 10 Inch Frying Pan',
  brand: 'HexClad',
}
const hexLocked = buildLockedFixture(
  buildHexCladReviewedPayloadFixture(),
  hexProduct,
  'hex-locked-fixture',
)

// --- Adapter maps locked payload ---
const lodgeAdapted = adaptLockedPayloadToScoringInputs(lodgeLocked)
assert.equal(lodgeAdapted.input_source, 'locked_input_package')
assert.equal(lodgeAdapted.methodology_version, LOCKED_SCORING_METHODOLOGY_VERSION)
assert.equal(lodgeAdapted.material_lookup_version, LOCKED_SCORING_MATERIAL_LOOKUP_VERSION)
const lodgePrimary = lodgeAdapted.components.find((c) => c.component_role === 'primary_food_contact')
assert.equal(lodgePrimary.adjusted_migration_potential, lodgePrimary.base_migration_potential)
assert.equal(lodgePrimary.adjusted_migration_potential, 0.035)
assert.equal(lodgePrimary.locked_resolved_material_taxonomy_id, 'cast_iron')
assert.equal(lodgeAdapted.layer_4a.net_adjustment, lodgeLocked.locked_layer_4a_total)
assert.equal(lodgeAdapted.layer_4a.unknown_coating_cap_applies, lodgeLocked.locked_cap_triggered)
console.log('✓ Locked input adapter maps locked payload to algorithm input')

// --- HexClad uses locked_adjusted_migration on primary ---
const hexAdapted = adaptLockedPayloadToScoringInputs(hexLocked)
const hexPrimary = hexAdapted.components.find(
  (c) => c.material_id === 'hybrid_stainless_nonstick_food_contact',
)
assert.equal(hexPrimary.adjusted_migration_potential, 0.2204)
assert.equal(hexPrimary.base_migration_potential, 0.38)
assert.ok(hexPrimary.locked_non_detect_mitigation_applied)
assert.equal(hexPrimary.locked_non_detect_mitigation_factor, NON_DETECT_MITIGATION_FACTOR)
console.log('✓ Adapter uses locked_adjusted_migration_value; preserves base migration for audit')

// --- Adapter does not re-lookup taxonomy ---
const adapterSrc = readFileSync(join(root, 'scripts/agent3/locked-input-adapter.mjs'), 'utf8')
assert.ok(!adapterSrc.includes('getMaterial'))
assert.ok(!adapterSrc.includes('material-taxonomy.mjs'))
assert.ok(!adapterSrc.includes('prepareAgent3ScoringInputs'))
console.log('✓ Adapter does not re-lookup hazard/migration or call prepareAgent3ScoringInputs')

// --- Locked path runner does not call prepareAgent3ScoringInputs ---
const runnerLockedSrc = readFileSync(join(root, 'scripts/agent3/run-locked-input.mjs'), 'utf8')
assert.ok(!runnerLockedSrc.includes("from './prepare-scoring-inputs.mjs'"))
assert.ok(!runnerLockedSrc.includes('prepareAgent3ScoringInputs('))
assert.ok(!runnerLockedSrc.includes('fetchApprovedScoringInputs'))
assert.ok(!runnerLockedSrc.includes('insertProductScore'))
console.log('✓ Locked path runner does not use old scoring_inputs prepare/write path')

// --- Old path still has prepareAgent3ScoringInputs ---
const oldRunnerSrc = readFileSync(join(root, 'scripts/agent3/runner.mjs'), 'utf8')
assert.ok(oldRunnerSrc.includes('prepareAgent3ScoringInputs'))
assert.ok(oldRunnerSrc.includes('fetchApprovedScoringInputs'))
console.log('✓ Old Agent 3 runner unchanged (still uses prepareAgent3ScoringInputs)')

// --- Lodge dry-run score ---
const lodgeRun = runAgent3FromLockedInputPackage({
  lockedPayload: lodgeLocked,
  lockedInputId: 'fixture-lodge-lock',
  lockHash: 'abc123',
  productLabel: 'Lodge Cast Iron Skillet',
})
assert.equal(lodgeRun.input_source, 'locked_input_package')
assert.equal(lodgeRun.dry_run, true)
assert.equal(lodgeRun.wrote_product_scores, false)
assert.equal(lodgeRun.wrote_scoring_inputs, false)
assert.equal(lodgeRun.wrote_agent3_locked_outputs, false)
assert.equal(lodgeRun.result.methodology_version, 'v2.3.5')
assert.equal(lodgeRun.result.material_lookup_version, 'code_material_taxonomy_current')
assert.equal(lodgeRun.result.pac_safety_score, 99)
assert.equal(lodgeRun.result.tier, 'Excellent')
assert.equal(lodgeRun.result.cap_triggered, false)
console.log('✓ Lodge locked fixture scores 99 / Excellent')

// --- Lodge math breakdown ---
assert.ok(lodgeRun.result.component_math_breakdown.length >= 2)
assert.ok(lodgeRun.result.weighted_npr_breakdown.weighted_npr >= 0)
assert.ok(lodgeRun.result.raw_score_before_layer_4a > 0)
assert.ok(lodgeRun.math_breakdown_tables.includes('Lodge Cast Iron Skillet'))
const lodgePrimaryMath = lodgeRun.result.component_math_breakdown.find(
  (c) => c.component_role === 'primary_food_contact',
)
assert.equal(lodgePrimaryMath.hazard_used, 0.03)
assert.equal(lodgePrimaryMath.adjusted_migration_used, 0.035)
assert.equal(lodgePrimaryMath.inert_protection_applied, true)
console.log('✓ Lodge full math breakdown includes per-component NPR, weighted NPR, Layer 4A, final score')

// --- HexClad dry-run score (report mismatch vs target 78) ---
const hexRun = runAgent3FromLockedInputPackage({
  lockedPayload: hexLocked,
  lockedInputId: 'fixture-hex-lock',
  lockHash: 'def456',
  productLabel: 'HexClad Hybrid',
})
const hexScore = hexRun.result.pac_safety_score
const hexTarget = 78
const hexTargetTier = 'Good'
const hexTargetBadge = 'Documentation Incomplete'
const hexMethodologyScore = 78
hexRun.result.score_target = {
  expected_score: hexTarget,
  expected_tier: hexTargetTier,
  expected_badge: hexTargetBadge,
  actual_score: hexScore,
  actual_tier: hexRun.result.tier,
  actual_badge: hexRun.result.transparency_badge,
  methodology_supported_score: hexMethodologyScore,
  expected_weighted_npr: 14.24,
  actual_weighted_npr: hexRun.result.weighted_npr,
  matches_score: hexScore === hexTarget,
  matches_tier: hexRun.result.tier === hexTargetTier,
  matches_badge: hexRun.result.transparency_badge === hexTargetBadge,
}
assert.equal(hexLocked.locked_components.filter((c) => c.locked_is_score_driving).length, 4)
assert.ok(!hexLocked.locked_components.some((c) => c.locked_canonical_material_id === 'ceramic_nonstick_sol_gel_coating'))
assert.equal(hexLocked.locked_transparency_badge, hexTargetBadge)
assert.equal(hexLocked.locked_layer_4a_total, -3)
assert.equal(hexPrimary.adjusted_migration_potential, 0.2204)
assert.equal(hexPrimary.material_hazard, 0.35)
assert.equal(hexRun.result.layer_4a_total_applied, hexLocked.locked_layer_4a_total)
assert.equal(hexRun.result.cap_triggered, false)
assert.equal(hexScore, hexMethodologyScore)
assert.equal(hexRun.result.tier, hexTargetTier)
assert.equal(hexRun.result.transparency_badge, hexTargetBadge)
assert.ok(Math.abs(hexRun.result.weighted_npr - 14.24) < 0.1)
console.log(`✓ HexClad locked fixture scored: ${hexScore} (${hexRun.result.tier}) / ${hexRun.result.transparency_badge} — v2.3.5 worked example match`)

// --- Values unchanged through adapter + score ---
const hexAdaptedBefore = adaptLockedPayloadToScoringInputs(hexLocked)
const hexAdaptedClone = structuredClone(hexAdaptedBefore)
scoreLockedInputPackage(hexAdaptedBefore, { dryRun: true })
assert.deepEqual(hexAdaptedBefore, hexAdaptedClone)
console.log('✓ Locked adapted inputs unchanged after scoring call')

// --- Agent 4 isolation ---
for (const rel of ['scripts/agent4/constants.mjs', 'scripts/agent4/runner.mjs']) {
  const src = readFileSync(join(root, rel), 'utf8')
  assert.ok(!src.includes('locked-input-adapter'))
  assert.ok(!src.includes('runAgent3FromLockedInputPackage'))
}
console.log('✓ Agent 4 does not import locked Agent 3 services')

// --- Bad version stamp blocked ---
const badVersion = structuredClone(lodgeLocked)
badVersion.methodology_version = 'v2.3.4'
assert.throws(() => validateLockedPayloadForScoring(badVersion), LockedInputAdapterError)
console.log('✓ Malformed/wrong-version locked payload blocked')

// --- prepareAgent3ScoringInputs still works on old inputs (smoke) ---
const oldPrepared = prepareAgent3ScoringInputs(
  { components: [{ material_id: 'cast_iron', material_hazard: 0.03 }], layer_4a: { net_adjustment: 0 } },
  null,
)
assert.ok(oldPrepared.components)
console.log('✓ Old prepareAgent3ScoringInputs path still callable')

// --- Print math tables for Phase 6 report ---
console.log('\n' + formatLockedInputMathBreakdownTables(lodgeRun.result))
console.log('\n' + formatLockedInputMathBreakdownTables(hexRun.result))
console.log('\n--- Score target comparison ---')
console.log(`Lodge: ${lodgeRun.result.pac_safety_score} / ${lodgeRun.result.tier} (target 99 / Excellent) — ${lodgeRun.result.pac_safety_score === 99 ? 'MATCH' : 'MISMATCH'}`)
console.log(
  `HexClad: ${hexScore} / ${hexRun.result.tier} (target ${hexTarget} / ${hexTargetTier} / ${hexTargetBadge}) — ${hexScore === hexTarget ? 'MATCH' : 'MISMATCH'}`,
)
if (hexRun.result.mismatch_diagnosis?.length) {
  console.log('\n--- HexClad mismatch diagnosis ---')
  for (const line of hexRun.result.mismatch_diagnosis) console.log(`- ${line}`)
}

console.log('\nAll Agent 3 locked-input path Phase 6 tests passed.')
