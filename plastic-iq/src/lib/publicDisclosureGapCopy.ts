import { normalizeDisclosureBadge, normalizeWhyThisScoreOption } from './whyThisScoreVocabulary'
import { CERT_VERIFICATION_ABSENT } from './whyThisScoreVocabulary'

export const MANUFACTURER_LAB_TESTING_OPTION_RE =
  /^Manufacturer-published third-party lab testing/i

export function isManufacturerLabTestingCertOption(option: string): boolean {
  return MANUFACTURER_LAB_TESTING_OPTION_RE.test(String(option ?? '').trim())
}

/** Public prose when disclosure is strong (Fully Disclosed). */
export const CERT_ABSENT_PUBLIC_DISCLOSED =
  'No third-party certification found; material identity is clearly disclosed.'

/** Coating chemistry is the unresolved disclosure gap. */
export const CERT_ABSENT_PUBLIC_COATING_FORMULATION =
  'No third-party certification found; material family is identified, but the exact coating formulation is not fully disclosed.'

/** Stainless family disclosed; alloy grade/spec is not. */
export const CERT_ABSENT_PUBLIC_STAINLESS_GRADE =
  'No third-party certification found; material family is identified, but the exact stainless steel grade/spec is not fully disclosed.'

/** Generic incomplete documentation without implying a coating gap. */
export const CERT_ABSENT_PUBLIC_DOCUMENTATION_INCOMPLETE =
  'No third-party certification found; most materials are identified, but some manufacturer documentation details remain incomplete.'

/** Known disclosed PTFE / fluoropolymer nonstick. */
export const CERT_ABSENT_PUBLIC_PTFE =
  'No third-party certification found; the food-contact coating is identified as PTFE nonstick.'

export function coatingsFinishesAreNone(options: string[] | null | undefined): boolean {
  const rows = (options ?? [])
    .map((o) => normalizeWhyThisScoreOption('coatings_finishes_options', String(o ?? '')))
    .map((o) => o.trim().toLowerCase())
    .filter((o) => o && o !== 'none')
  return rows.length === 0
}

export function primaryMaterialIndicatesUnspecifiedStainless(
  primaryMaterialOptions: string[] | null | undefined,
): boolean {
  return (primaryMaterialOptions ?? []).some((o) => {
    const text = String(o ?? '').toLowerCase()
    return (
      /stainless.*unspecified/.test(text) ||
      /unspecified.*stainless/.test(text) ||
      /stainless steel \(grade unspecified\)/.test(text) ||
      /stainless steel grade unspecified/.test(text)
    )
  })
}

export function primaryMaterialIndicatesKnownPtfe(
  primaryMaterialOptions: string[] | null | undefined,
): boolean {
  return (primaryMaterialOptions ?? []).some((o) =>
    /\bptfe\b|teflon|fluoropolymer/i.test(String(o)),
  )
}

export function primaryMaterialIndicatesCoatingDisclosureGap(
  primaryMaterialOptions: string[] | null | undefined,
  coatingsFinishesOptions: string[] | null | undefined,
): boolean {
  if (coatingsFinishesAreNone(coatingsFinishesOptions)) return false
  return (primaryMaterialOptions ?? []).some((o) =>
    /proprietary ceramic|undisclosed|unknown.*coating|sol\.?gel|nonstick coating/i.test(
      String(o),
    ),
  )
}

function disclosureLimitsCertCopy(disclosureBadge: string): boolean {
  const b = normalizeDisclosureBadge(disclosureBadge)
  return b === 'Material Uncertain' || b === 'Documentation Incomplete' || b === 'Opaque'
}

/**
 * Provenance-aware public copy for cert-absent row on product page.
 */
