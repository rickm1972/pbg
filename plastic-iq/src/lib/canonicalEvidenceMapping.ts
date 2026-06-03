import type { CanonicalFieldMapping, CanonicalMappingsPayload } from '../shared/canonical-taxonomy.d.mts'
import type { StructuredEvidencePayload } from '../types/agent'
import {
  applyCanonicalMappings,
  getCanonicalApprovalBlockers,
  isExpansionRequired,
  TAXONOMY_EXPANSION_REQUIRED,
  COOKWARE_SCORE_DRIVING_FIELDS,
  CANONICAL_TAXONOMY_COUNTS,
} from '../shared/canonical-taxonomy/index.mjs'
import {
  applyRequiredEvidenceValidation,
  validateRequiredEvidence,
} from '../shared/required-evidence-matrix/index.mjs'

export type { CanonicalFieldMapping, CanonicalMappingsPayload }
export {
  applyCanonicalMappings,
  getCanonicalApprovalBlockers,
  isExpansionRequired,
  TAXONOMY_EXPANSION_REQUIRED,
  COOKWARE_SCORE_DRIVING_FIELDS,
  CANONICAL_TAXONOMY_COUNTS,
}

export function ensureCanonicalMappingsOnStructured(
  structured: StructuredEvidencePayload,
  sources: { url: string; page_excerpt?: string; title?: string }[] = [],
  facts: { fact_key: string; fact_value: unknown }[] = [],
  options?: { force?: boolean },
): CanonicalMappingsPayload {
  const existing = structured.canonical_mappings
  if (
    !options?.force &&
    existing?.schema_version === '3.5' &&
    existing.primary_contact_material_id
  ) {
    applyRequiredEvidenceValidation(structured as Record<string, unknown>, sources, { facts })
    return existing as CanonicalMappingsPayload
  }
  const mappings = applyCanonicalMappings(structured as Record<string, unknown>, sources, {
    facts,
  }) as CanonicalMappingsPayload
  return mappings
}

export { applyRequiredEvidenceValidation, validateRequiredEvidence }

export function getRequiredEvidenceApprovalBlockers(
  structured: StructuredEvidencePayload | null | undefined,
): string[] {
  const v = structured?.required_evidence_validation
  if (!v?.approval_blockers?.length) return []
  return v.approval_blockers
}
