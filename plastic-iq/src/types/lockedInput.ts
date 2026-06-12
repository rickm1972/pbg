/**
 * Phase 1 locked-input architecture types.
 * proposed_canonical_material_id exists only on proposed/reviewed payloads.
 * locked_canonical_material_id exists only on locked payloads.
 */

export const LOCKED_INPUT_SCHEMA_VERSION = '1.0.0' as const

/** Phase 2 expanded proposed_payload schema version. */
export const PROPOSED_PAYLOAD_SCHEMA_VERSION = '2.0.0' as const

/** Phase 3 human-reviewed closed-field payload schema version. */
export const REVIEWED_PAYLOAD_SCHEMA_VERSION = '3.0.0' as const

export const PROPOSED_INPUT_STATUSES = [
  'draft',
  'pending_review',
  'reviewed',
  'superseded',
] as const

export type ProposedInputStatus = (typeof PROPOSED_INPUT_STATUSES)[number]

export const VALIDATION_STATUSES = ['pending', 'passed', 'failed', 'superseded'] as const

export type ValidationStatus = (typeof VALIDATION_STATUSES)[number]

export const LOCKED_INPUT_STATUSES = [
  'draft',
  'reviewed',
  'validated',
  'locked_for_agent_3',
  'superseded',
] as const

export type LockedInputStatus = (typeof LOCKED_INPUT_STATUSES)[number]

/** Evidence claim / source support reference on proposed fields. */
export type ProposedEvidenceSupportRef = {
  source_index?: number | null
  source_url?: string | null
  claim_topic?: string | null
  excerpt?: string | null
  field_path?: string | null
}

/** Proposed component row — uses proposed_canonical_material_id only (never locked_*). */
export type ProposedComponentInput = {
  proposed_component_id: string
  proposed_component_name?: string | null
  proposed_component_role: string
  proposed_component_structure?: string | null
  proposed_contact_pathway?: string | null
  proposed_is_primary_contact?: boolean
  proposed_is_score_driving?: boolean
  /** Closed vocabulary suggestion — not score-authoritative until locked package. */
  proposed_canonical_material_id: string | null
  proposed_canonical_material_label?: string | null
  material_mapping_evidence_claim_ids?: string[]
  proposal_confidence?: 'high' | 'medium' | 'low' | string | null
  proposal_notes?: string | null
  evidence_support_refs?: ProposedEvidenceSupportRef[]
}

export type ProposedProductContext = {
  product_id: string | null
  evidence_id: string | null
  category?: string | null
  subcategory?: string | null
  product_type?: string | null
  brand?: string | null
  product_name?: string | null
  variant_or_sku?: string | null
  source_support_ids?: string[]
}

export type ProposedLayer4aFlags = {
  candidate_only?: boolean
  credit_candidates?: string[]
  deduction_candidates?: string[]
  positive_adjustments?: string[]
  negative_adjustments?: string[]
  unknown_coating_cap_applies?: boolean
  proprietary_ceramic_formula_undisclosed?: boolean
}

