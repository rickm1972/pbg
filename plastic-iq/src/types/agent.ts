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
}

export type EvidenceFact = {
  fact_type: string
  fact_key: string
  fact_value: string | number | boolean | null
  confidence: ConfidenceLabel | string
  source_index: number | null
  excerpt: string
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
  claude_estimated_cost_usd?: number
  cache_read_input_tokens?: number
  cache_creation_input_tokens?: number
  anthropic_api_calls?: number
}

export type AgentMetadata = {
  model?: string
  agent_version?: string
  run_timestamp?: string
  provider?: string
  warnings?: string[]
  certifications_verified?: CertificationVerifiedRow[]
  minimum_threshold?: MinimumThreshold
  in_testing_queue?: boolean
  api_usage?: Agent1ApiUsage
}

export type ProductEvidence = {
  evidence_id: string
  product_id: string
  bundle_version: number
  review_status: string
  algorithm_version: string
  sources: EvidenceSource[]
  facts: EvidenceFact[]
  agent_metadata: AgentMetadata
  reviewer_notes: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  submitted_at: string | null
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
}

export type Agent1DashboardData = {
  products: ProductPipelineRow[]
  pendingReview: Array<{
    product: ProductPipelineRow
    evidence: ProductEvidence
  }>
  statusCounts: Record<string, number>
}

export type NormalizationComponent = {
  component_name: string
  material: string
  material_hazard: number
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
}
