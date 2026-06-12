/** Phase 8 — locked-chain snapshot drafts (isolated from published_display_snapshots). */

export type LockedSnapshotDraftStatus =
  | 'draft'
  | 'ready_for_review'
  | 'approved_for_future_publish'
  | 'rejected'
  | 'superseded'

export type LockedSnapshotDraftComponentSummary = {
  component_name: string
  component_role: string
  score_driving: boolean
  locked_canonical_material_id: string
  locked_resolved_material_taxonomy_id: string | null
  contact_intimacy: number
  hazard_used: number
  adjusted_migration_used: number
  non_detect_mitigation_applied?: boolean
  mitigation_factor?: number | null
  npr_after_escalator: number
}

export type LockedSnapshotDraftPayload = {
  input_source: 'agent4_locked_audit'
  source_chain: 'locked_pipeline_draft'
  publish_enabled: false
  public_visible: false
  product_id: string
  product_name: string | null
  brand: string | null
  category: string | null
  subcategory: string | null
  image_url: string | null
  source_url: string | null
  lock_hash: string
  locked_input_id: string
  locked_output_id: string
  locked_audit_id: string
  methodology_version: string
  material_lookup_version: string
  pac_safety_score: number
  tier: string
  transparency_badge: string | null
  tier_color_key: string | null
  why_this_score_draft: string | null
  badge_basis: string | null
  source_summary: string | null
  documentation_gaps: string | null
  known_limitations: string | null
  publish_disabled_notice: string
}

export type LockedSnapshotDraftAuditSummary = {
  audit_status: string
  blocker_count: number
  warning_count: number
  blockers: Array<{ code: string; message: string }>
  warnings: Array<{ code: string; message: string }>
  checks_passed: number
  checks_failed: number
}

export type LockedSnapshotDraftRow = {
  locked_snapshot_draft_id: string
  product_id: string
  locked_input_id: string
  locked_output_id: string
  locked_audit_id: string
  lock_hash: string
  input_source: 'agent4_locked_audit'
  methodology_version: string
  material_lookup_version: string
  snapshot_payload: LockedSnapshotDraftPayload
  display_payload: Record<string, unknown>
  score_payload: Record<string, unknown>
  math_breakdown: Record<string, unknown>
  audit_summary: LockedSnapshotDraftAuditSummary
  draft_status: LockedSnapshotDraftStatus
  created_by_system: string
  created_at: string
  updated_at: string
  reviewed_at: string | null
  reviewed_by: string | null
  review_notes: string | null
  supersedes_draft_id: string | null
  superseded_by_draft_id: string | null
}

export type LockedSnapshotDraftGateResult = {
  ok: boolean
  blockers: Array<{ code: string; message: string }>
}
