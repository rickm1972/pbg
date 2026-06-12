/**
 * Public product page — source role classification (display only; no evidence mutation).
 */

import { isThirdPartySource } from '../shared/agent1/source-authority.mjs'

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, '').toLowerCase()
  } catch {
    return ''
  }
}

const VIDEO_HOST_RE = /youtube\.com|youtu\.be|vimeo\.com/i

/** Cross-brand article markers — suppress on unrelated product pages. */
const CROSS_BRAND_ARTICLE_RE = [
  { brandToken: 'greenpan', foreign: /\bhexclad\b/i },
  { brandToken: 'caraway', foreign: /\bhexclad\b/i },
  { brandToken: 'hexclad', foreign: /\bgreenpan\b/i },
]

export function isVideoContextHost(url: string): boolean {
  return VIDEO_HOST_RE.test(hostOf(url))
}

export function manufacturerHostMatchesBrand(url: string, brand: string | null | undefined): boolean {
  const normalizedBrand = String(brand ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
  if (!normalizedBrand) return false
  const host = hostOf(url).replace(/[^a-z0-9]/g, '')
  return host.includes(normalizedBrand)
}

/**
 * True when URL/title primarily discusses a different scored brand (e.g. HexClad on GreenPan page).
 */
export function isCrossBrandContextArticle(
  url: string,
  title: string,
  brand: string | null | undefined,
): boolean {
  const brandNorm = String(brand ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
  if (!brandNorm) return false
  const hay = `${url} ${title}`.toLowerCase()

  for (const rule of CROSS_BRAND_ARTICLE_RE) {
    if (brandNorm.includes(rule.brandToken) && rule.foreign.test(hay) && !hay.includes(brandNorm)) {
      return true
    }
  }

  if (/\bhexclad\b/i.test(hay) && !brandNorm.includes('hexclad') && !/\bgreenpan\b/i.test(hay)) {
    return true
  }

  return false
}

/**
 * Whether a Gate 1 / evidence source should be treated as manufacturer-domain confirmation on the public page.
 */
export function isLegitimateManufacturerPublicSource(
  source: { source_type?: string | null; url?: string | null } | null | undefined,
  url: string,
  brand: string | null | undefined,
): boolean {
  if (!url?.trim()) return false
  if (isThirdPartySource(source ?? { url }, url)) return false
  if (isVideoContextHost(url)) return false
  if (!manufacturerHostMatchesBrand(url, brand)) return false
  return true
}
