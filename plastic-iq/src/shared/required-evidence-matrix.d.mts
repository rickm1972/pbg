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

export {
  validateRequiredEvidence,
  applyRequiredEvidenceValidation,
  resolveSubcategoryKey,
  getMatrixForSubcategory,
  SUBCATEGORY_MATRICES,
} from './required-evidence-matrix/index.mjs'
