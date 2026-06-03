export const AGENT_STATUSES = [
  'unscored',
  'evidence_pending',
  'evidence_in_progress',
  'evidence_awaiting_review',
  'evidence_approved',
  'evidence_rejected',
  'normalization_pending',
  'normalization_in_progress',
  'normalization_awaiting_review',
  'normalization_approved',
  'normalization_rejected',
  'in_testing_queue',
  'scoring_pending',
  'scoring_in_progress',
  'scoring_review_pending',
  'scoring_awaiting_review',
  'scoring_approved',
  'scoring_rejected',
  'qa_pending',
  'qa_in_progress',
  'qa_awaiting_review',
  'qa_approved',
  'qa_rejected',
  'ready_for_publish',
  'published',
] as const

export type AgentStatus = (typeof AGENT_STATUSES)[number]

/** Phase 1 public visibility gate (independent of evidence approval). */
export const PUBLISH_STATUSES = [
  'draft',
  'ready_to_publish',
  'published',
  'unpublished',
] as const

export type PublishStatus = (typeof PUBLISH_STATUSES)[number]

/** product_evidence.review_status (evidence version lifecycle). */
export const EVIDENCE_REVIEW_STATUSES = [
  'draft',
  'pending_review',
  'approved',
  'rejected',
  'superseded',
] as const

export type EvidenceReviewStatus = (typeof EVIDENCE_REVIEW_STATUSES)[number]

/** scoring_inputs.review_status (normalization version lifecycle). */
export const SCORING_INPUT_REVIEW_STATUSES = [
  'draft',
  'pending_review',
  'approved',
  'rejected',
  'superseded',
] as const

export type ScoringInputReviewStatus = (typeof SCORING_INPUT_REVIEW_STATUSES)[number]

/** Per-field provenance entry (Phase 1 JSONB map on product_evidence.field_provenance). */
export type EvidenceFieldProvenanceEntry = {
  value: string
  source_url: string | null
  source_quote: string | null
  confidence_label: string | null
  source_fetch_date: string | null
  content_hash: string | null
}

export type ConfidenceLabel =
  | 'manufacturer confirmed'
  | 'retailer confirmed'
  | 'certification verified'
  | 'inferred from description'
  | 'inferred from category pattern'
  | 'proprietary or undisclosed'
  | 'claim not independently verified'
  | 'unknown'

export type EvidenceSource = {
  source_type: string
  url: string
  title: string
  fetched_at: string
  page_excerpt?: string
}

export type EvidenceFact = {
  fact_type: string
  fact_key: string
  fact_value: string | number | boolean | null
  confidence: ConfidenceLabel | string
  source_index: number | null
  excerpt: string
  source_url?: string | null
}

export type MinimumThreshold = {
  met: boolean
  checks: Record<string, boolean>
  failures?: string[]
}

export type CertificationVerifiedRow = {
  certification_name: string
  source_url: string | null
  found_in_page_content: boolean
  action_taken: string
}

export type Agent1ApiUsage = {
  input_tokens?: number
  output_tokens?: number
  web_search_requests?: number
  estimated_cost_usd?: number
  total_estimated_cost_usd?: number
  perplexity_search_requests?: number
  perplexity_estimated_cost_usd?: number
  amazon_anthropic_estimated_cost_usd?: number
  claude_estimated_cost_usd?: number
  cache_read_input_tokens?: number
  cache_creation_input_tokens?: number
  anthropic_api_calls?: number
}

export type StructuredVerifiedCert = {
  cert_name: string
  /** Certifying-body registry URL (not manufacturer marketing page). */
  source_url?: string | null
  registry_url?: string | null
  page_source_url?: string | null
  retrieved_date?: string
}

export type StructuredUnverifiedCert = {
  cert_name: string
  registry_check_result: string
  claim_source_url?: string | null
}

export type StructuredProductIdentity = {
  product_name?: string
  brand?: string
  subcategory?: string
  sku_or_model?: string | null
}

export type StructuredRetailerLinks = {
  amazon_url?: string
  manufacturer_direct_url?: string
}

