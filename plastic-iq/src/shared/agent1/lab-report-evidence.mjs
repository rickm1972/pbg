/**
 * Distinguish actual lab report evidence from review/marketing PFAS language.
 */

const LAB_ABSENCE_RE =
  /no\s+(current\s+)?test\s*results|without\s+test\s*reports|not\s+publish(?:ed|ing)\s+test\s*reports|no\s+test\s*reports|do\s+not\s+have\s+test\s*results|lack(?:s|ing)\s+test\s*reports/i

/** Requires report substance — bare "third-party labs" marketing copy must not match. */
const STRONG_LAB_REPORT_RE =
  /test\s*results?\s*verified\s+by(?:\s+(?:a\s+)?third[-\s]?party(?:\s+lab)?)?|third[-\s]?party\s+lab\s+test|certificate\s+of\s+analysis|\bcoa\b|testing\s+report|light\s+labs|tablelab|manufacturer\s+pdp\s+modal|modal\/dialog\s+evidence|detection\s+limits?|laboratory(?:'s)?\s+detection\s+limits?/i

const ANALYTE_NON_DETECT_RE =
  /\b(pfos|pfoa|ptfe|pfas|pfbs|pfna|pfhxs|pfpea)\b[^.\n]{0,60}\bnon[-\s]?detect\b|\bnon[-\s]?detect\b[^.\n]{0,60}\b(pfos|pfoa|ptfe|pfas|pfbs|pfna)\b/i

/** FAQ / marketing safety pages — generic compliance claims without report details. */
const GENERIC_LAB_MARKETING_ONLY_RE =
  /tested\s+by\s+third[-\s]?party\s+labs?(?:\s*,\s*|\s+and\s+)(?:is\s+)?certified\s+safe|certified\s+safe\s+according\s+to|complies?\s+with\s+(?:usa|german|swiss|ktr|fda|lfgb|standards|regulations)|toxin[-\s]?free|free\s+from\s+(?:toxins|forever\s+chemicals)|does\s+not\s+contain\s+(?:ptfe|pfas|toxins)/i

const FAQ_MARKETING_PATH_RE = /\/pages\/faq|\/faq(?:s)?(?:\/|$)|\/help\/|\/pages\/.*toxin|\/safety(?:\/|$)/i

/**
 * @param {string} text
 */
export function labMentionIsNegatedOrInsufficient(text) {
  return LAB_ABSENCE_RE.test(String(text ?? ''))
}

/**
 * True only when text contains product/SKU-specific lab report signals — not bare PFAS marketing or review prose.
 * @param {string} text
 */
/**
 * @param {string | null | undefined} [url]
 */
export function isFaqOrMarketingSafetyUrl(url) {
  if (!url) return false
  try {
    return FAQ_MARKETING_PATH_RE.test(new URL(url).pathname)
  } catch {
    return FAQ_MARKETING_PATH_RE.test(String(url))
  }
}

/**
 * @param {string} text
 * @param {{ url?: string | null, manufacturer_modal_evidence?: boolean }} [options]
 */
export function hasActualLabReportEvidence(text, options = {}) {
  const t = String(text ?? '').trim()
  if (!t) return false
  if (labMentionIsNegatedOrInsufficient(t)) return false

  const onFaqOrMarketing = isFaqOrMarketingSafetyUrl(options.url)
  if (onFaqOrMarketing && !options.manufacturer_modal_evidence) {
    if (GENERIC_LAB_MARKETING_ONLY_RE.test(t)) return false
    if (/third[-\s]?party\s+labs?/i.test(t) && !ANALYTE_NON_DETECT_RE.test(t) && !/test\s*results?\s*verified/i.test(t)) {
      return false
    }
  }

  if (GENERIC_LAB_MARKETING_ONLY_RE.test(t) && !ANALYTE_NON_DETECT_RE.test(t) && !/test\s*results?\s*verified/i.test(t)) {
    return false
  }

  if (STRONG_LAB_REPORT_RE.test(t)) return true
  if (ANALYTE_NON_DETECT_RE.test(t)) return true
  return false
}