/** Agent 1 proposed closed fields (pre human review). Phase 2 expanded shape. */
export type ProposedInputPayload = {
  schema_version: string
  /** Explicit marker that this payload is suggestion-only. */
  non_authoritative?: boolean
  product_context?: ProposedProductContext
  proposed_components: ProposedComponentInput[]
  proposed_lab_evidence_status?: string | null
  proposed_lab_applies_to?: string | null
  proposed_lab_applies_to_scope?: string | null
  proposed_non_detect_mitigation_candidate?: boolean
  proposed_lab_source_ids?: string[]
  proposed_analytes_tested?: string[]
  proposed_result_language?: string | null
  proposed_lab_notes?: string | null
  proposed_proprietary_status?: string | null
  proposed_pfas_ptfe_status?: string | null
  proposed_coating_family_status?: string | null
  proposed_unknown_coating_cap_candidate?: boolean
  proposed_known_category_proprietary_candidate?: boolean
  proposed_pfas_status?: string | null
  proposed_ptfe_status?: string | null
  proposed_use_condition_override?: boolean
  proposed_contact_intimacy_override?: number | null
  proposed_severity_override?: number | null
  proposed_duration_override?: number | null
  proposed_use_condition_override_reason?: string | null
  proposed_use_condition_source_ids?: string[]
  proposed_use_condition_overrides?: {
    contact_intimacy?: number | null
    exposure_severity?: number | null
    exposure_duration?: number | null
    notes?: string | null
  } | null
  proposed_layer_4a_flags?: ProposedLayer4aFlags | null
  proposed_layer_4a_credit_candidates?: string[]
  proposed_layer_4a_deduction_candidates?: string[]
  proposed_layer_4a_notes?: string | null
  proposed_layer_4a_source_ids?: string[]
  proposed_cap_flag?: boolean
  proposed_cap_reason?: string | null
  proposed_escalator_candidate?: boolean | string | null
  proposed_escalator_reason?: string | null
  proposed_cap_escalator_source_ids?: string[]
  proposed_transparency_badge?: string | null
  proposed_badge_basis?: string | null
  proposed_badge_notes?: string | null
  proposed_badge_source_ids?: string[]
  /** Phase 1 legacy flat aliases (optional). */
  proposed_layer_4a_flags_legacy?: ProposedLayer4aFlags | null
  proposed_cap_flag_legacy?: boolean
  proposed_escalator_candidate_legacy?: boolean | string | null
  evidence_support_refs?: ProposedEvidenceSupportRef[]
}

/** Human-reviewed component — uses confirmed/reviewed canonical ID (never locked_*). */
export type ReviewedComponentInput = {
  reviewed_component_id: string
  reviewed_component_name: string
  reviewed_component_role: string
  reviewed_component_structure: string
  reviewed_contact_pathway: string
  reviewed_is_primary_contact: boolean
  reviewed_is_score_driving: boolean
  /** Human-confirmed canonical material (not score-authoritative until lock in Phase 5). */
  confirmed_canonical_material_id: string | null
  /** Alias accepted in reviewed_payload; prefer confirmed_canonical_material_id. */
  reviewed_canonical_material_id?: string | null
  reviewed_canonical_material_label?: string | null
  evidence_support_refs?: ProposedEvidenceSupportRef[]
  reviewer_notes?: string | null
}

/** Human-reviewed closed fields stored on agent1_proposed_inputs.reviewed_payload. */
export type ReviewedInputPayload = {
  schema_version: string
  /** Explicit marker — human-reviewed but not system-validated or locked. */
  non_authoritative?: boolean
  not_validated?: boolean
  not_locked?: boolean
  product_context?: ProposedProductContext
  reviewed_components: ReviewedComponentInput[]
  reviewed_lab_evidence_status?: string | null
  reviewed_lab_applies_to?: string | null
  reviewed_lab_applies_to_scope?: string | null
  reviewed_non_detect_mitigation_candidate?: boolean
  reviewed_lab_source_ids?: string[]
  reviewed_analytes_tested?: string[]
  reviewed_result_language?: string | null
  reviewed_lab_notes?: string | null
  reviewed_proprietary_status?: string | null
  reviewed_pfas_ptfe_status?: string | null
  reviewed_coating_family_status?: string | null
  reviewed_unknown_coating_cap_candidate?: boolean
  reviewed_known_category_proprietary_candidate?: boolean
  reviewed_pfas_status?: string | null
  reviewed_ptfe_status?: string | null
  reviewed_use_condition_override?: boolean
  reviewed_contact_intimacy_override?: number | null
  reviewed_severity_override?: number | null
  reviewed_duration_override?: number | null
  reviewed_use_condition_override_reason?: string | null
  reviewed_use_condition_source_ids?: string[]
  reviewed_use_condition_overrides?: ProposedInputPayload['proposed_use_condition_overrides']
  reviewed_layer_4a_flags?: ProposedLayer4aFlags | null
  reviewed_layer_4a_credit_candidates?: string[]
  reviewed_layer_4a_deduction_candidates?: string[]
  reviewed_layer_4a_notes?: string | null
  reviewed_layer_4a_source_ids?: string[]
  reviewed_cap_flag?: boolean
  reviewed_cap_reason?: string | null
  reviewed_escalator_candidate?: boolean | string | null
  reviewed_escalator_reason?: string | null
  reviewed_cap_escalator_source_ids?: string[]
  reviewed_transparency_badge?: string | null
  reviewed_badge_basis?: string | null
  reviewed_badge_notes?: string | null
  reviewed_badge_source_ids?: string[]
  review_notes?: string | null
  review_change_summary?: string | null
  reviewed_at?: string | null
  reviewed_by?: string | null
  reviewer_notes?: string | null
  evidence_support_refs?: ProposedEvidenceSupportRef[]
}

