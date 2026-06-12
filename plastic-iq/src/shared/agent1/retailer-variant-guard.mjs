/**
 * Retailer listing variant guard — inch size / product line mismatch (Agent 1 / Gate 1).
 */

const SIZE_IN_TEXT_RE = /(\d+(?:\.\d+)?)\s*(?:inch|in\.?|")\b/gi
const SIZE_HYPHEN_INCH_SLUG_RE = /(\d+(?:\.\d+)?)-inch\b/gi
const SLUG_DECIMAL_SIZE_RE = /\b(\d{1,2})-(\d{1,2})\b/gi

function parseSlugInchSize(wholePart, fracPart) {
  const whole = Number(wholePart)
  const frac = Number(fracPart)
  if (!Number.isFinite(whole) || !Number.isFinite(frac)) return null
  if (fracPart.length === 2 && frac === 25) return whole + 0.25
  if (fracPart.length === 1 && frac < 10) return whole + frac / 10
  return null
}

/**
 * @param {string} text
 * @returns {number[]}
 */
export function extractInchSizes(text) {
  const sizes = []
  const t = String(text ?? '')
  for (const match of t.matchAll(SIZE_IN_TEXT_RE)) {
    const n = Number(match[1])
    if (Number.isFinite(n)) sizes.push(n)
  }
  for (const match of t.matchAll(SIZE_HYPHEN_INCH_SLUG_RE)) {
    const n = Number(match[1])
    if (Number.isFinite(n)) sizes.push(n)
  }
  for (const match of t.matchAll(SLUG_DECIMAL_SIZE_RE)) {
    const parsed = parseSlugInchSize(match[1], match[2])
    if (parsed != null) sizes.push(parsed)
  }
  return [...new Set(sizes)]
}

/**
 * @param {string} productName
 * @param {string} url
 * @param {string} [contextText]
 */
export function retailerListingHasConfirmedVariantMismatch(productName, url, contextText = '') {
  const name = String(productName ?? '').trim()
  const haystack = `${url} ${contextText}`.trim()
  if (!name || !haystack) return false

  const nameSizes = extractInchSizes(name)
  const urlSizes = extractInchSizes(haystack)
  if (nameSizes.length && urlSizes.length) {
    const primary = nameSizes[0]
    if (!urlSizes.some((s) => Math.abs(s - primary) < 0.15)) return true
  }
  return false
}

/**
 * @param {object[]} sources
 * @param {{ product_name?: string }} product
 * @returns {string[]}
 */
export function retailerVariantMismatchWarnings(sources, product) {
  const name = product.product_name ?? ''
  if (!name.trim()) return []

  /** @type {string[]} */
  const warnings = []
  for (const s of sources ?? []) {
    const url = s.url ?? ''
    if (!url) continue
    if (!/walmart\.com|target\.com/i.test(url)) continue
    if (retailerListingHasConfirmedVariantMismatch(name, url, s.title ?? '')) {
      warnings.push(
        `Retailer variant mismatch — not used as primary evidence: ${url} (reviewed product: ${name})`,
      )
    }
  }
  return warnings
}
