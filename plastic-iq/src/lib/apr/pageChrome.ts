/** Static layout copy allowed on the public product page (not product-specific truth). */

export const PUBLIC_SCORE_PENDING_MESSAGE = 'Product not yet reviewed'

export const SAFER_ALTERNATIVES_COMING_SOON =
  'Safer alternatives coming soon — we’re reviewing lower-risk options in this category.'

/** Generic buy section fallback when display.buy_section_title is absent. */
export const DEFAULT_BUY_SECTION_TITLE = 'Where to buy'

/** Muted buy-button styling for lower PAC tiers — layout only. */
export function buyButtonsUseMutedStyle(tier: string): boolean {
  return tier !== 'Excellent' && tier !== 'Good'
}

/**
 * Genuinely static site chrome exempt from renderer invented-text fixture.
 * Must not include product-specific copy.
 */
export const STATIC_SITE_CHROME_STRINGS = [
  PUBLIC_SCORE_PENDING_MESSAGE,
  SAFER_ALTERNATIVES_COMING_SOON,
  DEFAULT_BUY_SECTION_TITLE,
  'Home',
  'Loading…',
  'Product not found.',
  'PAC Safety Score',
  'How we measure risk',
  'Why this score?',
  'Safer alternatives',
  'PAC Safety Score tiers',
  'Links open in a new tab.',
  'No verified retailer listings for this product yet.',
  'See more alternatives',
  'Loading alternatives…',
  'No retailer link',
  'Structured score breakdown will appear after normalization is approved for this product.',
  'FTC disclosure: PlasticBegone may earn a commission if you purchase through affiliate links. Ratings are independent and based on our PAC Safety Score methodology.',
  'Bars summarize each factor: longer green bars indicate lower concern, while shorter red bars indicate higher concern.',
  'Every product is evaluated on three factors:',
  'Contact material — what material touches your food, drink, or skin',
  'Migration — how easily that material transfers chemicals',
  'Use conditions — how intensely the product is used (heat, fat, contact time)',
  'Risk emerges when all three factors combine. Some products can still score well even when one factor is concerning — for example, cast iron cookware faces harsh use conditions but remains low concern because the material is inert.',
] as const

export function isStaticSiteChromeString(value: string): boolean {
  const t = value.trim()
  if (!t) return true
  return STATIC_SITE_CHROME_STRINGS.some((chrome) => chrome === t)
}