export type StructuredEvidencePayload = {
  schema_version?: string
  product_identity?: StructuredProductIdentity
  retailer_links?: StructuredRetailerLinks
  primary_contact_material?: {
    material_identity?: string
    undisclosed_code?: string | null
    source_url?: string | null
    confidence_label?: string
  }
  certifications?: {
    claimed_certifications?: string[]
    verified_certifications?: StructuredVerifiedCert[]
    claimed_but_not_verified?: StructuredUnverifiedCert[]
  }
  safety_claims?: Record<string, { claimed?: boolean; source_url?: string | null; structural_guarantee?: boolean }>
  ingredient_list?: { ingredients?: string[]; source_url?: string | null } | null
  secondary_components?: Array<{
    component_role: string
    material_identity?: string | null
    source_url?: string | null
    confidence_label?: string
  }>
  coatings_and_finishes?: Array<{ coating_name: string; coating_type: string; source_url?: string | null }>
  product_use_case?: string
  /** Phase 3.5: deterministic canonical IDs for score-driving fields (Agent 2 input). */
  canonical_mappings?: CanonicalMappingsPayload
  /** Phase 3.6: required evidence matrix validation for Gate 1 approval. */
  required_evidence_validation?: RequiredEvidenceValidationPayload
  /** Phase 3.7: Agent 1 targeted retrieval results for required external checks. */
  required_check_results?: RequiredCheckResult[]
}

export type RequiredCheckResult = {
  check_id: string
  status: 'passed' | 'missing' | 'not_applicable' | 'failed'
  source_url: string | null
  source_quote: string | null
  canonical_ids_added: string[]
  retrieval_attempts: Array<{
    goal?: string
    query?: string
    result_count?: number
    urls?: string[]
    error?: string
  }>
  timestamp: string
  detail?: string | null
}

export type RequiredEvidenceCheckStatus = 'passed' | 'missing' | 'not_applicable' | 'review_required'
export type RequiredEvidenceSeverity = 'blocker' | 'warning' | 'info'

export type RequiredEvidenceChecklistItem = {
  id: string
  label: string
  category: string
  status: RequiredEvidenceCheckStatus
  severity: RequiredEvidenceSeverity
  score_driving: boolean
  field_path?: string
  pattern_trigger?: string | null
  source_url?: string | null
  source_quote?: string | null
  detail?: string | null
}

export type RequiredEvidenceValidationPayload = {
  schema_version: string
  subcategory_key: string
  matrix_display_label?: string
  evaluated_at: string
  summary: {
    required_fields_complete: boolean
    required_external_checks_complete: boolean
    missing_fields: string[]
    score_blocking_gaps: number
    non_score_gaps: number
    product_identity_verified: boolean
    approval_blocked: boolean
    active_triggers?: string[]
    formulation_pipeline_disabled?: boolean
  }
  checklist_items: RequiredEvidenceChecklistItem[]
  approval_blockers: string[]
}

export type CanonicalFieldMapping = {
  field_key: string
  raw_value: string
  canonical_id: string
  mapping_rule_id: string | null
  source_url: string | null
  source_quote: string | null
  confidence_label: string | null
  display_label?: string | null
  taxonomy_file?: string | null
  agent2_material_id?: string | null
  claimed?: boolean
}

export type CanonicalMappingsPayload = {
  schema_version: string
  primary_contact_material_id?: CanonicalFieldMapping
  substrate_material_id?: CanonicalFieldMapping
  coating_modifier_id?: CanonicalFieldMapping
  pfas_status_id?: CanonicalFieldMapping
  safety_claim_ids?: Record<string, CanonicalFieldMapping>
  regulatory_flag_ids?: CanonicalFieldMapping[]
  certification_ids?: Record<string, CanonicalFieldMapping>
  blockers?: string[]
}

export type FieldEditAuditEntry = {
  path: string
  prior_value: string | null
  new_value: string
  edited_by: string
  edited_at: string
}

export type AgentMetadata = {
  model?: string
  agent_version?: string
  run_timestamp?: string
  provider?: string
  warnings?: string[]
  certifications_verified?: CertificationVerifiedRow[]
  structured_evidence?: StructuredEvidencePayload
  minimum_threshold?: MinimumThreshold
  in_testing_queue?: boolean
  api_usage?: Agent1ApiUsage
  /** Gate 1 human edits (draft / pending_review only). */
  field_edit_audit?: FieldEditAuditEntry[]
}

