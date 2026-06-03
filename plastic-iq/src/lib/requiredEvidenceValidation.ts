import type { RequiredEvidenceValidationPayload, StructuredEvidencePayload } from '../types/agent'
import {
  applyRequiredEvidenceValidation,
  validateRequiredEvidence,
  resolveSubcategoryKey,
  getMatrixForSubcategory,
  SUBCATEGORY_MATRICES,
} from '../shared/required-evidence-matrix/index.mjs'
import { isFormulationSubcategory as isFormulationSubcategoryKey } from '../shared/required-evidence-matrix/resolve-subcategory.mjs'

export type { RequiredEvidenceValidationPayload }
export {
  applyRequiredEvidenceValidation,
  validateRequiredEvidence,
  resolveSubcategoryKey,
  getMatrixForSubcategory,
  SUBCATEGORY_MATRICES,
}

export function isFormulationSubcategory(subcategory: string | null | undefined): boolean {
  return isFormulationSubcategoryKey(subcategory)
}

export function getRequiredEvidenceValidation(
  structured: StructuredEvidencePayload | null | undefined,
): RequiredEvidenceValidationPayload | null {
  return structured?.required_evidence_validation ?? null
}
