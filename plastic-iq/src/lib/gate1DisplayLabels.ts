import type { CanonicalFieldMapping } from '../types/agent'

export const SAFETY_CLAIM_REVIEW_LABELS: Record<string, string> = {
  pfoa_free_claim: 'PFOA-free claim',
  pfas_free_claim_structurally_verified: 'PFAS-free structurally verified',
  pfas_free_marketing_claim: 'PFAS-free marketing claim',
  non_toxic_marketing_claim: 'Non-toxic marketing claim',
  bpa_free_claim: 'BPA-free claim',
  lead_free_claim: 'Lead-free claim',
  phthalate_free_claim: 'Phthalate-free claim',
}

export function safetyClaimReviewLabel(claimKey: string): string {
  return SAFETY_CLAIM_REVIEW_LABELS[claimKey] ?? claimKey.replace(/_/g, ' ')
}

const CONFIDENCE_DISPLAY: Record<string, string> = {
  manufacturer_confirmed: 'manufacturer confirmed',
  retailer_confirmed: 'retailer confirmed',
  fully_disclosed_by_manufacturer: 'fully disclosed by manufacturer',
  third_party_review_citing_manufacturer: 'third-party review citing manufacturer',
  third_party_context_source: 'third-party context source',
  manufacturer_claim_via_secondary_source: 'manufacturer claim via secondary source',
  marketing_claim: 'marketing claim',
  claim_not_independently_verified: 'claim not independently verified',
}

/** Plain-language confidence for Gate 1 canonical review table. */
export function formatCanonicalConfidenceLabel(row: CanonicalFieldMapping | null | undefined): string {
  if (!row?.confidence_label) return '—'
  const label = row.confidence_label
  if (CONFIDENCE_DISPLAY[label]) return CONFIDENCE_DISPLAY[label]
  if (row.canonical_id === 'pfas_free_claim_structurally_verified') {
    if (label === 'retailer_confirmed') return 'retailer_claim_structurally_supported'
    if (label === 'manufacturer_confirmed') return 'structurally_verified'
    if (label === 'retailer_claim_structurally_supported' || label === 'structurally_verified') {
      return label
    }
  }
  return label
}
