/**
 * Verify retailer listing URLs match product variant (size, set count, product line).
 * Used for public CTAs — fail closed when mismatch is detectable.
 */

const SIZE_IN_TEXT_RE = /(\d+(?:\.\d+)?)\s*(?:-|inch|in\.?|")\b/gi
const PIECE_COUNT_RE = /(\d+)\s*[-\s]?(?:piece|pc|pk)\b/gi

const STOP_TOKENS = new Set([
  'nonstick',
  'frying',
  'skillet',
  'cookware',
  'piece',
  'inch',
  'with',
  'and',
  'set',
  'pan',
  'fry',
  'the',
  'for',
  'hard',
  'anodized',
  'ultimate',
  'ceramic',
  'steel',
  'cast',
  'iron',
  'home',
  'kitchen',
])

/** Distinct product lines — URL phrase must not appear unless also in product name. */
const PRODUCT_LINE_MARKERS = [
  'simply cook',
  'simply-cook',
  'initiatives',
  'excite',
  'eco',
  'stone',
  'ceramicchef',
  'ceramic chef',
]

const SIZE_LIST_BEFORE_INCH_RE =
  /(\d+(?:\.\d+)?(?:\s*,\s*\d+(?:\.\d+)?)+)\s*(?:inch|in\.?|")\b/gi

/** Retailer slug sizes: `10-5` → 10.5, `10-25` → 10.25 (not multi-pan `8-10`). */
const SLUG_DECIMAL_SIZE_RE = /\b(\d{1,2})-(\d{1,2})\b/gi

function parseSlugInchSize(wholePart: string, fracPart: string): number | null {
  const whole = Number(wholePart)
  const frac = Number(fracPart)
  if (!Number.isFinite(whole) || !Number.isFinite(frac)) return null
  if (fracPart.length === 2 && frac === 25) return whole + 0.25
  if (fracPart.length === 1 && frac < 10) return whole + frac / 10
  return null
}

/** Extract inch measurements from product title, URL path, or listing title. */
export function extractInchSizes(text: string): number[] {
  const sizes: number[] = []
  const t = String(text ?? '')
  for (const match of t.matchAll(SIZE_IN_TEXT_RE)) {
    const n = Number(match[1])
    if (Number.isFinite(n)) sizes.push(n)
  }
  for (const match of t.matchAll(SIZE_LIST_BEFORE_INCH_RE)) {
    for (const part of match[1].split(',')) {
      const n = Number(part.trim())
      if (Number.isFinite(n)) sizes.push(n)
    }
  }
  for (const match of t.matchAll(SLUG_DECIMAL_SIZE_RE)) {
    const parsed = parseSlugInchSize(match[1], match[2])
    if (parsed != null) sizes.push(parsed)
  }
  return [...new Set(sizes)]
}

export function extractPieceCount(text: string): number | null {
  const t = String(text ?? '').toLowerCase()
  for (const match of t.matchAll(PIECE_COUNT_RE)) {
    const n = Number(match[1])
    if (Number.isFinite(n)) return n
  }
  return null
}

function signatureTokens(productName: string): string[] {
  return String(productName ?? '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 5 && !STOP_TOKENS.has(t))
}

function hasConflictingProductLine(productName: string, haystack: string): boolean {
  const name = productName.toLowerCase()
  const text = haystack.toLowerCase()
  for (const marker of PRODUCT_LINE_MARKERS) {
    if (text.includes(marker) && !name.includes(marker)) return true
  }
  return false
}

/**
 * @param productName — catalog product title
 * @param url — retailer listing URL
 * @param contextText — Gate 1 row title, source title, etc.
 * @param options.strictMissingSize — when true, product has size but URL does not → fail
 */
export function retailerListingMatchesProductVariant(
  productName: string,
  url: string,
  contextText = '',
  options: { strictMissingSize?: boolean } = {},
): boolean {
  const name = String(productName ?? '').trim()
  const haystack = `${url} ${contextText}`.trim()
  if (!name || !haystack) return false

  if (hasConflictingProductLine(name, haystack)) return false

  const nameSizes = extractInchSizes(name)
  const urlSizes = extractInchSizes(haystack)

  if (nameSizes.length) {
    if (!urlSizes.length) {
      return options.strictMissingSize ? false : true
    }
    const primary = nameSizes[0]
    if (!urlSizes.some((s) => Math.abs(s - primary) < 0.15)) return false
    if (nameSizes.length > 1) {
      for (const s of nameSizes) {
        if (!urlSizes.some((u) => Math.abs(u - s) < 0.15)) return false
      }
    }
  }

  const namePieces = extractPieceCount(name)
  const urlPieces = extractPieceCount(haystack)
  if (namePieces != null && urlPieces != null && namePieces !== urlPieces) return false

  return true
}

/** @deprecated Use retailerListingMatchesProductVariant */
export function retailerUrlMatchesProductVariant(
  productName: string,
  url: string,
): boolean {
  return retailerListingMatchesProductVariant(productName, url, '', {
    strictMissingSize: true,
  })
}
