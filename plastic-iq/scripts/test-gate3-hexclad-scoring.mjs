#!/usr/bin/env node
/**
 * Gate 3 — Layer 4A handoff + PFAS/PTFE escalator eligibility (HexClad Gate 2 v3 pattern).
 * Run: npm run test:gate3-hexclad-scoring
 */
import assert from 'node:assert/strict'
import { enforceLayer4a } from './agent2/layer4a-enforce.mjs'
import { finalizeNormalization } from './agent2/layer4b-enforce.mjs'
import { enforceNormalizationDeterminism } from './agent2/normalize-enforce.mjs'
import { scoreNormalization } from './agent3/algorithm.mjs'
import { prepareAgent3ScoringInputs } from './agent3/prepare-scoring-inputs.mjs'
import { buildHexCladGate2V3ApprovedScoringInputs } from './agent3/fixtures/hexclad-gate2-v3.fixture.mjs'
import {
  escalator1Eligible,
  isPfasPtfeFamilyMaterial,
} from '../src/shared/agent3/escalator-eligibility.mjs'
import { buildScoreMathBreakdown } from '../src/lib/scoreMathBreakdown.ts'

const { inputs: approvedInputs, evidence } = buildHexCladGate2V3ApprovedScoringInputs()

// --- Approved Gate 2 v3 contract ---
assert.equal(approvedInputs.layer_4a?.net_adjustment, -3)
assert.equal(approvedInputs.testing_evidence?.testing_evidence_present, true)
assert.equal(
  approvedInputs.testing_evidence?.testing_evidence_type,
  'manufacturer_published_third_party_lab_result',
)
assert.equal(approvedInputs.testing_evidence?.testing_result, 'Non-Detect')
assert.ok(approvedInputs.testing_evidence?.tested_analytes?.includes('PTFE'))
assert.equal(approvedInputs.layer_4a?.unknown_coating_cap_applies, false)
const negatives = (approvedInputs.layer_4a?.negative_adjustments ?? []).map((n) => n.reason)
assert.ok(
  negatives.some((r) => /proprietary food-contact coating chemistry undisclosed/i.test(r)),
)
assert.ok(!negatives.some((r) => /marketing language only/i.test(r)))
console.log('✓ fixture: Gate 2 v3 Layer 4A net -3, lab evidence, marketing stripped')

// --- Regression: stale Agent 3 re-enforce on mystery-coating inputs re-added marketing -2 ---
const staleMysteryInputs = structuredClone(approvedInputs)
staleMysteryInputs.layer_4a = {
  net_adjustment: -3,
  unknown_coating_cap_applies: true,
  negative_adjustments: [{ reason: 'Unknown proprietary food-contact coating', value: -3 }],
  positive_adjustments: [],
}
const terra = staleMysteryInputs.components.find((c) => /valleys/i.test(c.component_name))
if (terra) {
  terra.material_hazard = 0.8
  terra.adjusted_migration_potential = 0.875
  terra.material_id = 'proprietary_named_food_contact'
}
const buggyPath = finalizeNormalization(
  enforceLayer4a(enforceNormalizationDeterminism(staleMysteryInputs)),
)
assert.equal(buggyPath.layer_4a?.net_adjustment, -5, 'stale mystery-coating re-enforce reproduces -5 bug')
console.log('✓ regression: stale mystery-coating Agent 3 re-enforce reproduces Layer 4A -5 bug')

// --- Fix: trust approved Layer 4A ---
const prepared = prepareAgent3ScoringInputs(approvedInputs, evidence)
assert.equal(prepared.layer_4a?.net_adjustment, -3)
assert.equal(prepared.layer_4a?.unknown_coating_cap_applies, false)
const terraBond = prepared.components.find((c) =>
  /terrabond|valleys/i.test(`${c.component_name ?? ''} ${c.material ?? ''}`),
)
const peaks = prepared.components.find((c) =>
  /peak|laser.etched/i.test(`${c.component_name ?? ''} ${c.material ?? ''}`),
)
assert.ok(terraBond)
assert.equal(terraBond.material_hazard, 0.35)
assert.equal(terraBond.adjusted_migration_potential, 0.22)
assert.equal(terraBond.escalator_1_triggers, false, 'ineligible escalator_1 cleared')
assert.equal(escalator1Eligible(terraBond, prepared, evidence), false)
assert.equal(isPfasPtfeFamilyMaterial(terraBond), false)
console.log('✓ prepareAgent3ScoringInputs preserves Layer 4A -3 and clears ineligible escalator_1')

