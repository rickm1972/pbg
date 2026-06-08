/**
 * Render-time source label polish — does not mutate frozen snapshots.
 */

import type { AprDisplaySource } from '../../types/apr'

const RAW_URL_LABEL_RE = /^https?:\/\//i
const GENERIC_MANUFACTURER_LABEL_RE = /^manufacturer product$/i

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, '').toLowerCase()
  } catch {
    return ''
  }
}

function pathnameOf(url: string): string {
  try {
    return new URL(url).pathname
  } catch {
    return ''
  }
}

const DOMAIN_DISPLAY_NAMES: Record<string, string> = {
  'pca.state.mn.us': 'Minnesota Pollution Control Agency',
  't-fal.ca': 'T-Fal',
  't-fal.com': 'T-Fal',
  'lodgecastiron.com': 'Lodge',
  'carawayhome.com': 'Caraway',
  'all-clad.com': 'All-Clad',
  'thenewknew.com': 'The New Knew',
}

function slugSegmentToLabel(segment: string): string {
  const cleaned = segment.replace(/\.[a-z0-9]+$/i, '').trim()
  if (!cleaned) return ''
  const words = cleaned.split('-').filter(Boolean)
  if (!words.length) return ''
  const phrase = words.join(' ')
  return phrase.charAt(0).toUpperCase() + phrase.slice(1)
}

function pathToReadablePhrase(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean)
  if (!segments.length) return ''

  const last = segments[segments.length - 1]
  if (/^pfoas?$/i.test(last)) return 'PFOA information'
  if (/^2025-pfas-prohibitions$/i.test(last)) return '2025 PFAS prohibitions'

  if (segments.includes('pages') && segments.length >= 2) {
    return slugSegmentToLabel(segments[segments.length - 1])
  }
  if (segments.includes('products') && segments.length >= 2) {
    return slugSegmentToLabel(segments[segments.length - 1])
  }

  return slugSegmentToLabel(last)
}

function deriveLabelFromUrl(url: string, group: string): string {
  const host = hostOf(url)
  const pathname = pathnameOf(url)
  const brand = DOMAIN_DISPLAY_NAMES[host] ?? null
  const pathPhrase = pathToReadablePhrase(pathname)

  if (host === 'pca.state.mn.us' && /pfas-prohibitions/i.test(pathname)) {
    return 'Minnesota Pollution Control Agency — 2025 PFAS prohibitions'
  }
  if (host === 't-fal.ca' && /pfoas/i.test(pathname)) {
    return 'T-Fal — PFOA information'
  }

  if (brand && pathPhrase) {
    if (group === 'Manufacturer' && /product guide/i.test(pathPhrase)) {
      return `${brand} — ${pathPhrase}`
    }
    if (group === 'Manufacturer') {
      return `${brand} — ${pathPhrase}`
    }
    if (group === 'Context' && brand) {
      return `${brand} — ${pathPhrase}`
    }
    return `${brand} — ${pathPhrase}`
  }

  if (pathPhrase && host) {
    const hostLabel = host.replace(/\.(com|org|gov|ca|us)$/i, '').split('.').pop() ?? host
    return `${hostLabel.charAt(0).toUpperCase() + hostLabel.slice(1)} — ${pathPhrase}`
  }

  if (brand) return brand

  try {
    const u = new URL(url)
    return u.hostname.replace(/^www\./i, '')
  } catch {
    return url
  }
}

export function isRawUrlSourceLabel(label: string): boolean {
  return RAW_URL_LABEL_RE.test(label.trim())
}

export function isGenericManufacturerSourceLabel(label: string): boolean {
  return GENERIC_MANUFACTURER_LABEL_RE.test(label.trim())
}

export function needsSourceLabelPolish(label: string): boolean {
  const trimmed = label.trim()
  if (!trimmed) return true
  return isRawUrlSourceLabel(trimmed) || isGenericManufacturerSourceLabel(trimmed)
}

/** Resolve human-readable source link label for public render. */
export function polishDisplaySourceLabel(source: AprDisplaySource): string {
  const label = source.label?.trim() ?? ''
  if (label && !needsSourceLabelPolish(label)) {
    return label
  }
  return deriveLabelFromUrl(source.url, source.group)
}

export function polishDisplaySources(sources: AprDisplaySource[]): AprDisplaySource[] {
  return sources.map((source) => ({
    ...source,
    label: polishDisplaySourceLabel(source),
  }))
}
