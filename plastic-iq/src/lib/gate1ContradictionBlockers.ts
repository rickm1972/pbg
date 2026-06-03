const PTFE_PRIMARY_IDS = new Set([
  'ptfe_nonstick_coating',
  'ptfe_nonstick_titanium_reinforced',
])
import type { StructuredEvidencePayload } from '../types/agent'

const PFOA_PFAS_CHECK = 'external.pfoa_vs_pfas_free_distinction'

/**
 * Gate 1 approval blockers from canonical / retrieval contradictions (Phase 3.5–3.7).
 */
export function getGate1ContradictionBlockers(
  structured: StructuredEvidencePayload | null | undefined,
): string[] {
  if (!structured?.canonical_mappings) return []

  const blockers: string[] = []
  const m = structured.canonical_mappings
  const primaryId = m.primary_contact_material_id?.canonical_id ?? ''
  const pfasId = m.pfas_status_id?.canonical_id ?? ''
  const isPtfe = PTFE_PRIMARY_IDS.has(primaryId)

  if (isPtfe && pfasId === 'pfas_free_claimed') {
    blockers.push(
      'Contradiction: food-contact surface is PTFE nonstick but PFAS status is pfas_free_claimed. Use pfas_present_disclosed or pfas_intentionally_added_disclosed.',
    )
  }

  const pfasMarketing = m.safety_claim_ids?.pfas_free_marketing_claim
  if (isPtfe && pfasMarketing) {
    blockers.push(
      'Contradiction: PFAS-free marketing claim must not apply to a PTFE nonstick product with disclosed PFAS family coating.',
    )
  }

  const pfoa = m.safety_claim_ids?.pfoa_free_claim
  if (pfoa && pfasMarketing) {
    const pfasQuote = (pfasMarketing.source_quote ?? '').toLowerCase()
    const sameUrl =
      pfoa.source_url &&
      pfasMarketing.source_url &&
      pfoa.source_url === pfasMarketing.source_url
    if (
      (sameUrl && !/\bpfas[-\s]?free\b/.test(pfasQuote)) ||
      (/\bpfoa[-\s]?free\b/.test(pfasQuote) && !/\bpfas[-\s]?free\b/.test(pfasQuote))
    ) {
      blockers.push(
        'Contradiction: PFAS-free marketing appears inferred from PFOA-free wording only — not independently verified.',
      )
    }
  }

  const pfoaRc = structured.required_check_results?.find((r) => r.check_id === PFOA_PFAS_CHECK)
  if (pfoaRc?.status === 'failed') {
    blockers.push(
      `Required check failed (${PFOA_PFAS_CHECK}): ${pfoaRc.detail ?? 'PFOA vs PFAS-free distinction not documented.'}`,
    )
  }

  return blockers
}