export type ProductEvidence = {
  evidence_id: string
  product_id: string
  bundle_version: number
  review_status: EvidenceReviewStatus | string
  algorithm_version: string
  sources: EvidenceSource[]
  facts: EvidenceFact[]
  agent_metadata: AgentMetadata
  /** Dot-path keys → provenance entries (immutable after approval). */
  field_provenance?: Record<string, EvidenceFieldProvenanceEntry>
  reviewer_notes: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  pending_review_at: string | null
  approved_at: string | null
  created_at: string
  updated_at: string
}

export type ProductPipelineRow = {
  product_id: string
  product_name: string
  brand: string | null
  category: string | null
  subcategory: string | null
  agent_status: AgentStatus | string
  score_basis?: string | null
  testing_queue_reason?: string | null
  active_evidence_id?: string | null
  publish_status?: PublishStatus | string | null
}

export type Agent1ReviewQueueItem = {
  product: ProductPipelineRow
  evidence: ProductEvidence | null
  /** Set when agent_status is evidence_awaiting_review but bundle join failed or status mismatches. */
  evidenceMismatch?: 'draft_not_pending_review' | 'no_pending_review_row'
}

export type Agent1DashboardData = {
  products: ProductPipelineRow[]
  pendingReview: Agent1ReviewQueueItem[]
  /** Reserved; validation products use pendingReview when awaiting review. */
  validationRunQueue: Agent1ReviewQueueItem[]
  /** Last Agent 1 run failed or did not pass threshold (draft evidence if saved). */
  heldRuns: Agent1ReviewQueueItem[]
  statusCounts: Record<string, number>
}

export type NormalizationComponent = {
  component_name: string
  component_role?: string
  role?: string
  material_id?: string
  material: string
  material_hazard: number
  base_migration_potential?: number
  adjusted_migration_potential: number
  contact_intimacy: number
  exposure_severity: number
  severity_justification: string
  exposure_duration: number
  duration_justification: string
  inert_protection_applies?: boolean
  material_hazard_table_entry?: string
  migration_table_entry?: string
  data_confidence?: string
  evidence_source?: unknown
  rationale?: string
}

export type NormalizationLayer4aAdjustment = {
  reason?: string
  label?: string
  basis?: string
  adjustment?: string
  value?: number
  points?: number
}

export type NormalizationLayer4a = {
  positive_adjustments?: Array<string | NormalizationLayer4aAdjustment>
  negative_adjustments?: Array<string | NormalizationLayer4aAdjustment>
  net_adjustment?: number
  unknown_coating_cap_applies?: boolean
  oral_contact_unknown_plastic_cap_applies?: boolean
}

export type NormalizationLayer4b = {
  transparency_badge?: string
  confidence_interval?: number
  badge_justification?: string
}

export type NormalizationMetadata = {
  agent_version?: string
  algorithm_version?: string
  description_generator_version?: string
  run_timestamp?: string
}

export type NormalizationInputs = {
  product_id: string
  evidence_id: string
  product_category_default?: string
  normal_intended_use?: string
  common_foreseeable_use?: string
  is_formulation_product?: boolean
  components: NormalizationComponent[]
  layer_4a?: NormalizationLayer4a
  layer_4b?: NormalizationLayer4b
  human_review_required?: boolean
  human_review_reason?: string | null
  normalization_notes?: string
  normalization_metadata?: NormalizationMetadata
  /** Step 7 — deterministic copy for public product page */
  product_description?: string | null
  status?: string
  flagged_missing_fields?: string[]
}

export type ScoringInputRow = {
  input_id: string
  product_id: string
  evidence_id: string
  agent_version: string | null
  algorithm_version: string
  run_timestamp: string
  inputs: NormalizationInputs
  review_status: string
  human_reviewer: string | null
  review_timestamp: string | null
  review_notes: string | null
  human_review_required: boolean
  human_review_reason: string | null
  primary_material_options?: string[] | null
  secondary_materials_options?: string[] | null
  coatings_finishes_options?: string[] | null
  use_conditions_options?: string[] | null
  disclosure_quality_options?: string[] | null
  certifications_options?: string[] | null
}

