/** Phase 7 — Agent 4 locked-output audit records (isolated from product_qa). */

export type Agent4LockedAuditStatus =
  | 'draft'
  | 'pending_review'
  | 'passed'
  | 'failed'
  | 'rejected'
  | 'superseded'

export type Agent4AuditIssue = {
  code: string
  message: string
}

export type Agent4ConsistencyCheck = {
  id: string
  pass: boolean
  message: string
}

export type Agent4LockedAuditPayload = {
  audited_locked_output_id: string
  audited_agent3_input_source: 'locked_input_package'
  agent4_input_source: 'agent3_locked_output'
  product_id: string
  locked_input_id: string
  lock_hash: string
  methodology_version: string
  material_lookup_version: string
  score_summary: {
    pac_safety_score: number
    tier: string
    transparency_badge: string | null
    weighted_npr: number
    raw_score_before_layer_4a: number
    layer_4a_total_applied: number
    cap_triggered: boolean
    final_score: number
  }
  component_count: number
  blocker_count: number
  warning_count: number
  checks_passed: number
  checks_failed: number
  publish_disabled_notice: string
}

export type Agent4LockedAuditRow = {
  locked_audit_id: string
  product_id: string
  locked_output_id: string
  locked_input_id: string
  lock_hash: string
  input_source: 'agent3_locked_output'
  methodology_version: string
  material_lookup_version: string
  audit_status: Agent4LockedAuditStatus
  audit_payload: Agent4LockedAuditPayload
  blockers: Agent4AuditIssue[]
  warnings: Agent4AuditIssue[]
  consistency_checks: Agent4ConsistencyCheck[]
  created_by_system: string
  created_at: string
  updated_at: string
  reviewed_at: string | null
  reviewed_by: string | null
  review_notes: string | null
  supersedes_audit_id: string | null
  superseded_by_audit_id: string | null
}
