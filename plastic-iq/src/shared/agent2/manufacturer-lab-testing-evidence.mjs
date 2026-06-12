/**
 * Manufacturer-published third-party lab testing — carry-forward from approved Gate 1 evidence.
 * Not a certifying-body certification; distinct from certifications_verified.
 */

const LAB_CHECK_ID = 'external.coated_product_lab_results'

import { hasActualLabReportEvidence } from '../agent1/lab-report-evidence.mjs'

const ANALYTE_PATTERNS = [
  { id: 'PFOS', re: /\bpfos\b/i },
  { id: 'PTFE', re: /\bptfe\b/i },
  { id: 'PFOA', re: /\bpfoa\b/i },
  { id: 'PFAS', re: /\bpfas\b/i },
  { id: 'PFBS', re: /\bpfbs\b/i },
  { id: 'PFNA', re: /\bpfna\b/i },
  { id: 'PFPeA', re: /\bpfpea\b/i },
  { id: 'PFHpS', re: /\bpfhxs\b/i },
]

/**
 * @param {object | null | undefined} evidence
 */
export function extractManufacturerPublishedLabTesting(evidence) {
  const structured = evidence?.agent_metadata?.structured_evidence ?? null
  const sources = evidence?.sources ?? []

  const rc = (structured?.required_check_results ?? []).find(
    (r) => r.check_id === LAB_CHECK_ID && r.status === 'passed',
  )
  const detail = String(rc?.detail ?? '')
  const passedLabCheck =
    Boolean(rc) &&
    /manufacturer_published_third_party_lab_result/i.test(detail)

  /** @type {string[]} */
  const blobs = []
  let testing_source_url = rc?.source_url?.trim() || null

  for (const s of sources) {
    const text = `${s.page_excerpt ?? ''} ${s.title ?? ''}`.trim()
    if (!hasActualLabReportEvidence(text, { url: s.url, manufacturer_modal_evidence: s.manufacturer_modal_evidence })) {
      continue
    }
    blobs.push(text)
    if (!testing_source_url && s.url) testing_source_url = s.url
  }

  const combined = blobs.join('\n')
  const hasSourceLabText = hasActualLabReportEvidence(combined)

  if (!passedLabCheck || !hasSourceLabText) {
    return { testing_evidence_present: false, certification: false }
  }

  const testing_lab = /\blight\s*labs\b/i.test(combined) ? 'Light Labs' : null
  const testing_result = /\bnon[-\s]?detect\b/i.test(combined) ? 'Non-Detect' : null
  const tested_analytes = ANALYTE_PATTERNS.filter((p) => p.re.test(combined)).map((p) => p.id)

  return {
    testing_evidence_present: true,
    testing_evidence_type: 'manufacturer_published_third_party_lab_result',
    testing_lab,
    testing_result,
    tested_analytes,
    testing_source_url,
    certification: false,
    source_check_id: passedLabCheck ? LAB_CHECK_ID : null,
  }
}

/**
 * @param {object | null | undefined} evidence
 */
export function hasManufacturerPublishedLabTesting(evidence) {
  return Boolean(extractManufacturerPublishedLabTesting(evidence).testing_evidence_present)
}

/**
 * @param {ReturnType<typeof extractManufacturerPublishedLabTesting>} lab
 */
/** Normalization note when marketing-language Layer 4A negative is stripped. */
export function marketingLanguageStripNormalizationNote(evidence) {
  if (hasManufacturerPublishedLabTesting(evidence)) {
    return 'Server stripped Marketing language only Layer 4A — not applicable when manufacturer-published third-party lab testing exists.'
  }
  return 'Server stripped Marketing language only Layer 4A — not applicable when manufacturer fully discloses materials.'
}

/** layer_4a_verified action when marketing-language negative is stripped. */
export function marketingLanguageStripVerifiedAction(evidence) {
  if (hasManufacturerPublishedLabTesting(evidence)) {
    return 'stripped — manufacturer-published third-party lab testing provides verifiable support; proprietary chemistry uncertainty remains'
  }
  return 'stripped — materials fully disclosed; no unknown food-contact coating (V2.3.4)'
}

export function formatManufacturerLabTestingCertOption(lab) {
  if (!lab?.testing_evidence_present) return null
  const labName = lab.testing_lab ? `${lab.testing_lab} ` : ''
  const result = lab.testing_result ?? 'testing'
  const analytes =
    lab.tested_analytes?.length > 0
      ? ` for ${lab.tested_analytes.slice(0, 6).join('/')}`
      : ' for PFAS/PTFE/PFOA compounds'
  return `Manufacturer-published third-party lab testing (${labName}${result}${analytes})`
}
