/** Phase 6.7 — Agent 3 locked-input output records (isolated from product_scores). */

export type Agent3LockedOutputReviewStatus =
  | 'draft'
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'superseded'

export type Agent3LockedOutputScorePayload = {
  pac_safety_score: number
  tier: string
  transparency_badge: string | null
  weighted_npr: number
  raw_score_before_layer_4a: number
  layer_4a_total_applied: number
  score_after_layer_4a: number
  cap_triggered: boolean
  cap_value: number | null
  score_after_cap: number
  final_score: number
  escalator_applied: string | null
  input_source: 'locked_input_package'
}

export type Agent3LockedOutputComponentMath = {
  component_name: string
  component_role: string
  score_driving?: boolean
  locked_canonical_material_id: string
  locked_resolved_material_taxonomy_id: string | null
  hazard_used: number
  base_migration: number
  adjusted_migration_used: number
  contact_intimacy: number
  exposure_severity: number
  exposure_duration: number
  non_detect_mitigation_applied?: boolean
  mitigation_factor?: number | null
  component_weight?: number
  npr_before_escalator: number
  escalator_multiplier: number
  npr_after_escalator: number
  inert_protection_applied?: boolean
}

export type Agent3LockedOutputMathBreakdown = {
  components: Agent3LockedOutputComponentMath[]
  weighted_npr_breakdown: Record<string, unknown>
  weighted_npr: number
  raw_score_before_layer_4a: number
  raw_score_formula: string | null
  layer_4a_total_applied: number
  score_after_layer_4a: number
  cap_triggered: boolean
  cap_value: number | null
  score_after_cap: number
  final_score: number
}

export type Agent3LockedOutputDisplayPayload = {
  product_name: string | null
  brand: string | null
  transparency_badge: string | null
  badge_basis: string | null
  layer_4a_total: number
  cap_triggered: boolean
  primary_materials: Array<{ name: string; role: string; canonical_id: string }>
  source_summary: string | null
  locked_input_warning: string
  why_this_score_draft: string | null
}

export type Agent3LockedOutputRow = {
  locked_output_id: string
  product_id: string
  locked_input_id: string
  lock_hash: string
  input_source: 'locked_input_package'
  methodology_version: string
  material_lookup_version: string
  score_payload: Agent3LockedOutputScorePayload
  math_breakdown: Agent3LockedOutputMathBreakdown
  display_payload: Agent3LockedOutputDisplayPayload | null
  review_status: Agent3LockedOutputReviewStatus
  created_by_system: string
  created_at: string
  updated_at: string
  reviewed_at: string | null
  reviewed_by: string | null
  review_notes: string | null
  supersedes_output_id: string | null
  superseded_by_output_id: string | null
}
