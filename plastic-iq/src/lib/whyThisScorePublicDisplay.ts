import type { WhyThisScoreFields } from './whyThisScoreApi'
import { displayOptions } from './whyThisScoreApi'
import {
  publicCertificationOption,
  CERT_ABSENT_PUBLIC_DISCLOSED,
  CERT_ABSENT_PUBLIC_COATING_FORMULATION,
  CERT_ABSENT_PUBLIC_STAINLESS_GRADE,
  CERT_ABSENT_PUBLIC_DOCUMENTATION_INCOMPLETE,
  CERT_ABSENT_PUBLIC_PTFE,
} from './publicDisclosureGapCopy'
import { normalizeDisclosureBadge } from './whyThisScoreVocabulary'

export {
  CERT_ABSENT_PUBLIC_DISCLOSED,
  CERT_ABSENT_PUBLIC_PTFE,
  CERT_ABSENT_PUBLIC_STAINLESS_GRADE,
  CERT_ABSENT_PUBLIC_DOCUMENTATION_INCOMPLETE,
  /** @deprecated use CERT_ABSENT_PUBLIC_COATING_FORMULATION */
  CERT_ABSENT_PUBLIC_COATING_FORMULATION as CERT_ABSENT_PUBLIC_UNCERTAIN,
}

function normalizeLabel(label: string): string {
  return label.trim().toLowerCase()
}

function secondaryDuplicatesPrimary(
  primary: string[],
  secondary: string[],
): boolean {
  const p = displayOptions(primary)
  const s = displayOptions(secondary)
  if (!p.length || !s.length) return false
  return s.every((sec) => p.some((pr) => normalizeLabel(pr) === normalizeLabel(sec)))
}

/**
 * Public Why This Score shaping — does not change stored Gate 2 options (admin unchanged).
 */
export function shapePublicWhyThisScoreFields(
  fields: WhyThisScoreFields,
): WhyThisScoreFields {
  const primary = fields.primary_material_options
  let secondary = fields.secondary_materials_options
  if (secondaryDuplicatesPrimary(primary, secondary)) {
    secondary = ['None distinct from primary material']
  }

  const disclosureBadge = normalizeDisclosureBadge(fields.disclosure_quality_options[0] ?? '')

  return {
    ...fields,
    secondary_materials_options: secondary,
    disclosure_quality_options: fields.disclosure_quality_options.map((o) =>
      normalizeDisclosureBadge(o),
    ),
    certifications_options: fields.certifications_options.map((o) =>
      publicCertificationOption(o, disclosureBadge, primary, fields.coatings_finishes_options),
    ),
  }
}
