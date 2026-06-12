import { getAgent1SourceValidationBlockers } from './gate1-source-validation.mjs'
import { getCoatingInertContradictionBlockers } from '../canonical-taxonomy/hybrid-cookware-structural.mjs'

const PTFE_PRIMARY_IDS = new Set([
  'ptfe_nonstick_coating',
  'ptfe_nonstick_titanium_reinforced',
])

const PFOA_PFAS_CHECK = 'external.pfoa_vs_pfas_free_distinction'

/**
 * Gate 1 approval blockers from canonical / retrieval contradictions (Phase 3.5–3.7).
 * @param {object | null | undefined} structured
 */
export function getGate1ContradictionBlockers(structured) {
  if (!structured?.canonical_mappings) return []

  /** @type {string[]} */
  const blockers = []
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

  for (const b of getCoatingInertContradictionBlockers(m, structured)) {
    if (!blockers.includes(b)) blockers.push(b)
  }

  for (const b of getAgent1SourceValidationBlockers(structured)) {
    if (!blockers.includes(b)) blockers.push(b)
  }

  const pfoaDetail = pfoaRc?.detail ?? ''
  if (
    pfoaRc?.status === 'passed' &&
    pfasId === 'pfas_not_disclosed' &&
    /pfas_status=pfas_present_disclosed/i.test(pfoaDetail)
  ) {
    blockers.push(
      'Contradiction: PFOA/PFAS required-check detail references pfas_present_disclosed but canonical PFAS status is pfas_not_disclosed. Re-run Agent 1 or reconcile third-party PTFE context.',
    )
  }

  return blockers
}
