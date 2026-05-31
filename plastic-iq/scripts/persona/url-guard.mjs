/**
 * Reject malformed, cloaked, or spam URLs before they enter the persona pipeline.
 */

const BASE64_BLOB_RE = /[A-Za-z0-9+/]{100,}={0,3}/
const CLOAKED_REDIRECT_RE =
  /\b(goog_?le_?cm|gclid=|fbclid=|utm_[a-z]+=.*utm_|doubleclick|click\.|track\.|redirect\.)/i

/**
 * @param {string} url
 */
export function isMalformedOrSpamUrl(url) {
  const s = String(url ?? '').trim()
  if (!s) return true
  if (!/^https?:\/\//i.test(s)) return true
  if (s.length > 400) return true
  if (/^(data|javascript|vbscript):/i.test(s)) return true
  if (/%00|\\x[0-9a-f]{2}/i.test(s)) return true
  if (BASE64_BLOB_RE.test(s)) return true
  if (CLOAKED_REDIRECT_RE.test(s) && s.length > 200) return true

  try {
    const u = new URL(s)
    const host = u.hostname.toLowerCase()
    if (!host || !host.includes('.')) return true
    if (host === 'localhost' || host.endsWith('.local')) return true
    const pathAndQuery = `${u.pathname}${u.search}`
    if (BASE64_BLOB_RE.test(pathAndQuery)) return true
  } catch {
    return true
  }

  return false
}

/**
 * @param {string} claim
 */
export function isPlaceholderClaim(claim) {
  const c = String(claim ?? '').trim()
  if (!c) return true
  return /^referenced in retrieval$/i.test(c)
}

export function normalizeSourceUrl(url) {
  try {
    const u = new URL(String(url).trim())
    u.hash = ''
    const host = u.hostname.toLowerCase().replace(/^www\./, '')
    const path = u.pathname.replace(/\/+$/, '') || ''
    return `${u.protocol}//${host}${path}${u.search}`
  } catch {
    return String(url ?? '').trim()
  }
}
