import type {
  ProposedComponentInput,
  ProposedInputPayload,
  ProposedProductContext,
  ReviewedComponentInput,
  ReviewedInputPayload,
} from '../../types/lockedInput'
import { REVIEWED_PAYLOAD_SCHEMA_VERSION } from '../../types/lockedInput'

function draftCanonicalMaterialId(comp: ProposedComponentInput): string | null {
  if (comp.proposed_canonical_material_id) return comp.proposed_canonical_material_id
  const label = comp.proposed_canonical_material_label?.trim()
  if (label && /^[a-z][a-z0-9_]*$/.test(label)) return label
  return null
}

export function proposedComponentToReviewDraft(comp: ProposedComponentInput): ReviewedComponentInput {
  return {
    reviewed_component_id: comp.proposed_component_id,
    reviewed_component_name: comp.proposed_component_name ?? comp.proposed_component_id,
    reviewed_component_role: comp.proposed_component_role,
    reviewed_component_structure: comp.proposed_component_structure ?? 'unknown',
    reviewed_contact_pathway: comp.proposed_contact_pathway ?? 'unknown',
    reviewed_is_primary_contact: Boolean(comp.proposed_is_primary_contact),
    reviewed_is_score_driving: Boolean(comp.proposed_is_score_driving),
    confirmed_canonical_material_id: draftCanonicalMaterialId(comp),
    reviewed_canonical_material_label: comp.proposed_canonical_material_label ?? null,
    evidence_support_refs: comp.evidence_support_refs ?? [],
    reviewer_notes: comp.proposal_notes ?? null,
  }
}

export function initializeReviewDraftFromProposed(
  proposed: ProposedInputPayload,
  existingReviewed: ReviewedInputPayload | null | undefined,
): ReviewedInputPayload {
  if (existingReviewed?.reviewed_components?.length) {
    return structuredClone(existingReviewed)
  }

  const ctx = proposed.product_context ?? ({} as ProposedProductContext)
  return {
    schema_version: REVIEWED_PAYLOAD_SCHEMA_VERSION,
    non_authoritative: true,
    not_validated: true,
    not_locked: true,
    product_context: {
      product_id: ctx.product_id ?? null,
      evidence_id: ctx.evidence_id ?? null,
      category: ctx.category ?? null,
      subcategory: ctx.subcategory ?? null,
      product_type: ctx.product_type ?? null,
      brand: ctx.brand ?? null,
      product_name: ctx.product_name ?? null,
      variant_or_sku: ctx.variant_or_sku ?? null,
    },
    reviewed_components: (proposed.proposed_components ?? []).map(proposedComponentToReviewDraft),
    reviewed_lab_evidence_status: proposed.proposed_lab_evidence_status ?? 'none',
    reviewed_lab_applies_to:
      proposed.proposed_lab_applies_to ?? proposed.proposed_lab_applies_to_scope ?? 'unknown',
    reviewed_non_detect_mitigation_candidate: Boolean(
      proposed.proposed_non_detect_mitigation_candidate,
    ),
    reviewed_lab_source_ids: proposed.proposed_lab_source_ids ?? [],
    reviewed_analytes_tested: proposed.proposed_analytes_tested ?? [],
    reviewed_result_language: proposed.proposed_result_language ?? null,
    reviewed_lab_notes: proposed.proposed_lab_notes ?? null,
    reviewed_proprietary_status: proposed.proposed_proprietary_status ?? 'unknown',
    reviewed_pfas_ptfe_status:
      proposed.proposed_pfas_ptfe_status ??
      proposed.proposed_pfas_status ??
      'unknown',
    reviewed_coating_family_status: proposed.proposed_coating_family_status ?? null,
    reviewed_unknown_coating_cap_candidate: Boolean(proposed.proposed_unknown_coating_cap_candidate),
    reviewed_known_category_proprietary_candidate: Boolean(
      proposed.proposed_known_category_proprietary_candidate,
    ),
    reviewed_use_condition_override: Boolean(proposed.proposed_use_condition_override),
    reviewed_contact_intimacy_override: proposed.proposed_contact_intimacy_override ?? null,
    reviewed_severity_override: proposed.proposed_severity_override ?? null,
    reviewed_duration_override: proposed.proposed_duration_override ?? null,
    reviewed_use_condition_override_reason:
      proposed.proposed_use_condition_override_reason ??
      'No evidence-backed override approved; category defaults should apply.',
    reviewed_use_condition_source_ids: proposed.proposed_use_condition_source_ids ?? [],
    reviewed_layer_4a_flags: proposed.proposed_layer_4a_flags ?? { candidate_only: true },
    reviewed_layer_4a_credit_candidates: proposed.proposed_layer_4a_credit_candidates ?? [],
    reviewed_layer_4a_deduction_candidates: proposed.proposed_layer_4a_deduction_candidates ?? [],
    reviewed_layer_4a_notes: proposed.proposed_layer_4a_notes ?? null,
    reviewed_layer_4a_source_ids: proposed.proposed_layer_4a_source_ids ?? [],
    reviewed_cap_flag: Boolean(proposed.proposed_cap_flag),
    reviewed_cap_reason: proposed.proposed_cap_reason ?? null,
    reviewed_escalator_candidate: proposed.proposed_escalator_candidate ?? null,
    reviewed_escalator_reason: proposed.proposed_escalator_reason ?? null,
    reviewed_cap_escalator_source_ids: proposed.proposed_cap_escalator_source_ids ?? [],
    reviewed_transparency_badge: proposed.proposed_transparency_badge ?? null,
    reviewed_badge_basis: proposed.proposed_badge_basis ?? null,
    reviewed_badge_notes: proposed.proposed_badge_notes ?? null,
    reviewed_badge_source_ids: proposed.proposed_badge_source_ids ?? [],
    review_notes: null,
    review_change_summary: null,
  }
}

export function computeReviewChangeSummary(
  proposed: ProposedInputPayload,
  reviewed: ReviewedInputPayload,
): string {
  const changes: string[] = []
  for (const rc of reviewed.reviewed_components) {
    const match = proposed.proposed_components.find(
      (p) => p.proposed_component_id === rc.reviewed_component_id,
    )
    const proposedId = match?.proposed_canonical_material_id ?? null
    const confirmedId =
      rc.confirmed_canonical_material_id ?? rc.reviewed_canonical_material_id ?? null
    if (proposedId !== confirmedId) {
      changes.push(
        `${rc.reviewed_component_name ?? rc.reviewed_component_id}: canonical ${proposedId ?? '—'} → ${confirmedId ?? '—'}`,
      )
    }
  }
  if (
    proposed.proposed_lab_evidence_status !== reviewed.reviewed_lab_evidence_status &&
    reviewed.reviewed_lab_evidence_status
  ) {
    changes.push('lab evidence status updated')
  }
  if (proposed.proposed_transparency_badge !== reviewed.reviewed_transparency_badge) {
    changes.push('transparency badge updated')
  }
  return changes.length ? changes.join('; ') : 'Confirmed proposed values without material changes'
}