export type SystemValidationMaterialLookupResult = {
  reviewed_component_id: string
  reviewed_component_name?: string | null
  reviewed_component_role?: string | null
  reviewed_is_score_driving?: boolean
  confirmed_canonical_material_id?: string | null
  reviewed_canonical_material_id?: string | null
  resolved_material_taxonomy_id?: string | null
  alias_applied?: boolean
  canonical_material_lookup_status?: 'found' | 'alias_resolved' | 'missing' | 'expansion_required'
  canonical_material_name?: string | null
  material_hazard_value?: number | null
  base_migration_value?: number | null
  adjusted_migration_value?: number | null
  material_lookup_version?: string | null
  material_lookup_notes?: string | null
}

export type SystemValidationMitigationResult = {
  reviewed_component_id: string
  reviewed_non_detect_mitigation_candidate?: boolean
  non_detect_mitigation_eligible_by_material?: boolean
  non_detect_evidence_qualifies?: boolean
  non_detect_validation_status?: string
  mitigation_factor?: number | null
  adjusted_migration_value?: number | null
  material_hazard_value?: number | null
  base_migration_value?: number | null
  mitigation_notes?: string | null
}

export type SystemValidationUseConditionResult = {
  reviewed_component_id: string
  category_default_contact_intimacy?: number | null
  category_default_severity?: number | null
  category_default_duration?: number | null
  reviewed_use_condition_override?: boolean
  final_contact_intimacy?: number | null
  final_exposure_severity?: number | null
  final_exposure_duration?: number | null
  use_condition_validation_status?: string
  use_condition_notes?: string | null
}

export type SystemValidationComponentResult = {
  proposed_component_id: string
  canonical_material_lookup_status?: 'found' | 'missing' | 'expansion_required'
  material_hazard_lookup_result?: number | null
  base_migration_lookup_result?: number | null
  non_detect_mitigation_eligible?: boolean
  non_detect_evidence_qualified?: boolean
  adjusted_migration_result?: number | null
  category_default_contact_intimacy?: number | null
  category_default_severity?: number | null
  category_default_duration?: number | null
  final_contact_intimacy?: number | null
  final_exposure_severity?: number | null
  final_exposure_duration?: number | null
}

/** Phase 4 system validation payload schema version. */
export const VALIDATION_PAYLOAD_SCHEMA_VERSION = '4.0.0' as const

/** System validation detail payload. */
export type SystemValidationPayload = {
  schema_version: string
  not_locked?: boolean
  not_score_authoritative?: boolean
  product_id?: string | null
  proposed_input_id?: string | null
  reviewed_at?: string | null
  validated_at?: string | null
  validation_summary?: string | null
  methodology_version?: string | null
  material_lookup_source?: string | null
  material_lookup_version?: string | null
  material_lookups?: SystemValidationMaterialLookupResult[]
  non_detect_mitigation?: SystemValidationMitigationResult[]
  use_conditions?: SystemValidationUseConditionResult[]
  reviewed_layer_4a_flags?: ProposedLayer4aFlags | null
  validated_layer_4a_flags?: ProposedLayer4aFlags | null
  layer_4a_credit_candidates?: Array<{ key: string; points: number }>
  layer_4a_deduction_candidates?: Array<{ key: string; points: number }>
  cap_validation?: Record<string, unknown> | null
  escalator_validation_detail?: Record<string, unknown> | null
  transparency_badge_validation_detail?: Record<string, unknown> | null
  unresolved_canonical_material_ids?: string[]
  material_lookup_sync_notes?: string[]
  components: SystemValidationComponentResult[]
  layer_4a_validation_status?: 'passed' | 'failed' | 'review_required'
  layer_4a_total_validated?: number | null
  layer_4a_notes?: string | null
  unknown_coating_cap_validation?: boolean
  known_category_proprietary_validation?: boolean
  escalator_validation_passed?: boolean
  transparency_badge_validation_passed?: boolean
  illegal_combo_flags?: string[]
}

