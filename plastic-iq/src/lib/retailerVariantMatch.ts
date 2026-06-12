/**
 * Verify retailer listing URLs match product variant (size, set count, product line).
 * Used for public CTAs — fail closed when mismatch is detectable.
 */

const SIZE_IN_TEXT_RE = /(\d+(?:\.\d+)?)\s*(?:inch|in\.?|"|″|\u201d|\u2033)/gi
/** Slug form: `12-inch`, `10-25-inch` — not bare `5-graphite` from product lines like G5. */
const SIZE_HYPHEN_INCH_SLUG_RE = /(\d+(?:\.\d+)?)-inch\b/gi
/** Fractional inch slugs: `10-1-4` → 10.25 (10¼″). Must run before two-part slug decimal. */
const FRACTIONAL_QUARTER_INCH_SLUG_RE = /\b(\d{1,2})-1-4\b/gi
const FRACTIONAL_HALF_INCH_SLUG_RE = /\b(\d{1,2})-1-2\b/gi
const FRACTIONAL_THREE_QUARTER_INCH_SLUG_RE = /\b(\d{1,2})-3-4\b/gi
/** Size before cookware noun: `Seasoned-12-Skillet`, `10-25-cast-iron-skillet`. */
const SLUG_SIZE_BEFORE_COOKWARE_RE =
  /(?:^|[-/])(\d+(?:\.\d+)?)-(?:cast[-/])?(?:iron[-/])?(?:skillet|pan|frypan|frying|wok|griddle|pot|dutch-oven|cookware)\b/gi
/** Walmart-style slugs: `Nonstick-8-Fry-Pan`. */
const SLUG_SIZE_BEFORE_FRY_PAN_RE = /(?:^|[-/])(\d{1,2})-(?:fry-)?pan\b/gi
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
  /(\d+(?:\.\d+)?(?:\s*,\s*\d+(?:\.\d+)?)+)\s*(?:inch|in\.?|"|″|\u201d|\u2033)/gi

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
  for (const match of t.matchAll(SIZE_HYPHEN_INCH_SLUG_RE)) {
    const n = Number(match[1])
    if (Number.isFinite(n)) sizes.push(n)
  }
  for (const match of t.matchAll(FRACTIONAL_QUARTER_INCH_SLUG_RE)) {
    const n = Number(match[1])
    if (Number.isFinite(n)) sizes.push(n + 0.25)
  }
  for (const match of t.matchAll(FRACTIONAL_HALF_INCH_SLUG_RE)) {
    const n = Number(match[1])
    if (Number.isFinite(n)) sizes.push(n + 0.5)
  }
  for (const match of t.matchAll(FRACTIONAL_THREE_QUARTER_INCH_SLUG_RE)) {
    const n = Number(match[1])
    if (Number.isFinite(n)) sizes.push(n + 0.75)
  }
  for (const match of t.matchAll(SLUG_SIZE_BEFORE_COOKWARE_RE)) {
    const n = Number(match[1])
    if (Number.isFinite(n) && n >= 4 && n <= 20) sizes.push(n)
  }
  for (const match of t.matchAll(SLUG_SIZE_BEFORE_FRY_PAN_RE)) {
    const n = Number(match[1])
    if (Number.isFinite(n) && n >= 4 && n <= 20) sizes.push(n)
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
 * True only when variant conflict is confirmed (product line, piece count, or credible inch size).
 * Approved listings fail open when the matcher cannot confirm a mismatch.
 */
export function retailerListingHasConfirmedVariantMismatch(
  productName: string,
  url: string,
  contextText = '',
): boolean {
  const name = String(productName ?? '').trim()
  const haystack = `${url} ${contextText}`.trim()
  if (!name || !haystack) return false

  if (hasConflictingProductLine(name, haystack)) return true

  const nameSizes = extractInchSizes(name)
  const urlSizes = extractInchSizes(haystack)

  if (nameSizes.length && urlSizes.length) {
    const primary = nameSizes[0]
    if (!urlSizes.some((s) => Math.abs(s - primary) < 0.15)) return true
    // Multi-size products: require every listed size only when the URL also lists multiple sizes.
    if (nameSizes.length > 1 && urlSizes.length > 1) {
      for (const s of nameSizes) {
        if (!urlSizes.some((u) => Math.abs(u - s) < 0.15)) return true
      }
    }
  }

  const namePieces = extractPieceCount(name)
  const urlPieces = extractPieceCount(haystack)
  if (namePieces != null && urlPieces != null && namePieces !== urlPieces) return true

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
  if (retailerListingHasConfirmedVariantMismatch(productName, url, contextText)) {
    return false
  }

  const name = String(productName ?? '').trim()
  const haystack = `${url} ${contextText}`.trim()
  if (!name || !haystack) return false

  const nameSizes = extractInchSizes(name)
  const urlSizes = extractInchSizes(haystack)

  if (nameSizes.length && !urlSizes.length && options.strictMissingSize) {
    return false
  }

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
