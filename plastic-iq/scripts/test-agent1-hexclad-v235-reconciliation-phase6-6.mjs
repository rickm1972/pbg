#!/usr/bin/env node
/**
 * Phase 6.6 — HexClad locked path vs documented v2.3.5 worked example (fixtures only).
 * Run: npm run test:agent1-hexclad-v235-reconciliation-phase6-6
 */
import assert from 'node:assert/strict'
import { buildHexCladGate2V3ApprovedScoringInputs } from './agent3/fixtures/hexclad-gate2-v3.fixture.mjs'
import { prepareAgent3ScoringInputs } from './agent3/prepare-scoring-inputs.mjs'
import { scorePacCore } from './agent3/algorithm.mjs'
import { buildHexCladReviewedPayloadFixture } from '../src/shared/agent1/fixtures/systemValidation.fixture.mjs'
import { buildSystemValidation } from '../src/lib/lockedInput/buildSystemValidation.ts'
import { buildLockedInputPackage } from '../src/lib/lockedInput/buildLockedInputPackage.ts'
import { adaptLockedPayloadToScoringInputs } from './agent3/locked-input-adapter.mjs'
import { scoreLockedInputPackage } from './agent3/score-locked-input.mjs'
import { runAgent3FromLockedInputPackage } from './agent3/run-locked-input.mjs'
import { NON_DETECT_MITIGATION_FACTOR } from '../src/lib/lockedInput/buildSystemValidation.ts'

const WORKED_EXAMPLE = {
  weighted_npr: 14.24,
  raw_score: 81.1,
  layer_4a: -3,
  final_score: 78,
  tier: 'Good',
  badge: 'Documentation Incomplete',
}

const hexProduct = {
  product_id: '00000000-0000-4000-8000-000000000002',
  product_name: 'HexClad Hybrid Nonstick 10 Inch Frying Pan',
  brand: 'HexClad',
  category: 'Kitchen',
  subcategory: 'Cookware',
}

function buildHexLockedRun() {
  const reviewed = buildHexCladReviewedPayloadFixture()
  const validationResult = buildSystemValidation({
    reviewed_payload: reviewed,
    product: hexProduct,
    proposed_input_id: 'hex-66',
    evidence_id: '00000000-0000-4000-8000-000000000020',
  })
  assert.equal(validationResult.validation_status, 'passed')
  const locked = buildLockedInputPackage({
    proposed: {
      proposed_input_id: 'hex-66',
      product_id: hexProduct.product_id,
      evidence_id: '00000000-0000-4000-8000-000000000020',
      reviewed_payload: reviewed,
    },
    validation: {
      validation_id: 'hex-v66',
      validation_status: validationResult.validation_status,
      validation_payload: validationResult.validation_payload,
      blockers: validationResult.blockers,
    },
  })
  const adapted = adaptLockedPayloadToScoringInputs(locked)
  const scored = scoreLockedInputPackage(adapted, { dryRun: true })
  return { reviewed, validationResult, locked, adapted, scored }
}

// --- v2.3.5 old-path reference (4 components, no duplicate hybrid row) ---
const { inputs, evidence } = buildHexCladGate2V3ApprovedScoringInputs()
const prepared = prepareAgent3ScoringInputs(inputs, evidence)
const refComponents = prepared.components.filter(
  (c) => !/Hybrid stainless lattice/i.test(String(c.component_name ?? '')),
)
const refCore = scorePacCore(
  { ...prepared, components: refComponents, layer_4a: prepared.layer_4a },
  null,
  { lockedInputMode: true },
)
console.log('✓ v2.3.5 reference path (valleys + peaks + structural + handle):', {
  weighted_npr: refCore.weighted_npr.toFixed(4),
  raw: refCore.raw_score.toFixed(2),
  final: Math.round(refCore.score_after_4a),
})

const { locked, scored } = buildHexLockedRun()

// --- Component model ---
const scoreDriving = locked.locked_components.filter((c) => c.locked_is_score_driving)
assert.equal(scoreDriving.length, 4)
assert.ok(scoreDriving.some((c) => c.locked_canonical_material_id === 'hybrid_stainless_nonstick_food_contact'))
assert.ok(scoreDriving.some((c) => c.locked_canonical_material_id === 'laser_etched_stainless_surface'))
assert.ok(scoreDriving.some((c) => c.locked_component_role === 'structural'))
assert.ok(scoreDriving.some((c) => c.locked_component_role === 'handle'))
assert.ok(!scoreDriving.some((c) => c.locked_canonical_material_id === 'ceramic_nonstick_sol_gel_coating'))
console.log('✓ 4 score-driving rows: hybrid + peaks + structural body + handle; no coating double-count')

// --- Non-Detect on hybrid primary only ---
const hybridLocked = scoreDriving.find(
  (c) => c.locked_canonical_material_id === 'hybrid_stainless_nonstick_food_contact',
)
assert.equal(hybridLocked.locked_base_migration_value, 0.38)
assert.equal(hybridLocked.locked_non_detect_mitigation_factor, NON_DETECT_MITIGATION_FACTOR)
assert.equal(hybridLocked.locked_adjusted_migration_value, 0.2204)
assert.equal(hybridLocked.locked_material_hazard_value, 0.35)
console.log('✓ Non-Detect 0.58 migration-only on hybrid primary; hazard unchanged')

// --- Layer 4A / badge ---
assert.equal(locked.locked_layer_4a_total, -3)
assert.equal(locked.locked_transparency_badge, 'Documentation Incomplete')
assert.equal(locked.locked_cap_triggered, false)
console.log('✓ Layer 4A -3; Documentation Incomplete badge; no cap')

// --- Worked example reconciliation ---
assert.ok(Math.abs(scored.weighted_npr - WORKED_EXAMPLE.weighted_npr) < 0.1, `weighted NPR ${scored.weighted_npr}`)
assert.ok(
  Math.abs(scored.raw_score_before_layer_4a - WORKED_EXAMPLE.raw_score) < 0.2,
  `raw ${scored.raw_score_before_layer_4a}`,
)
assert.equal(scored.pac_safety_score, WORKED_EXAMPLE.final_score)
assert.equal(scored.tier, WORKED_EXAMPLE.tier)
assert.equal(scored.transparency_badge, WORKED_EXAMPLE.badge)
console.log('✓ Locked path matches v2.3.5 worked example: ~14.24 weighted NPR, ~81.1 raw, 78 final')

// --- CI weighting matches reference ---
const structural = scored.component_math_breakdown.find((c) => c.component_role === 'structural')
const handle = scored.component_math_breakdown.find((c) => c.component_role === 'handle')
assert.equal(structural.contact_intimacy, 0.1)
assert.equal(handle.contact_intimacy, 0.5)
assert.equal(scored.weighted_npr_breakdown.method, 'sum(npr_after_escalator × contact_intimacy) / sum(contact_intimacy)')
console.log('✓ CI-weighted NPR dilution via structural (0.1) + handle (0.5) matches worked example')

// --- Dry run isolation ---
const run = runAgent3FromLockedInputPackage({
  lockedPayload: locked,
  lockedInputId: 'hex-66-lock',
  lockHash: 'hex66',
  productLabel: 'HexClad Hybrid',
})
assert.equal(run.wrote_product_scores, false)
assert.equal(run.result.pac_safety_score, 78)
console.log('✓ Dry-run produces 78 without writing product_scores')

console.log('\nAll Phase 6.6 HexClad v2.3.5 reconciliation tests passed.')
