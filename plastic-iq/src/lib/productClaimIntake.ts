/** Intake/evidence claim fields — do not directly alter Agent 3 score formula. */

export const CLAIM_INTAKE_TYPES = [
  'bpa_free',
  'phthalate_free',
  'pfas_free',
  'lead_free',
  'non_toxic_marketing',
  'third_party_tested',
  'lab_tested',
] as const

export type ClaimIntakeType = (typeof CLAIM_INTAKE_TYPES)[number]

export const REQUIRED_CLAIM_INTAKE_TYPES = [
  'bpa_free',
  'phthalate_free',
  'pfas_free',
  'lead_free',
] as const satisfies readonly ClaimIntakeType[]

export const ADVANCED_CLAIM_INTAKE_TYPES = [
  'non_toxic_marketing',
  'third_party_tested',
  'lab_tested',
] as const satisfies readonly ClaimIntakeType[]

export type ClaimIntakeValue = 'yes' | 'no' | 'unknown'

export type ProductClaimIntakeRow = {
  product_claim_id: string
  product_id: string
  claim_type: ClaimIntakeType
  claim_value: ClaimIntakeValue
  claim_source: string | null
  evidence_url: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type ClaimIntakeMap = Partial<Record<ClaimIntakeType, ClaimIntakeValue>>

export const CLAIM_INTAKE_DISCLAIMER =
  'These claims are intake/evidence fields. Scoring only changes when supported by the existing methodology and reviewed evidence.'

/** Claims with existing Layer 4A methodology mappings (read-only guard — no new scoring behavior). */
export const LAYER_4A_MAPPED_CLAIM_TYPES = new Set<ClaimIntakeType>([
  'bpa_free',
  'phthalate_free',
  'pfas_free',
  'non_toxic_marketing',
  'third_party_tested',
  'lab_tested',
])

/** Evidence/display-only in this phase — selecting yes does not change score. */
export const EVIDENCE_ONLY_CLAIM_TYPES = new Set<ClaimIntakeType>(['lead_free'])

export const CLAIM_INTAKE_LABELS: Record<ClaimIntakeType, string> = {
  bpa_free: 'BPA-free',
  phthalate_free: 'Phthalate-free',
  pfas_free: 'PFAS-free',
  lead_free: 'Lead-free',
  non_toxic_marketing: 'Non-toxic marketing claim',
  third_party_tested: 'Third-party tested',
  lab_tested: 'Lab tested',
}

export function claimIntakeValueFromLegacy(
  legacy: 'Yes' | 'No' | 'Unknown' | null | undefined,
): ClaimIntakeValue {
  if (legacy === 'Yes') return 'yes'
  if (legacy === 'No') return 'no'
  return 'unknown'
}

export function claimIntakeValueToLegacy(
  value: ClaimIntakeValue | null | undefined,
): 'Yes' | 'No' | 'Unknown' {
  if (value === 'yes') return 'Yes'
  if (value === 'no') return 'No'
  return 'Unknown'
}

export function emptyClaimIntakeMap(): ClaimIntakeMap {
  const out: ClaimIntakeMap = {}
  for (const t of CLAIM_INTAKE_TYPES) out[t] = 'unknown'
  return out
}

export function mergeClaimIntakeRows(rows: ProductClaimIntakeRow[]): ClaimIntakeMap {
  const out = emptyClaimIntakeMap()
  for (const row of rows) {
    if (CLAIM_INTAKE_TYPES.includes(row.claim_type)) {
      out[row.claim_type] = row.claim_value
    }
  }
  return out
}

export function claimIntakeAffectsLayer4a(claimType: ClaimIntakeType): boolean {
  return LAYER_4A_MAPPED_CLAIM_TYPES.has(claimType)
}
