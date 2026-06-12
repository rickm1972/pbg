/** Cosmetic public source link labels — section headers carry role; titles stay clean. */

import { extractInchSizes } from './retailerVariantMatch'
import { hostOf } from './publicSourceDisplay'

const ROLE_PREFIX_RE =
  /^(?:Manufacturer(?:\s+(?:product page|materials page|construction page|context))?|Primary retailer listing|Retailer listing|Third-party review|Context source(?: only)?):\s*/i

export function stripPublicSourceRolePrefix(title: string): string {
  let t = String(title ?? '').trim()
  while (ROLE_PREFIX_RE.test(t)) {
    t = t.replace(ROLE_PREFIX_RE, '').trim()
  }
  return t
}

export function isFilenameLikeSourceTitle(title: string): boolean {
  const t = String(title ?? '').trim()
  if (!t) return true
  if (/\.html?$/i.test(t)) return true
  if (/^[\w-]+\.html?$/i.test(t)) return true
  if (/^[\w\s-]+\.html?$/i.test(t) && !/\s/.test(t.replace(/\.html?$/i, ''))) return true
  return false
}

const GENERIC_MANUFACTURER_TITLE_RE =
  /^(?:hybrid|home|shop|product|products|collections|collection|learn\s*more)$/i

export function isGenericManufacturerSourceTitle(title: string): boolean {
  const t = stripPublicSourceRolePrefix(title).trim()
  if (!t || t.length < 3) return true
  return GENERIC_MANUFACTURER_TITLE_RE.test(t)
}

/** Detect scrape/size artifacts like "12 5 Inch page" in public labels. */
export function containsPublicSizeArtifact(title: string): boolean {
  const t = String(title ?? '').trim()
  if (!t) return false
  if (/\b\d+\s+\d+\s*(?:inch|in\.?)\b/i.test(t)) return true
  if (/\b\d+\s+\d+\s*inch\s+page\b/i.test(t)) return true
  if (/\b\d+(?:\.\d+)?\s*[-\s]?(?:inch|in\.?|")\b/i.test(t)) return true
  const sizes = extractInchSizes(t)
  return sizes.length > 0
}

export function isMalformedPublicSourceTitle(title: string): boolean {
  const t = String(title ?? '').trim()
  if (!t || t.length < 3) return true
  if (/,\s*$|^,\s*|,\s*,/.test(t)) return true
  if (isFilenameLikeSourceTitle(t)) return true
  if (/\bpage$/i.test(t) && containsPublicSizeArtifact(t)) return true
  if (/\b\d+\s+\d+\s*inch\b/i.test(t)) return true
  return false
}

/** Remove scrape artifacts, dangling punctuation, and file extensions from a source title. */
export function sanitizePublicSourceTitleText(title: string): string {
  let t = stripPublicSourceRolePrefix(title)
  t = t.replace(/\.html?$/i, '').trim()
  t = t.replace(/\b\d+(?:\.\d+)?\s*[-\s]?(?:inch|in\.?|").*$/i, '')
  t = t.replace(/\b\d+\s+\d+\s*(?:inch|in\.?)\b.*$/i, '')
  t = t.replace(/\bskillet with lid\b/i, '')
  t = t.replace(/\s+page$/i, '')
  t = t.replace(/,\s*,+/g, ',')
  t = t.replace(/,\s*$/g, '')
  t = t.replace(/^\s*,+\s*/g, '')
  t = t.replace(/\s+,/g, ',')
  t = t.replace(/,\s*$/g, '')
  t = t.replace(/\s{2,}/g, ' ')
  return t.trim()
}

function titleCaseSlug(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((word) => {
      if (/^g5$/i.test(word)) return 'G5'
      if (/^html$/i.test(word)) return ''
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    })
    .filter(Boolean)
    .join(' ')
}

function brandNameFromHost(url: string, brand?: string | null): string | null {
  const explicit = String(brand ?? '').trim()
  if (explicit) return explicit
  const base = hostOf(url).split('.')[0] ?? ''
  if (!base || base.length < 2) return null
  return base
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('-')
}

export function urlPathContainsSizeSlug(path: string): boolean {
  return /\d+-\d+(-inch)?|\d+-inch|\d+-\d+-inch|12-5|10-25|12-5-inch/i.test(path)
}

function neutralNameFromProductPath(path: string): string | null {
  const match = path.match(/\/(?:products?|shop|cookware)\/([^/]+)/i)
  if (!match?.[1]) return null
  const slug = match[1].replace(/\.html?$/i, '')
  if (!urlPathContainsSizeSlug(slug) && !/\d+/.test(slug.split('-').pop() ?? '')) {
    const name = titleCaseSlug(slug)
    return name || null
  }
  const prefix = slug.split(/\d+-\d+-inch|\d+-\d+-|\d+-inch|\d+-ply/i)[0]?.replace(/-+$/, '') ?? ''
  const trimmed = prefix.replace(/-(skillet|with|lid|bonded|ply|cookware)$/i, '').replace(/-+$/, '')
  const name = titleCaseSlug(trimmed)
  return name || null
}

/** Clean fallback when scrape title is missing, malformed, or variant-mismatched. */
export function manufacturerFallbackTitleFromUrl(url: string, brand?: string | null): string {
  const manufacturerBrand = brandNameFromHost(url, brand)
  try {
    const path = new URL(url).pathname
    const collection = path.match(/collections\/([^/]+?)(?:\.html?)?\/?$/i)
    if (collection?.[1]) {
      const name = titleCaseSlug(collection[1].replace(/\.html?$/i, ''))
      if (name) {
        const label = `${name} cookware collection`
        return manufacturerBrand ? `${manufacturerBrand} ${label}` : label
      }
    }

    const fromProductPath = neutralNameFromProductPath(path)
    if (fromProductPath || urlPathContainsSizeSlug(path) || /\/products?\//i.test(path)) {
      const core = fromProductPath ?? 'Cookware'
      const label = `${core} cookware construction page`
      return manufacturerBrand ? `${manufacturerBrand} ${label}` : label
    }

    const page = path.match(/\/([^/]+?)\.html?$/i)
    if (page?.[1] && !/^index$/i.test(page[1]) && !urlPathContainsSizeSlug(page[1])) {
      const name = titleCaseSlug(page[1].replace(/\.html?$/i, ''))
      if (name && !containsPublicSizeArtifact(name)) {
        const label = `${name} page`
        return manufacturerBrand ? `${manufacturerBrand} ${label}` : label
      }
    }
  } catch {
    /* ignore */
  }
  return manufacturerBrand
    ? `${manufacturerBrand} cookware construction page`
    : 'Manufacturer cookware construction page'
}

export function retailerFallbackTitleFromUrl(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./i, '')
    const segment = host.split('.')[0] ?? 'Retailer'
    return segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ')
  } catch {
    return 'Retailer listing'
  }
}

export function contextFallbackTitleFromUrl(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./i, '')
    return host || 'Background source'
  } catch {
    return 'Background source'
  }
}
