/**
 * Phase 1: build field_provenance JSONB from structured_evidence + sources.
 * Keys use dot-paths; content_hash reserved for Phase 2.
 */

/**
 * @param {Record<string, unknown>} structured
 * @param {{ url: string, fetched_at?: string, page_excerpt?: string, title?: string }[]} sources
 * @returns {Record<string, { value: string, source_url: string | null, source_quote: string | null, confidence_label: string | null, source_fetch_date: string | null, content_hash: string | null }>}
 */
export function buildFieldProvenance(structured, sources) {
  if (!structured || typeof structured !== 'object') return {}

  const sourceByUrl = new Map(
    (sources ?? []).filter((s) => s?.url).map((s) => [s.url, s]),
  )
  /** @type {Record<string, object>} */
  const fields = {}

  /**
   * @param {string} path
   * @param {unknown} value
   * @param {string | null | undefined} sourceUrl
   * @param {string | null | undefined} confidence
   * @param {string | null | undefined} quote
   */
  function add(path, value, sourceUrl, confidence, quote) {
    if (value == null || value === '') return
    const src = sourceUrl ? sourceByUrl.get(sourceUrl) : null
    const display =
      typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
        ? String(value)
        : JSON.stringify(value)

    fields[path] = {
      value: display,
      source_url: sourceUrl ?? null,
      source_quote: quote?.trim() ? quote.trim().slice(0, 2000) : null,
      confidence_label: confidence ?? null,
      source_fetch_date: src?.fetched_at ?? null,
      content_hash: null,
    }
  }

  function quoteForUrl(sourceUrl) {
    if (!sourceUrl) return null
    const src = sourceByUrl.get(sourceUrl)
    if (src?.page_excerpt?.trim()) {
      const t = src.page_excerpt.trim()
      return t.length > 500 ? `${t.slice(0, 497)}…` : t
    }
    return src?.title ?? null
  }

  const pcm = structured.primary_contact_material
  if (pcm) {
    add(
      'primary_contact_material.material_identity',
      pcm.undisclosed_code ?? pcm.material_identity,
      pcm.source_url,
      pcm.confidence_label,
      quoteForUrl(pcm.source_url),
    )
  }

  for (const [i, c] of (structured.secondary_components ?? []).entries()) {
    const mat = c.material_identity ?? c.null_code ?? c.undisclosed_code
    add(
      `secondary_components.${i}.material_identity`,
      mat,
      c.source_url,
      c.confidence_label,
      quoteForUrl(c.source_url),
    )
  }

  for (const [i, c] of (structured.coatings_and_finishes ?? []).entries()) {
    add(
      `coatings_and_finishes.${i}.coating_name`,
      `${c.coating_name} (${c.coating_type})`,
      c.source_url,
      'manufacturer_confirmed',
      quoteForUrl(c.source_url),
    )
  }

  for (const [i, v] of (structured.certifications?.verified_certifications ?? []).entries()) {
    add(
      `certifications.verified.${i}.cert_name`,
      v.cert_name,
      v.source_url ?? v.registry_url,
      'certification verified',
      quoteForUrl(v.page_source_url ?? v.source_url),
    )
  }

  const sc = structured.safety_claims
  if (sc) {
    for (const key of [
      'pfas_free_claim',
      'bpa_free_claim',
      'phthalate_free_claim',
      'lead_free_claim',
      'non_toxic_claim',
    ]) {
      const claim = sc[key]
      if (claim?.claimed && claim.source_url) {
        add(`safety_claims.${key}`, true, claim.source_url, 'manufacturer_confirmed', quoteForUrl(claim.source_url))
      }
    }
  }

  const pi = structured.product_identity
  if (pi) {
    add('product_identity.product_name', pi.product_name, structured.retailer_links?.amazon_url, null, null)
    add('product_identity.brand', pi.brand, structured.retailer_links?.manufacturer_direct_url, null, null)
  }

  if (structured.product_use_case) {
    add(
      'product_use_case',
      structured.product_use_case,
      structured.retailer_links?.amazon_url,
      null,
      quoteForUrl(structured.retailer_links?.amazon_url),
    )
  }

  return fields
}