if (peaks) {
  assert.equal(peaks.material_hazard, 0.03)
  assert.equal(peaks.adjusted_migration_potential, 0.02)
  assert.equal(peaks.inert_protection_applies, true)
  assert.ok(!/ceramic nonstick sol-gel/i.test(peaks.material_hazard_table_entry ?? ''))
  console.log('✓ stainless peaks remain inert stainless — not ceramic nonstick')
}

const result = scoreNormalization(prepared, {
  agent2Layer4b: approvedInputs.layer_4b,
  evidence,
})
assert.equal(result.layer_4a_net, -3)
assert.equal(result.escalator_applied, null)
assert.equal(result.transparency_badge, 'Documentation Incomplete')
assert.equal(result.confidence_interval, 3)
assert.ok(result.displayed_confidence_range?.includes('–'))
console.log('✓ Gate 3 score uses Layer 4A -3 and no PFAS/PTFE escalator')

const breakdown = buildScoreMathBreakdown(
  {
    score_id: 'fixture',
    product_id: 'fixture',
    input_id: 'fixture',
    pac_safety_score: result.pac_safety_score,
    tier: result.tier,
    displayed_confidence_range: result.displayed_confidence_range,
    transparency_badge: result.transparency_badge,
    weighted_npr: result.weighted_npr,
    component_nprs: result.component_nprs,
    escalator_applied: result.escalator_applied,
    layer_4a_net: result.layer_4a_net,
    ingredient_transparency_score: null,
    explanation_draft: null,
    algorithm_version: '2.3.4',
    run_timestamp: '',
    review_status: 'pending_review',
    reviewer: null,
    review_timestamp: null,
    review_notes: null,
  },
  {
    layer4a: prepared.layer_4a,
    layer4b: prepared.layer_4b,
    layer4aVerified: prepared.layer_4a_verified,
    normalizationComponents: prepared.components,
  },
)
assert.equal(breakdown.layer4a.normalizationSuggestion, -3)
assert.equal(breakdown.layer4a.appliedInFinalScore, -3)
assert.equal(breakdown.escalator, null)
assert.equal(breakdown.internallyConsistent, true)
console.log('✓ score math breakdown: Layer 4A display and applied both -3, internally consistent')

// --- True PFAS/PTFE cookware still escalates ---
const ptfeComponent = {
  component_name: 'Cooking Surface (PTFE nonstick, titanium reinforced)',
  material: 'PTFE nonstick coating (titanium reinforced)',
  material_id: 'ptfe_nonstick_titanium_reinforced',
  material_hazard: 0.85,
  adjusted_migration_potential: 0.75,
  base_migration_potential: 0.75,
  contact_intimacy: 1,
  exposure_severity: 0.96,
  exposure_duration: 0.5,
  escalator_1_triggers: true,
}
const ptfeInputs = {
  canonical_mappings: {
    pfas_status_id: { canonical_id: 'pfas_present_disclosed' },
  },
}
assert.equal(isPfasPtfeFamilyMaterial(ptfeComponent), true)
assert.equal(escalator1Eligible(ptfeComponent, ptfeInputs, null), true)

const ptfeResult = scoreNormalization(
  {
    components: [ptfeComponent],
    layer_4a: { net_adjustment: 0, negative_adjustments: [], positive_adjustments: [] },
    is_formulation_product: false,
    product_category_default: 'Cookware',
  },
  { evidence: null },
)
assert.equal(ptfeResult.escalator_applied, 'escalator_1')
console.log('✓ true PTFE cookware still receives escalator_1')

// --- Expected score report (Scenario A) ---
console.log('\n--- Scenario A: corrected Gate 3 ---')
console.log(`weighted NPR: ${result.weighted_npr}`)
console.log(`raw score before Layer 4A: ${result.calculation.raw_score.toFixed(2)}`)
console.log(`Layer 4A applied: ${result.layer_4a_net}`)
console.log(`final score: ${result.pac_safety_score} (${result.tier})`)
console.log(`confidence range: ${result.displayed_confidence_range}`)
assert.ok(result.pac_safety_score > 70)
assert.ok(result.pac_safety_score > 66)
assert.ok(result.pac_safety_score >= 75 && result.pac_safety_score <= 82)
assert.equal(result.tier, 'Good')

console.log('\nAll Gate 3 HexClad scoring tests passed.')
