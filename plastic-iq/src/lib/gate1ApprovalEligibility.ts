import type {
  ProductEvidence,
  RequiredEvidenceChecklistItem,
  RequiredEvidenceValidationPayload,
  StructuredEvidencePayload,
} from '../types/agent'
import {
  listIncompleteScoreDrivingExternalChecks as listIncompleteScoreDrivingExternalChecksMjs,
  listScoreDrivingReviewAcknowledgments as listScoreDrivingReviewAcknowledgmentsMjs,
  resolveLiveRequiredEvidenceValidation as resolveLiveRequiredEvidenceValidationMjs,
} from '../shared/agent1/gate1-approval-eligibility.mjs'

export {
  computeGate1ApprovalBlockers,
} from '../shared/agent1/gate1-approval-eligibility.mjs'

export function listScoreDrivingReviewAcknowledgments(
  validation: RequiredEvidenceValidationPayload | null | undefined,
): RequiredEvidenceChecklistItem[] {
  return listScoreDrivingReviewAcknowledgmentsMjs(validation) as RequiredEvidenceChecklistItem[]
}

export function listIncompleteScoreDrivingExternalChecks(
  validation: RequiredEvidenceValidationPayload | null | undefined,
): RequiredEvidenceChecklistItem[] {
  return listIncompleteScoreDrivingExternalChecksMjs(validation) as RequiredEvidenceChecklistItem[]
}

export function resolveLiveRequiredEvidenceValidation(
  structured: StructuredEvidencePayload | null | undefined,
  sources: ProductEvidence['sources'] = [],
  facts: ProductEvidence['facts'] = [],
): RequiredEvidenceValidationPayload | null {
  if (!structured) return null
  return resolveLiveRequiredEvidenceValidationMjs(structured, sources ?? [], facts ?? []) as RequiredEvidenceValidationPayload
}

export function isExternalChecksComplete(
  validation: RequiredEvidenceValidationPayload | null | undefined,
): boolean {
  return listIncompleteScoreDrivingExternalChecks(validation).length === 0
}
