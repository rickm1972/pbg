import type { CanonicalFieldMapping, CanonicalMappingsPayload } from '../shared/canonical-taxonomy.d.mts'
import type { StructuredEvidencePayload } from '../types/agent'
import {
  applyCanonicalMappings,
  getCanonicalApprovalBlockers,
  isExpansionRequired,
  isStructurallyPfasFreePrimary,
  TAXONOMY_EXPANSION_REQUIRED,
  COOKWARE_SCORE_DRIVING_FIELDS,
  CANONICAL_TAXONOMY_COUNTS,
} from '../shared/canonical-taxonomy/index.mjs'
import { reconcileCanonicalMappingsConfidence } from '../shared/canonical-taxonomy/confidence-label-consistency.mjs'
import { applyOutOfScopeSafetySignalPolicy } from '../shared/safety-signals/out-of-scope-policy.mjs'
import { assessTransparency } from '../shared/canonical-taxonomy/transparency-assessment.mjs'
import {
  applyRequiredEvidenceValidation,
  validateRequiredEvidence,
} from '../shared/required-evidence-matrix/index.mjs'

export type { CanonicalFieldMapping, CanonicalMappingsPayload }
export {
  applyCanonicalMappings,
  getCanonicalApprovalBlockers,
  isExpansionRequired,
  isStructurallyPfasFreePrimary,
  TAXONOMY_EXPANSION_REQUIRED,
  COOKWARE_SCORE_DRIVING_FIELDS,
  CANONICAL_TAXONOMY_COUNTS,
}

function structuralPfasClaimNeedsRefresh(
  existing: CanonicalMappingsPayload | undefined,
  structured?: StructuredEvidencePayload,
): boolean {
  const primaryId = existing?.primary_contact_material_id?.canonical_id ?? ''
  if (!isStructurallyPfasFreePrimary(primaryId)) return false
  if (!structured?.safety_claims?.pfas_free_claim?.claimed) return false
  const claims = existing?.safety_claim_ids ?? {}
  const verified = claims.pfas_free_claim_structurally_verified
  if (verified?.claimed && !isExpansionRequired(verified.canonical_id)) return false
  if (claims.pfas_free_marketing_claim?.claimed) return true
  return !verified?.claimed
}

function canonicalMappingsNeedReapply(
  existing: CanonicalMappingsPayload | undefined,
  structured?: StructuredEvidencePayload,
): boolean {
  if (!existing || existing.schema_version !== '3.8') return true
  if (!existing.primary_contact_material_id) return true
  if (structuralPfasClaimNeedsRefresh(existing, structured)) return true
  for (const row of COOKWARE_SCORE_DRIVING_FIELDS) {
    const field = row.field_key as keyof CanonicalMappingsPayload
    const mapping = existing[field]
    if (!mapping || typeof mapping !== 'object' || !('canonical_id' in mapping)) {
      return true
    }
    if (isExpansionRequired((mapping as CanonicalFieldMapping).canonical_id)) {
      return true
    }
  }
  for (const claim of Object.values(existing.safety_claim_ids ?? {})) {
    if (claim && isExpansionRequired(claim.canonical_id)) return true
  }
  for (const flag of existing.regulatory_flag_ids ?? []) {
    if (flag && isExpansionRequired(flag.canonical_id)) return true
  }
  return false
}

export function ensureCanonicalMappingsOnStructured(
  structured: StructuredEvidencePayload,
  sources: { url: string; page_excerpt?: string; title?: string }[] = [],
  facts: { fact_key: string; fact_value: unknown }[] = [],
  options?: { force?: boolean; agent_metadata?: { warnings?: string[] } },
): CanonicalMappingsPayload {
  const existing = structured.canonical_mappings
  const agentMeta = options?.agent_metadata ?? { warnings: [] }
  if (
    !options?.force &&
    !canonicalMappingsNeedReapply(existing as CanonicalMappingsPayload | undefined, structured)
  ) {
    applyRequiredEvidenceValidation(structured as Record<string, unknown>, sources, { facts })
    reconcileCanonicalMappingsConfidence(
      existing as CanonicalMappingsPayload,
      sources,
      structured as Record<string, unknown>,
    )
    structured.transparency_assessment = assessTransparency(
      structured as Record<string, unknown>,
      existing as CanonicalMappingsPayload,
      sources,
    )
    applyOutOfScopeSafetySignalPolicy(structured as Record<string, unknown>, agentMeta, sources)
    return existing as CanonicalMappingsPayload
  }
  const mappings = applyCanonicalMappings(structured as Record<string, unknown>, sources, {
    facts,
    agent_metadata: agentMeta,
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
