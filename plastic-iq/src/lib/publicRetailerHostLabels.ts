import { normalizeUrlKey, hostOf } from './publicSourceDisplay'

const KNOWN_RETAILER_HOST_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /amazon\.(com|ca|co\.uk|de|fr)|^a\.co$/i, label: 'Amazon' },
  { pattern: /target\.com/i, label: 'Target' },
  { pattern: /walmart\.com/i, label: 'Walmart' },
  { pattern: /williams-sonoma\.com/i, label: 'Williams Sonoma' },
  { pattern: /crateandbarrel\.com/i, label: 'Crate & Barrel' },
  { pattern: /surlatable\.com/i, label: 'Sur La Table' },
  { pattern: /costco\.com/i, label: 'Costco' },
  { pattern: /homedepot\.com/i, label: 'Home Depot' },
  { pattern: /lowes\.com/i, label: "Lowe's" },
  { pattern: /bestbuy\.com/i, label: 'Best Buy' },
]

export function isKnownRetailerHost(host: string): boolean {
  const h = String(host ?? '').toLowerCase()
  return KNOWN_RETAILER_HOST_PATTERNS.some(({ pattern }) => pattern.test(h))
}

export function isAmazonHost(host: string): boolean {
  return /amazon\.(com|ca|co\.uk|de|fr)|^a\.co$/i.test(String(host ?? ''))
}

/** Display name for a retailer PDP host — not manufacturer brand. */
export function retailerDisplayNameFromHost(host: string): string | null {
  const h = String(host ?? '').toLowerCase()
  for (const { pattern, label } of KNOWN_RETAILER_HOST_PATTERNS) {
    if (pattern.test(h)) return label
  }
  return null
}

type ProductRetailerFields = {
  brand?: string | null
  other_retailer_label?: string | null
  other_retailer_url?: string | null
}

/**
 * Public buy-button label source: primary retailer host or explicit other_retailer_label.
 * Manufacturer brand is only used when the URL is not a known retailer host.
 */
export function retailerDisplayNameFromProductUrl(
  url: string,
  product?: ProductRetailerFields | null,
): string | null {
  const trimmed = String(url ?? '').trim()
  if (!trimmed) return null

  if (
    product?.other_retailer_url?.trim() &&
    normalizeUrlKey(product.other_retailer_url) === normalizeUrlKey(trimmed)
  ) {
    const explicit = String(product.other_retailer_label ?? '').trim()
    if (explicit) return explicit
  }

  const fromHost = retailerDisplayNameFromHost(hostOf(trimmed))
  if (fromHost) return fromHost

  return null
}

export function isPrimaryRetailerReviewerLabel(reviewerLabel: string): boolean {
  const label = String(reviewerLabel ?? '').trim()
  return (
    label === 'Amazon listing' ||
    label === 'Williams Sonoma listing' ||
    label === 'Primary retailer listing' ||
    label === 'Target listing' ||
    label === 'Walmart listing' ||
    label === 'Costco listing' ||
    label === 'Crate & Barrel listing' ||
    label === 'Sur La Table listing' ||
    /retailer listing$/i.test(label)
  )
}