export type ProductScoreRow = {
  score_id: string
  product_id: string
  input_id: string | null
  pac_safety_score: number
  tier: string
  displayed_confidence_range: string | null
  transparency_badge: string | null
  weighted_npr: number
  component_nprs: {
    components?: Array<Record<string, unknown>>
    weighted_npr?: number
  }
  escalator_applied: string | null
  layer_4a_net: number
  ingredient_transparency_score: number | null
  explanation_draft: string | null
  algorithm_version: string
  run_timestamp: string
  review_status: string
  reviewer: string | null
  review_timestamp: string | null
  review_notes: string | null
}

export type QaCheckStatus = 'pass' | 'flag' | 'skip' | 'error'

export type QaFlag = {
  code: string
  message: string
  severity?: 'info' | 'warning' | 'critical'
  context?: Record<string, unknown>
}

export type ProductQaChecks = {
  certification_audit: {
    status: QaCheckStatus
    flags: QaFlag[]
    certifications_verified: CertificationVerifiedRow[]
    audited_claim_count: number
  }
  layer_4a_audit: {
    status: QaCheckStatus
    flags: QaFlag[]
    positives_audited: number
    negatives_audited: number
    net_adjustment_reported: number
    net_adjustment_recomputed: number
  }
  score_sanity: {
    status: QaCheckStatus
    flags: QaFlag[]
    subcategory: string | null
    product_score: number
    peer_median: number | null
    peer_count: number
    delta_from_median: number | null
    skip_reason?: string
  }
  evidence_gaps: {
    status: QaCheckStatus
    flags: QaFlag[]
    primary_contact_components: Array<{
      component_name: string
      contact_intimacy: number
      material: string
      material_confidence: string
    }>
  }
  explanation_accuracy: {
    status: QaCheckStatus
    flags: QaFlag[]
    issues: string[]
  }
}

export type ProductQaRow = {
  qa_id: string
  product_id: string
  evidence_id: string
  input_id: string
  score_id: string
  algorithm_version: string
  agent_version: string
  run_timestamp: string
  overall_status: 'pass' | 'flag' | 'error'
  human_review_required: boolean
  checks: ProductQaChecks
  certifications_verified: Array<
    CertificationVerifiedRow & { product_level?: boolean; source_index?: number }
  >
  review_status: string
  reviewer: string | null
  review_timestamp: string | null
  review_notes: string | null
  warnings: string[]
}

export type Agent4DashboardData = {
  products: ProductPipelineRow[]
  pendingReview: Array<{
    product: ProductPipelineRow
    qa: ProductQaRow
    score: ProductScoreRow
  }>
  runnable: ProductPipelineRow[]
  pendingQaByProductId: Record<string, ProductQaRow>
  approvedQaByProductId: Record<string, ProductQaRow>
  latestQaByProductId: Record<string, ProductQaRow>
  approvedScoreByProductId: Record<string, ProductScoreRow>
  scoreById: Record<string, ProductScoreRow>
  statusCounts: Record<string, number>
}

export type Agent3DashboardData = {
  products: ProductPipelineRow[]
  pendingReview: Array<{
    product: ProductPipelineRow
    productScore: ProductScoreRow
  }>
  /** Latest approved score per product (for All tab). */
  approvedByProductId: Record<string, ProductScoreRow>
  /** Most recent score row per product, any status. */
  latestScoreByProductId: Record<string, ProductScoreRow>
  /** Layer 4A from linked scoring_inputs (keyed by input_id). */
  layer4aByInputId: Record<string, NormalizationLayer4a | undefined>
  runnable: ProductPipelineRow[]
  statusCounts: Record<string, number>
}

export type Agent2DashboardData = {
  products: ProductPipelineRow[]
  pendingReview: Array<{
    product: ProductPipelineRow
    scoringInput: ScoringInputRow
  }>
  testingQueue: Array<{
    product: ProductPipelineRow
    scoringInput: ScoringInputRow | null
  }>
  statusCounts: Record<string, number>
  /** Most recent scoring_inputs row per product (any review_status). */
  latestScoringByProductId: Record<string, ScoringInputRow>
}
