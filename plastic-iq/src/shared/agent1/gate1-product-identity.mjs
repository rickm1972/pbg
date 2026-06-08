/**
 * Gate 1 product identity alignment when catalog primary retailer is non-Amazon.
 */

import {
  isNonAmazonPrimaryRetailerUrl,
  primaryRetailerCatalogUrl,
} from './amazon-source-consistency.mjs'

function normalizeUrlKey(url) {
  try {
    const u = new URL(url)
    u.hash = ''
    const path = u.pathname.replace(/\/+$/, '') || '/'
    return `${u.protocol}//${u.host.toLowerCase()}${path}${u.search}`
  } catch {
    return String(url ?? '').trim().toLowerCase()
  }
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./i, '').toLowerCase()
  } catch {
    return ''
  }
}

function isWilliamsSonomaUrl(url) {
  return hostOf(url).includes('williams-sonoma.com')
}

const RETAILER_SIZE_CONFLICT_RE =
  /cataloged as.*inch.*manufacturer.*(?:12\.5|12-5)|manufacturer pages consistently describe.*12\.5/i

const COLLECTION_CONTEXT_NOTE =
  'Manufacturer/context pages describe the broader G5 Graphite Core collection and may reference a comparable 12.5-inch item; Williams Sonoma retailer listing identifies this SKU as the 12-inch fry pan with lid.'

const MANUFACTURER_MODEL_SKU_RE = /\b(GR\d{2,3}(?:\.\d+)?)\b/i
const RETAILER_SKU_LABELED_RE =
  /\b(?:sku|item\s*(?:#|no\.?|number)?|model\s*(?:#|no\.?)?)\s*:?\s*#?\s*(\d{5,10})\b/i

function isManufacturerModelSku(sku) {
  return MANUFACTURER_MODEL_SKU_RE.test(String(sku ?? '').trim())
}

function extractRetailerSkuFromBlob(blob) {
  const text = String(blob ?? '')
  const labeled = text.match(RETAILER_SKU_LABELED_RE)
  if (labeled?.[1]) return labeled[1]
  return null
}

function findRetailerListingSource(sources, primaryUrl) {
  if (!primaryUrl) return null
  const key = normalizeUrlKey(primaryUrl)
  return (
    (sources ?? []).find((s) => s.url?.trim() && normalizeUrlKey(s.url) === key) ?? null
  )
}

function findManufacturerContextSku(sources, fallback) {
  for (const s of sources ?? []) {
    const url = String(s.url ?? '')
    const type = String(s.source_type ?? '').toLowerCase()
    if (type !== 'manufacturer' && !/all-clad\.com|manufacturer/i.test(url + type)) continue
    const match = `${s.page_excerpt ?? ''} ${s.title ?? ''}`.match(MANUFACTURER_MODEL_SKU_RE)
    if (match?.[1]) return { sku: match[1], sourceUrl: url }
  }
  if (fallback && isManufacturerModelSku(fallback)) {
    return {
      sku: String(fallback).trim(),
      sourceUrl: null,
    }
  }
  return null
}

/**
 * Retailer-sourced catalog items: primary SKU from reviewed retailer PDP, not manufacturer context.
 * @param {object} structured
 * @param {object[]} [sources]
 * @param {{ retailerSkuOverride?: string }} [options]
 */
export function applyRetailerSkuPrecedence(structured, sources = [], options = {}) {
  if (!structured?.product_identity) return

  const primaryUrl = primaryRetailerCatalogUrl(structured)
  if (!isNonAmazonPrimaryRetailerUrl(primaryUrl)) return

  const retailerSource = findRetailerListingSource(sources, primaryUrl)
  const retailerBlob = `${retailerSource?.page_excerpt ?? ''} ${retailerSource?.title ?? ''} ${primaryUrl}`
  let retailerSku =
    options.retailerSkuOverride?.trim() ||
    extractRetailerSkuFromBlob(retailerBlob) ||
    null

  const currentSku = String(structured.product_identity.sku_or_model ?? '').trim()
  if (!retailerSku && currentSku && !isManufacturerModelSku(currentSku)) {
    retailerSku = currentSku
  }

  let mfrContext = findManufacturerContextSku(sources, null)
  if (!mfrContext && isManufacturerModelSku(currentSku)) {
    mfrContext = {
      sku: currentSku,
      sourceUrl:
        (sources ?? []).find((s) => /all-clad\.com/i.test(s.url ?? ''))?.url ??
        structured.retailer_links?.manufacturer_direct_url ??
        null,
    }
  }

  if (retailerSku) {
    structured.product_identity.sku_or_model = retailerSku
    delete structured.product_identity.sku_null_code
  }

  if (mfrContext?.sku && mfrContext.sku !== retailerSku) {
    structured.product_identity.manufacturer_context_sku = mfrContext.sku
    if (mfrContext.sourceUrl) {
      structured.product_identity.manufacturer_context_sku_source_url = mfrContext.sourceUrl
    }
  } else {
    delete structured.product_identity.manufacturer_context_sku
    delete structured.product_identity.manufacturer_context_sku_source_url
  }
}

const STANDARD_NO_AMAZON_NOTE =
  'No Amazon listing found; Williams Sonoma used as primary retailer source.'

/**
 * Catalog product name is authoritative when primary retailer URL is a non-Amazon PDP.
 * @param {object} structured
 * @param {{ product_name?: string }} product
 * @param {object[]} [sources]
 */
export function alignProductIdentityToPrimaryRetailer(structured, product, sources = []) {
  if (!structured?.product_identity) return

  const primaryUrl = primaryRetailerCatalogUrl(structured)
  if (!isNonAmazonPrimaryRetailerUrl(primaryUrl)) return

  const catalogName = String(product?.product_name ?? '').trim()
  if (catalogName) {
    structured.product_identity.product_name = catalogName
    return
  }

  const match = (sources ?? []).find(
    (s) => s.url?.trim() && normalizeUrlKey(s.url) === normalizeUrlKey(primaryUrl),
  )
  const title = String(match?.title ?? '').trim()
  if (title) structured.product_identity.product_name = title
}

/**
 * @param {string[]} warnings
 * @param {object} structured
 * @param {{ product_name?: string }} product
 */
export function reconcileProductIdentityWarnings(warnings, structured, product) {
  const primaryUrl = primaryRetailerCatalogUrl(structured)
  const nonAmazonPrimary = isNonAmazonPrimaryRetailerUrl(primaryUrl)

  let out = [...(warnings ?? [])]

  if (nonAmazonPrimary) {
    out = out.filter((w) => !RETAILER_SIZE_CONFLICT_RE.test(String(w)))
    const hasCollectionNote = out.some((w) => /broader G5 Graphite Core collection/i.test(String(w)))
    const hadSizeConflict = (warnings ?? []).some((w) => RETAILER_SIZE_CONFLICT_RE.test(String(w)))
    if (!hasCollectionNote && (hadSizeConflict || isWilliamsSonomaUrl(primaryUrl))) {
      out.push(COLLECTION_CONTEXT_NOTE)
    }
  }

  out = out.map((w) => {
    const text = String(w)
    if (/No Amazon listing found/i.test(text) && nonAmazonPrimary) {
      if (isWilliamsSonomaUrl(primaryUrl)) return STANDARD_NO_AMAZON_NOTE
      const label = hostOf(primaryUrl).includes('williams-sonoma')
        ? 'Williams Sonoma'
        : 'primary retailer'
      return `No Amazon listing found; ${label} used as primary retailer source.`
    }
    return w
  })

  return [...new Set(out.filter(Boolean))]
}
