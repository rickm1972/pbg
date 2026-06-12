/**
 * Phase 4 system validation fixture helpers.
 */
import { buildProposedInputPayload } from '../../../../scripts/agent1/build-proposed-inputs.mjs'
import { initializeReviewDraftFromProposed } from '../../../lib/lockedInput/reviewGateDraft.ts'
import {
  FIXTURE_LODGE_PRODUCT,
  buildLodgeProposedInputEvidenceRow,
} from './lodgeProposedInput.fixture.mjs'
import {
  buildGate1ApprovalEligibilityHexCladV7Structured,
  buildGate1ApprovalEligibilityHexCladV7Sources,
} from './gate1ApprovalEligibilityHexCladV7.fixture.mjs'

export function buildLodgeReviewedPayloadFixture() {
  const proposed = buildProposedInputPayload({
    product: FIXTURE_LODGE_PRODUCT,
    evidence: buildLodgeProposedInputEvidenceRow(),
  })
  const draft = initializeReviewDraftFromProposed(proposed, null)
  draft.reviewed_use_condition_override = false
  draft.reviewed_use_condition_override_reason =
    'No evidence-backed override approved; category defaults should apply.'
  return draft
}

export function buildHexCladReviewedPayloadFixture() {
  const hexStructured = buildGate1ApprovalEligibilityHexCladV7Structured()
  const hexSources = buildGate1ApprovalEligibilityHexCladV7Sources()
  const hexProduct = {
    product_id: '00000000-0000-4000-8000-000000000002',
    product_name: hexStructured.product_identity.product_name,
    brand: 'HexClad',
    category: 'Kitchen',
    subcategory: 'Cookware',
  }
  const hexEvidence = {
    evidence_id: '00000000-0000-4000-8000-000000000020',
    product_id: hexProduct.product_id,
    sources: hexSources,
    agent_metadata: { structured_evidence: hexStructured },
  }
  const proposed = buildProposedInputPayload({ product: hexProduct, evidence: hexEvidence })
  const draft = initializeReviewDraftFromProposed(proposed, null)
  draft.reviewed_analytes_tested = ['PFAS', 'PTFE', 'PFOA', 'PFOS']
  draft.reviewed_result_language = 'Non-Detect for PFAS/PTFE analytes'
  draft.reviewed_lab_evidence_status = 'third_party_non_detect'
  draft.reviewed_lab_applies_to = 'product_line'
  draft.reviewed_non_detect_mitigation_candidate = true
  draft.reviewed_known_category_proprietary_candidate = true
  draft.reviewed_proprietary_status = 'known_category_proprietary'
  draft.reviewed_transparency_badge = 'Documentation Incomplete'
  draft.reviewed_badge_basis =
    'Known-category proprietary ceramic nonstick with qualifying third-party Non-Detect lab; formula not fully disclosed.'
  // Coating row is provenance-only; hybrid primary + peaks carry food-contact exposure.
  for (const comp of draft.reviewed_components) {
    if (comp.reviewed_component_role === 'coating') {
      comp.reviewed_is_score_driving = false
      comp.reviewer_notes =
        'Proprietary coating identity for badge/provenance; exposure scored on hybrid primary + peaks only.'
    }
    if (comp.reviewed_component_role === 'structural' || comp.reviewed_component_id === 'proposed-substrate') {
      comp.reviewed_component_role = 'structural'
      comp.reviewed_is_score_driving = true
      comp.reviewer_notes =
        'Pan body structural — low CI (0.1) dilution weighting per v2.3.5 CI-weighted NPR model; not duplicate food-contact exposure.'
    }
    if (comp.reviewed_component_role === 'handle') {
      comp.reviewed_is_score_driving = true
      comp.confirmed_canonical_material_id = 'stainless_steel_unspecified'
      comp.reviewed_canonical_material_label = 'Stainless steel handle'
      comp.reviewer_notes =
        'Handle — low NPR, CI 0.5 dilution weighting per v2.3.5 hybrid worked example.'
    }
  }
  const coatingIdx = draft.reviewed_components.findIndex(
    (c) => c.reviewed_component_role === 'coating',
  )
  if (coatingIdx >= 0) {
    draft.reviewed_components[coatingIdx] = {
      ...draft.reviewed_components[coatingIdx],
      confirmed_canonical_material_id: 'ceramic_nonstick_sol_gel_coating',
      reviewer_notes:
        'Known-category proprietary ceramic nonstick (TerraBond); formula undisclosed but ceramic sol-gel family confirmed for hazard lookup.',
    }
  }
  // Dual-surface model aligned with Agent 2 component-extract: laser-etched peaks (inert) + hybrid valleys.
  draft.reviewed_components.push({
    reviewed_component_id: 'reviewed-hybrid-peaks',
    reviewed_component_name:
      'Cooking Surface — Stainless Steel Hexagonal Peaks (laser-etched, direct food contact)',
    reviewed_component_role: 'primary_food_contact',
    reviewed_component_structure: 'hybrid_surface',
    reviewed_contact_pathway: 'direct_food_contact',
    reviewed_is_primary_contact: true,
    reviewed_is_score_driving: true,
    confirmed_canonical_material_id: 'laser_etched_stainless_surface',
    reviewed_canonical_material_label: 'Laser-etched stainless steel peaks',
    evidence_support_refs: draft.reviewed_components[coatingIdx]?.evidence_support_refs ?? [],
    reviewer_notes:
      'Affirmative hybrid dual-surface construction — inert stainless peaks scored separately from coated valleys.',
  })
  // Layer 4A: proprietary chemistry undisclosed (-3). Non-Detect benefit is migration-only (0.58), not +2 Layer 4A credit.
  draft.reviewed_layer_4a_credit_candidates = []
  draft.reviewed_layer_4a_deduction_candidates = ['proprietary_ceramic_or_nonstick_formula_undisclosed']
  draft.reviewed_cap_flag = false
  draft.reviewed_unknown_coating_cap_candidate = false
  draft.reviewed_cap_reason = null
  return draft
}

export function buildInvalidNonDetectReviewedFixture() {
  const draft = buildLodgeReviewedPayloadFixture()
  draft.reviewed_non_detect_mitigation_candidate = true
  draft.reviewed_lab_evidence_status = 'none'
  return draft
}

export function buildUnknownCanonicalReviewedFixture() {
  const draft = buildLodgeReviewedPayloadFixture()
  const primaryIdx = draft.reviewed_components.findIndex(
    (c) => c.reviewed_component_role === 'primary_food_contact',
  )
  draft.reviewed_components[primaryIdx] = {
    ...draft.reviewed_components[primaryIdx],
    confirmed_canonical_material_id: 'not_in_material_taxonomy_xyz',
  }
  return draft
}

export function buildUseConditionOverrideMissingSourceFixture() {
  const draft = buildLodgeReviewedPayloadFixture()
  draft.reviewed_use_condition_override = true
  draft.reviewed_contact_intimacy_override = 1
  draft.reviewed_severity_override = 0.96
  draft.reviewed_duration_override = 0.5
  draft.reviewed_use_condition_override_reason = 'High-heat stovetop override'
  draft.reviewed_use_condition_source_ids = []
  return draft
}

export function buildKnownCategoryCapConflictFixture() {
  const draft = buildHexCladReviewedPayloadFixture()
  draft.reviewed_cap_flag = true
  draft.reviewed_known_category_proprietary_candidate = true
  return draft
}
