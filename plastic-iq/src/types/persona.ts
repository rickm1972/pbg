export type PersonaWorkflowStatus = 'draft' | 'approved' | 'rejected'

export type PersonaRunStatus = 'running' | 'partial' | 'failed' | 'succeeded'

export type PersonaContent = {
  persona_name?: string
  persona_nickname?: string
  segment?: string
  summary_one_liner?: string
  summary?: string
  demographics?: string
  role_lifestyle_context?: string
  main_goal?: string
  main_pain_point?: string
  buying_trigger?: string
  barriers?: string
  decision_criteria?: string
  information_needs?: string
  trusted_sources?: string
  channels?: string
  messaging_angle?: string
  objections?: string
  proof_needed?: string
  cta?: string
  voice_of_customer_quote?: string
  data_sources?: string
  pac_awareness_level?: string
  overwhelm_risk?: string
  safety_motivation?: string
  replacement_readiness?: string
  trust_threshold?: string
  eighty_twenty_mindset_fit?: string
  product_category_priority?: string
  risk_communication_sensitivity?: string
  preferred_safer_alternative_type?: string
  certification_literacy?: string
}

export type PersonaSource = {
  source_id?: string
  url: string
  title?: string
  excerpt?: string
  angle_id?: string
  source_type?: 'authoritative' | 'voc' | 'unknown'
}

export type PersonaApiUsage = {
  perplexity_requests?: number
  perplexity_input_tokens?: number
  perplexity_output_tokens?: number
  perplexity_estimated_cost_usd?: number
  claude_input_tokens?: number
  claude_output_tokens?: number
  claude_estimated_cost_usd?: number
  total_estimated_cost_usd?: number
  source_count?: number
}

export type PersonaRunMetadata = {
  run_status?: PersonaRunStatus
  stage?: 'retrieval' | 'synthesis' | 'done'
  target_segment?: string
  angles_completed?: string[]
  angles_failed?: Array<{ angle_id: string; error: string }>
  retrieval?: unknown[]
  api_usage?: PersonaApiUsage
  synthesis_model?: string
  logs?: string[]
  error_message?: string | null
  finished_at?: string
  duplicated_from?: string
  note?: string
}

export type PersonaRow = {
  persona_id: string
  persona_name: string | null
  segment: string | null
  target_segment: string
  status: PersonaWorkflowStatus
  persona_content: PersonaContent
  sources: PersonaSource[]
  run_metadata: PersonaRunMetadata
  segment_size_estimate: number | null
  conversion_rate_estimate: number | null
  ltv_estimate: number | null
  created_at: string
  updated_at: string
}
