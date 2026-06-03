import { COOKWARE_SCORE_DRIVING_FIELDS } from './canonicalEvidenceMapping'
import type { CanonicalMappingsPayload } from '../types/agent'

export function canonicalReviewKey(fieldKey: string, subKey?: string): string {
  return subKey != null && subKey !== '' ? `${fieldKey}:${subKey}` : fieldKey
}

/** Score-driving canonical rows the reviewer must confirm in Gate 1. */
export function listCanonicalReviewFieldKeys(
  mappings: CanonicalMappingsPayload | null | undefined,
): string[] {
  if (!mappings) return []
  const keys: string[] = COOKWARE_SCORE_DRIVING_FIELDS.map((r) => r.field_key)
  ;(mappings.regulatory_flag_ids ?? []).forEach((_, i) => {
    keys.push(canonicalReviewKey('regulatory_flag_ids', String(i)))
  })
  for (const [k, row] of Object.entries(mappings.safety_claim_ids ?? {})) {
    if (row) keys.push(canonicalReviewKey('safety_claim_ids', k))
  }
  return keys
}
