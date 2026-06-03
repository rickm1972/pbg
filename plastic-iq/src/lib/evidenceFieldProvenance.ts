import type {
  EvidenceFieldProvenanceEntry,
  EvidenceSource,
  StructuredEvidencePayload,
} from '../types/agent'

/** Rebuild field_provenance from structured_evidence (mirrors scripts/agent1/field-provenance.mjs). */
export function buildFieldProvenance(
  structured: StructuredEvidencePayload | Record<string, unknown>,
  sources: EvidenceSource[],
): Record<string, EvidenceFieldProvenanceEntry> {
  if (!structured || typeof structured !== 'object') return {}

  const sourceByUrl = new Map(
    (sources ?? []).filter((s) => s?.url).map((s) => [s.url, s]),
  )
  const fields: Record<string, EvidenceFieldProvenanceEntry> = {}

  function quoteForUrl(sourceUrl: string | null | undefined): string | null {
    if (!sourceUrl) return null
    const src = sourceByUrl.get(sourceUrl)
    if (src?.page_excerpt?.trim()) {
      const t = src.page_excerpt.trim()
      return t.length > 500 ? `${t.slice(0, 497)}…` : t
    }
    return src?.title ?? null
  }

  function add(
    path: string,
    value: unknown,
    sourceUrl: string | null | undefined,
    confidence: string | null | undefined,
    quote: string | null | undefined,
  ) {
    if (value == null || value === '') return
    const src = sourceUrl ? sourceByUrl.get(sourceUrl) : undefined
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

  const s = structured as StructuredEvidencePayload & {
    product_identity?: {
      product_name?: string
      brand?: string
    }
    retailer_links?: {
      amazon_url?: string
      manufacturer_direct_url?: string
    }
  }

  const pcm = s.primary_contact_material
  if (pcm) {
    add(
      'primary_contact_material.material_identity',
      pcm.undisclosed_code ?? pcm.material_identity,
      pcm.source_url,
      pcm.confidence_label,
      quoteForUrl(pcm.source_url),
    )
  }

  for (const [i, c] of (s.secondary_components ?? []).entries()) {
    const mat =
      c.material_identity ??
      (c as { null_code?: string; undisclosed_code?: string }).null_code ??
      (c as { undisclosed_code?: string }).undisclosed_code
    add(
      `secondary_components.${i}.material_identity`,
      mat,
      c.source_url,
      c.confidence_label,
      quoteForUrl(c.source_url),
    )
  }

  for (const [i, c] of (s.coatings_and_finishes ?? []).entries()) {
    add(
      `coatings_and_finishes.${i}.coating_name`,
      `${c.coating_name} (${c.coating_type})`,
      c.source_url,
      'manufacturer_confirmed',
      quoteForUrl(c.source_url),
    )
  }

  const verified = s.certifications?.verified_certifications ?? []
  for (const [i, v] of verified.entries()) {
    add(
      `certifications.verified.${i}.cert_name`,
      v.cert_name,
      v.source_url ?? v.registry_url,
      'certification verified',
      quoteForUrl(v.page_source_url ?? v.source_url),
    )
  }

  const sc = s.safety_claims as Record<
    string,
    { claimed?: boolean; source_url?: string | null } | undefined
  > | undefined
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
        add(
          `safety_claims.${key}`,
          true,
          claim.source_url,
          'manufacturer_confirmed',
          quoteForUrl(claim.source_url),
        )
      }
    }
  }

  const pi = s.product_identity
  if (pi) {
    add(
      'product_identity.product_name',
      pi.product_name,
      s.retailer_links?.amazon_url,
      null,
      null,
    )
    add(
      'product_identity.brand',
      pi.brand,
      s.retailer_links?.manufacturer_direct_url,
      null,
      null,
    )
    if (pi.sku_or_model) {
      add('product_identity.sku_or_model', pi.sku_or_model, s.retailer_links?.amazon_url, null, null)
    }
    if (pi.subcategory) {
      add('product_identity.subcategory', pi.subcategory, s.retailer_links?.amazon_url, null, null)
    }
  }

  if (s.product_use_case) {
    add(
      'product_use_case',
      s.product_use_case,
      s.retailer_links?.amazon_url,
      null,
      quoteForUrl(s.retailer_links?.amazon_url),
    )
  }

  return fields
}
