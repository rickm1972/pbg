/**
 * Global source authority rules — third-party sources cannot be manufacturer_confirmed.
 */

import { resolveSourceTier } from '../canonical-taxonomy/confidence-label-consistency.mjs'
import { hasActualLabReportEvidence } from './lab-report-evidence.mjs'

const THIRD_PARTY_TYPES = new Set(['third_party_review', 'blog', 'context', 'review'])
const THIRD_PARTY_HOST_RE =
  /blog\.|medium\.com|substack|thenewknew|wirecutter|nytimes|goodhousekeeping|consumerreports|environmentalblog|theenvironmentalblog|leafscore\.com|organicauthority\.com|youtube\.com|youtu\.be|vimeo\.com/i

const MANUFACTURER_CONFIDENCE_LABELS = new Set([
  'manufacturer_confirmed',
  'manufacturer confirmed',
  'fully_disclosed_by_manufacturer',
  'fully disclosed by manufacturer',
])

/**
 * @param {object | null | undefined} source
 * @param {string | null | undefined} [url]
 */
export function isThirdPartySource(source, url = source?.url) {
  const type = String(source?.source_type ?? '').toLowerCase()
  if (THIRD_PARTY_TYPES.has(type)) return true
  const tier = resolveSourceTier(source, url)
  if (tier === 'third_party_review') return true
  try {
    const host = new URL(String(url ?? '')).hostname
    if (THIRD_PARTY_HOST_RE.test(host)) return true
  } catch {
    /* ignore */
  }
  return false
}

/**
 * @param {string | null | undefined} label
 * @param {object | null | undefined} source
 * @param {string | null | undefined} [url]
 */
export function reconcileFactConfidence(label, source, url = source?.url) {
  const before = String(label ?? '').trim()
  if (!before) return before
  if (!isThirdPartySource(source, url)) return before
  if (MANUFACTURER_CONFIDENCE_LABELS.has(before)) {
    return 'third_party_context_source'
  }
  if (/retailer confirmed/i.test(before)) return 'third_party_context_source'
  return before || 'third_party_context_source'
}

/**
 * Downgrade fact confidence when source tier does not support manufacturer_confirmed.
 * @param {object[]} sources
 * @param {object[]} facts
 */
export function enforceFactSourceAuthority(sources, facts) {
  return (facts ?? []).map((fact) => {
    const idx = fact.source_index
    if (idx == null || idx < 0 || idx >= (sources ?? []).length) return fact
    const source = sources[idx]
    const confidence = reconcileFactConfidence(fact.confidence, source, source?.url)
    if (confidence === fact.confidence) return fact
    return { ...fact, confidence }
  })
}

/**
 * @param {object | null | undefined} source
 * @param {string | null | undefined} [url]
 */
export function classifyLabResultSource(source, url = source?.url) {
  const text = `${source?.page_excerpt ?? ''} ${source?.title ?? ''}`
  const evidenceOpts = { url, manufacturer_modal_evidence: source?.manufacturer_modal_evidence }
  if (source?.manufacturer_modal_evidence && hasActualLabReportEvidence(text, evidenceOpts)) {
    return 'manufacturer_published_third_party_lab_result'
  }
  if (!hasActualLabReportEvidence(text, evidenceOpts)) return null
  if (isThirdPartySource(source, url)) return null

  const tier = resolveSourceTier(source, url)
  if (tier === 'manufacturer') {
    return 'manufacturer_published_third_party_lab_result'
  }
  if (tier === 'amazon' || tier === 'retailer') {
    return 'retailer_linked_lab_result'
  }
  return null
}

/**
 * Third-party PTFE/PFOA copy is context-only unless it matches current SKU with official corroboration.
 * @param {object} source
 * @param {{ product_name?: string }} product
 * @param {object[]} officialSources
 */
export function isOutdatedThirdPartyPtfeContext(source, product, officialSources = []) {
  if (!isThirdPartySource(source, source?.url)) return false
  const text = `${source?.page_excerpt ?? ''} ${source?.title ?? ''}`
  if (!/\bptfe\b|\bpfoa\b/i.test(text)) return false
  if (/\bptfe[-\s]?free\b|\bpfas[-\s]?free\b/i.test(text)) return false

  const hasOfficialPtfeFree = (officialSources ?? []).some((s) => {
    if (isThirdPartySource(s, s?.url)) return false
    const blob = `${s.page_excerpt ?? ''} ${s.title ?? ''}`
    return /\bptfe[-\s]?free\b|\bpfas[-\s]?free\b/i.test(blob)
  })
  if (hasOfficialPtfeFree) return true

  const name = String(product.product_name ?? '').toLowerCase()
  if (!name) return true
  const blob = text.toLowerCase()
  const tokens = name.split(/\s+/).filter((t) => t.length > 3)
  const matchCount = tokens.filter((t) => blob.includes(t)).length
  return matchCount < Math.max(1, Math.floor(tokens.length * 0.4))
}