export function publicCertificationAbsenceCopy(
  disclosureBadge: string | null | undefined,
  primaryMaterialOptions?: string[] | null,
  coatingsFinishesOptions?: string[] | null,
): string {
  const badge = normalizeDisclosureBadge(String(disclosureBadge ?? ''))
  if (!disclosureLimitsCertCopy(badge)) {
    return CERT_ABSENT_PUBLIC_DISCLOSED
  }
  if (primaryMaterialIndicatesKnownPtfe(primaryMaterialOptions)) {
    return CERT_ABSENT_PUBLIC_PTFE
  }
  const coatingNone = coatingsFinishesAreNone(coatingsFinishesOptions)
  const unspecifiedStainless = primaryMaterialIndicatesUnspecifiedStainless(primaryMaterialOptions)
  const coatingGap = primaryMaterialIndicatesCoatingDisclosureGap(
    primaryMaterialOptions,
    coatingsFinishesOptions,
  )

  if (unspecifiedStainless && coatingNone) {
    return CERT_ABSENT_PUBLIC_STAINLESS_GRADE
  }
  if (coatingGap && !coatingNone) {
    return CERT_ABSENT_PUBLIC_COATING_FORMULATION
  }
  if (unspecifiedStainless) {
    return CERT_ABSENT_PUBLIC_STAINLESS_GRADE
  }
  return CERT_ABSENT_PUBLIC_DOCUMENTATION_INCOMPLETE
}

const COATING_FORMULATION_GAP_RE =
  /the exact coating formulation is not fully disclosed/gi
const STAINLESS_GRADE_GAP_PHRASE =
  'the exact stainless steel grade/spec is not fully disclosed'
const KEY_FOOD_CONTACT_CHEMISTRY_GAP_RE =
  /key food-contact chemistry is not fully disclosed/gi

/** Align stored product-description disclosure prose with the resolved gap reason. */
export function rewritePublicDescriptionDisclosureGap(
  text: string,
  primaryMaterialOptions?: string[] | null,
  coatingsFinishesOptions?: string[] | null,
): string {
  if (!text?.trim()) return text
  const coatingNone = coatingsFinishesAreNone(coatingsFinishesOptions)
  const unspecifiedStainless = primaryMaterialIndicatesUnspecifiedStainless(primaryMaterialOptions)
  const coatingGap = primaryMaterialIndicatesCoatingDisclosureGap(
    primaryMaterialOptions,
    coatingsFinishesOptions,
  )

  if (coatingGap && !coatingNone) return text

  let out = text
  if (coatingNone && unspecifiedStainless) {
    out = out.replace(COATING_FORMULATION_GAP_RE, STAINLESS_GRADE_GAP_PHRASE)
    out = out.replace(KEY_FOOD_CONTACT_CHEMISTRY_GAP_RE, STAINLESS_GRADE_GAP_PHRASE)
  } else if (coatingNone) {
    out = out.replace(COATING_FORMULATION_GAP_RE, 'key food-contact material details are not fully disclosed')
  }
  return out
}

export function publicCertificationOption(
  option: string,
  disclosureBadge?: string | null,
  primaryMaterialOptions?: string[] | null,
  coatingsFinishesOptions?: string[] | null,
  options?: { hasLabTesting?: boolean },
): string {
  if (isManufacturerLabTestingCertOption(option)) return option

  const canonical = normalizeWhyThisScoreOption('certifications_options', option)
  if (canonical === CERT_VERIFICATION_ABSENT) {
    if (options?.hasLabTesting) {
      return CERT_VERIFICATION_ABSENT
    }
    return publicCertificationAbsenceCopy(
      disclosureBadge,
      primaryMaterialOptions,
      coatingsFinishesOptions,
    )
  }
  return option
}

/**
 * Public Certifications & testing rows — lab testing and certification absence stay separate.
 */
export function publicCertificationsForDisplay(
  options: string[],
  disclosureBadge?: string | null,
  primaryMaterialOptions?: string[] | null,
  coatingsFinishesOptions?: string[] | null,
): string[] {
  const visible = (options ?? []).filter((o) => o && o !== 'None')
  const labRows = visible.filter(isManufacturerLabTestingCertOption)
  const hasLabTesting = labRows.length > 0
  const out: string[] = [...labRows]

  for (const option of visible) {
    if (isManufacturerLabTestingCertOption(option)) continue
    const shaped = publicCertificationOption(
      option,
      disclosureBadge,
      primaryMaterialOptions,
      coatingsFinishesOptions,
      { hasLabTesting },
    )
    if (!out.includes(shaped)) out.push(shaped)
  }

  return out
}
