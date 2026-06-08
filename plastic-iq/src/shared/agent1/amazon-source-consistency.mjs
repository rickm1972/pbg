/**
 * Align Agent 1 Amazon warnings with recorded retailer_links / source rows.
 * Catalog Amazon URL may be present while Stage 1a web_search retrieval failed.
 */

const AMAZON_UNAVAILABLE_WARNING_RE =
  /amazon\s+(?:product\s+)?url\s+(?:was\s+)?(?:not\s+available|unavailable|missing)|amazon\s+listing\s+(?:was\s+)?(?:not\s+available|unavailable)|amazon\s+retrieval\s+(?:failed|unavailable)/i

/**
 * @param {string} warning
 */
export function isAmazonUnavailableWarning(warning) {
  return AMAZON_UNAVAILABLE_WARNING_RE.test(String(warning ?? ''))
}

function isAmazonHostname(url) {
  try {
    const host = new URL(url.startsWith('http') ? url : `https://${url}`).hostname
      .replace(/^www\./i, '')
      .toLowerCase()
    return /amazon\.(com|ca|co\.uk|de|fr)$/i.test(host)
  } catch {
    return /amazon\.(com|ca|co\.uk|de|fr)/i.test(String(url ?? ''))
  }
}

/**
 * True only when a catalog or source URL is an actual Amazon domain (not Williams Sonoma / DTC mislabeled as amazon_url).
 * @param {object} structured
 * @param {object[]} [sources]
 */
export function hasRecordedAmazonUrl(structured, sources = []) {
  const catalog = structured?.retailer_links?.amazon_url?.trim()
  if (catalog && isAmazonHostname(catalog)) return true
  return (sources ?? []).some(
    (s) =>
      (s.source_type === 'amazon' && isAmazonHostname(s.url ?? '')) ||
      isAmazonHostname(s.url ?? ''),
  )
}

/** Catalog primary retailer URL (legacy field name `amazon_url` may hold non-Amazon PDP). */
export function primaryRetailerCatalogUrl(structured) {
  return structured?.retailer_links?.amazon_url?.trim() ?? ''
}

/**
 * @param {string} url
 */
export function isNonAmazonPrimaryRetailerUrl(url) {
  const u = String(url ?? '').trim()
  return Boolean(u) && !isAmazonHostname(u)
}

export function hasPrimaryRetailerUrl(structured) {
  return Boolean(primaryRetailerCatalogUrl(structured))
}

/**
 * @param {string[]} warnings
 * @param {object} structured
 * @param {object | null | undefined} amazonRetrieval — Stage 1a `amazon_anthropic_web_search` result
 * @param {object[]} [sources]
 */
export function reconcileAmazonRetrievalWarnings(warnings, structured, amazonRetrieval, sources = []) {
  const amazonUrl = structured?.retailer_links?.amazon_url?.trim() ?? ''
  const hasAmazonUrl = hasRecordedAmazonUrl(structured, sources)

  let out = (warnings ?? []).filter((w) => {
    if (!hasAmazonUrl) return true
    return !isAmazonUnavailableWarning(w)
  })

  const retrievalAttempted = amazonRetrieval != null
  const retrievalOk = amazonRetrieval?.ok === true

  if (hasAmazonUrl && retrievalAttempted && !retrievalOk) {
    const detail = amazonRetrieval.error ?? 'no excerpt returned'
    const msg = `Primary Amazon/retailer page retrieval did not return usable content (${detail}); catalog URL recorded as supporting link: ${amazonUrl}`
    if (!out.some((w) => /retrieval did not return usable content/i.test(w))) {
      out.push(msg)
    }
  }

  return out
}

/**
 * @param {string} blocker
 */
export function isContradictoryAmazonMissingBlocker(blocker, hasAmazonUrl) {
  if (!hasAmazonUrl) return false
  return /amazon.*(?:not available|unavailable|missing)/i.test(String(blocker ?? ''))
}