export type ValidationBlocker = {
  code: string
  message: string
  field_path?: string | null
}

export type ValidationWarning = {
  code: string
  message: string
  field_path?: string | null
}

/** Phase 5 immutable locked input package schema version. */
export const LOCKED_PAYLOAD_SCHEMA_VERSION = '5.0.0' as const

/** Locked component row — uses locked_canonical_material_id only. */
export type LockedComponentInput = {
  locked_component_id: string
  locked_component_name: string
  locked_component_role: string
  locked_component_structure?: string | null
  locked_contact_pathway?: string | null
  locked_is_primary_contact: boolean
  locked_is_score_driving: boolean
  locked_canonical_material_id: string
  locked_canonical_material_name?: string | null
  locked_resolved_material_taxonomy_id?: string | null
  locked_material_hazard_value: number
  locked_base_migration_value: number
  locked_adjusted_migration_value: number
  locked_contact_intimacy: number
  locked_exposure_severity: number
  locked_exposure_duration: number
  locked_non_detect_mitigation_applied?: boolean
  locked_non_detect_mitigation_factor?: number | null
  locked_lab_evidence_status?: string | null
  locked_lab_applies_to?: string | null
  locked_proprietary_status?: string | null
  locked_pfas_ptfe_status?: string | null
  locked_source_support_ids?: string[]
  locked_component_notes?: string | null
  locked_escalator_multiplier?: number | null
}

/** Immutable Agent 3 input package (future read contract). */
export type LockedInputPayload = {
  schema_version: string
  locked_input_package_id?: string | null
  product_id?: string | null
  proposed_input_id?: string | null
  validation_id?: string | null
  evidence_id?: string | null
  methodology_version: string
  material_lookup_version: string
  locked_at?: string | null
  locked_by?: string | null
  source_reviewed_at?: string | null
  source_validated_at?: string | null
  lock_summary?: string | null
  locked_product_id: string
  locked_brand?: string | null
  locked_product_name?: string | null
  locked_category: string
  locked_subcategory: string
  locked_product_type?: string | null
  locked_variant_or_sku?: string | null
  locked_components: LockedComponentInput[]
  locked_layer_4a_flags?: ProposedLayer4aFlags | null
  locked_layer_4a_total: number
  locked_cap_triggered: boolean
  locked_cap_reason?: string | null
  locked_unknown_coating_cap_validation?: boolean
  locked_known_category_proprietary_validation?: boolean
  locked_escalator_candidate?: boolean | string | null
  locked_escalator_multiplier?: number | null
  locked_escalator_reason?: string | null
  locked_transparency_badge: string | null
  locked_badge_basis?: string | null
  locked_badge_notes?: string | null
  locked_lab_evidence_status?: string | null
  locked_non_detect_mitigation_applied?: boolean
  locked_source_support_ids?: string[]
  locked_evidence_claim_ids?: string[]
  locked_source_summary?: string | null
  locked_input_notes?: string | null
}

export type Agent1ProposedInput = {
  proposed_input_id: string
  product_id: string
  evidence_id: string
  agent1_run_id: string | null
  schema_version: string
  proposal_status: ProposedInputStatus
  proposed_payload: ProposedInputPayload
  reviewed_payload: ReviewedInputPayload | null
  reviewed_at: string | null
  reviewed_by: string | null
  created_by_system: string
  created_by: string | null
  created_at: string
  updated_at: string
}

export type Agent1SystemValidation = {
  validation_id: string
  product_id: string
  proposed_input_id: string
  schema_version: string
  validation_status: ValidationStatus
  validation_payload: SystemValidationPayload
  blockers: ValidationBlocker[]
  warnings: ValidationWarning[]
  validated_at: string | null
  created_at: string
  updated_at: string
}

export type Agent1LockedInput = {
  locked_input_id: string
  product_id: string
  proposed_input_id: string
  validation_id: string | null
  schema_version: string
  locked_input_status: LockedInputStatus
  locked_payload: LockedInputPayload
  lock_hash: string | null
  locked_at: string | null
  locked_by: string | null
  superseded_by: string | null
  created_at: string
  updated_at: string
}
