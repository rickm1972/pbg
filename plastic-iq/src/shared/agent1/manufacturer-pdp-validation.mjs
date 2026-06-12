/**
 * Global manufacturer PDP validation — not product-specific.
 * Distinguishes homepage / collection / product detail / region-mismatch / identity-only sources.
 */

const MATERIAL_EVIDENCE_RE =
  /coating|nonstick|non[-\s]?stick|terrabond|terra\s*bond|ceramic|sol[-\s]?gel|ptfe|pfas|pfoa|pfos|stainless|material|proprietary|hybrid|lab\s*result|test\s*result|third[-\s]?party\s*test|forever chemicals|non[-\s]?detect|light\s*labs|tablelab/i

const PRODUCT_IDENTITY_RE =
  /fry\s*pan|skillet|saucepan|stockpot|wok|inch|cm\b|liter|quart|model|sku|hybrid/i

const HOMEPAGE_PATH_RE = /^\/(?:$|home(?:page)?|index(?:\.html)?)$/i
const COLLECTION_PATH_RE = /\/collections?\//i
const PRODUCT_PATH_RE = /\/products?\//i

const REGIONAL_TLD_RE = /\.(eu|ca|co\.uk|de|fr|au|nz)(?:\/|$)/i

/**
 * @param {string} url
 * @returns {'homepage' | 'collection' | 'product_detail' | 'other'}
 */
export function classifyManufacturerUrlKind(url) {
  if (!url?.trim()) return 'other'
  try {
    const path = new URL(url).pathname.replace(/\/+$/, '') || '/'
    if (HOMEPAGE_PATH_RE.test(path)) return 'homepage'
    if (COLLECTION_PATH_RE.test(path) && !PRODUCT_PATH_RE.test(path)) return 'collection'
    if (PRODUCT_PATH_RE.test(path)) return 'product_detail'
    return 'other'
  } catch {
    return 'other'
  }
}

/**
 * @param {string} url
 * @param {string} [retailerRegion]
 */
export function detectManufacturerRegionMismatch(url, retailerRegion = 'US') {
  if (!url || retailerRegion !== 'US') return false
  return REGIONAL_TLD_RE.test(url)
}

/**
 * @param {string} url
 * @param {string | null | undefined} brand
 */
export function manufacturerHostMatchesBrand(url, brand) {
  const normalizedBrand = String(brand ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
  if (!normalizedBrand) return false
  try {
    const host = new URL(url).hostname.replace(/^www\./i, '').toLowerCase().replace(/[^a-z0-9]/g, '')
    return host.includes(normalizedBrand)
  } catch {
    return false
  }
}

/**
 * @param {string} text
 * @param {string} productName
 */
export function productNameMatchScore(text, productName) {
  const blob = String(text ?? '').toLowerCase()
  const name = String(productName ?? '').toLowerCase().trim()
  if (!name || !blob) return 0
  const tokens = name.split(/\s+/).filter((t) => t.length > 2)
  if (!tokens.length) return 0
  const hits = tokens.filter((t) => blob.includes(t)).length
  return hits / tokens.length
}

/**
 * @param {object} source
 */
export function sourceSupportsMaterialEvidence(source) {
  let urlPath = ''
  try {
    if (source?.url) {
      const parsed = new URL(source.url)
      urlPath = `${parsed.pathname} ${parsed.search}`.replace(/[-_/]+/g, ' ')
    }
  } catch {
    /* ignore */
  }
  const text = `${source?.page_excerpt ?? ''} ${source?.title ?? ''} ${urlPath}`.trim()
  return MATERIAL_EVIDENCE_RE.test(text)
}

/**
 * @param {object} source
 * @param {{ product_name?: string, brand?: string }} product
 */
export function sourceSupportsProductIdentity(source, product) {
  const text = `${source?.page_excerpt ?? ''} ${source?.title ?? ''} ${source?.url ?? ''}`
  const nameScore = productNameMatchScore(text, product.product_name ?? '')
  const brand = String(product.brand ?? '').toLowerCase()
  const hasBrand = brand && text.toLowerCase().includes(brand)
  const hasProductCue = PRODUCT_IDENTITY_RE.test(text) || nameScore >= 0.4
  return hasBrand || nameScore >= 0.35 || hasProductCue
}

/**
 * @param {object} source
 */
function sourceTextForProductMatch(source) {
  let urlSlug = ''
  try {
    if (source?.url) {
      urlSlug = new URL(source.url).pathname.replace(/\/products?\//i, ' ').replace(/[-_/]+/g, ' ')
    }
  } catch {
    /* ignore */
  }
  return `${source?.page_excerpt ?? ''} ${source?.title ?? ''} ${urlSlug}`.trim()
}

/**
 * @param {object} source
 * @param {{ product_name?: string, brand?: string }} product
 * @param {object} [structured]
 */
export function validateManufacturerSource(source, product, structured = {}) {
  const url = source?.url ?? structured?.retailer_links?.manufacturer_direct_url ?? ''
  const kind = classifyManufacturerUrlKind(url)
  const regionMismatch = detectManufacturerRegionMismatch(url)
  const brandMatch = manufacturerHostMatchesBrand(url, product.brand ?? structured?.product_identity?.brand)
  const materialSupport = sourceSupportsMaterialEvidence(source)
  const identitySupport = sourceSupportsProductIdentity(source, product)
  const productNameScore = productNameMatchScore(
    sourceTextForProductMatch(source),
    product.product_name ?? structured?.product_identity?.product_name ?? '',
  )

  /** @type {string[]} */
  const issues = []
  let code = null

  if (!url) {
    return {
      code: 'MANUFACTURER_URL_MISSING',
      passed: false,
      url_kind: 'other',
      region_mismatch: false,
      brand_match: false,
      supports_material_evidence: false,
      supports_product_identity: false,
      product_name_match_score: 0,
      issues: ['No manufacturer URL present.'],
    }
  }

  if (kind === 'homepage') {
    issues.push('Manufacturer homepage cannot satisfy product-specific material evidence.')
    code = code ?? 'MANUFACTURER_PDP_NOT_VALIDATED'
  }
  if (kind === 'collection' && !materialSupport) {
    issues.push('Manufacturer collection page without product-specific material/coating details.')
    code = code ?? 'MANUFACTURER_PDP_NOT_VALIDATED'
  }
  if (kind === 'product_detail' && productNameScore < 0.25 && !materialSupport) {
    issues.push('Manufacturer product URL does not match reviewed product name or materials.')
    code = code ?? 'MANUFACTURER_PDP_NOT_VALIDATED'
  }
  if (regionMismatch && !materialSupport) {
    issues.push('Manufacturer source region may not match US retailer SKU (region_mismatch).')
    code = code ?? 'MANUFACTURER_PDP_NOT_VALIDATED'
  }
  if (identitySupport && !materialSupport && kind !== 'product_detail') {
    issues.push(
      'Manufacturer source supports brand/identity only and does not validate product-specific material/coating evidence.',
    )
    code = code ?? 'MANUFACTURER_PDP_NOT_VALIDATED'
  }
  if (!brandMatch && kind !== 'other') {
    issues.push('Manufacturer domain does not match product brand.')
  }

  const passed =
    kind === 'product_detail' &&
    materialSupport &&
    (productNameScore >= 0.25 || identitySupport) &&
    !regionMismatch &&
    brandMatch

  return {
    code: passed ? null : code ?? (materialSupport ? null : 'MANUFACTURER_PDP_NOT_VALIDATED'),
    passed,
    url_kind: kind,
    region_mismatch: regionMismatch,
    brand_match: brandMatch,
    supports_material_evidence: materialSupport,
    supports_product_identity: identitySupport,
    product_name_match_score: productNameScore,
    issues,
    url,
  }
}

/**
 * Coated / nonstick / proprietary products require validated manufacturer PDP for material claims.
 * @param {import('../canonical-taxonomy/types.mjs').CanonicalMappingsPayload | null | undefined} mappings
 */
export function requiresManufacturerMaterialEvidence(mappings) {
  const primaryId = mappings?.primary_contact_material_id?.canonical_id ?? ''
  const coatingId = mappings?.coating_modifier_id?.canonical_id ?? ''
  if (/hybrid_stainless|ceramic_nonstick|ptfe_nonstick|proprietary/.test(`${primaryId} ${coatingId}`)) {
    return true
  }
  if (coatingId === 'proprietary_nonstick_coating_undisclosed') return true
  if (coatingId === 'ceramic_sol_gel_nonstick_coating') return true
  return false
}

/**
 * @param {object[]} sources
 * @param {{ product_name?: string, brand?: string }} product
 * @param {object} structured
 */
export function validateManufacturerPdpSet(sources, product, structured) {
  const linkedUrl = structured?.retailer_links?.manufacturer_direct_url?.trim()
  const sourceList = [...(sources ?? [])]
  if (linkedUrl && !sourceList.some((s) => s.url === linkedUrl)) {
    sourceList.push({
      url: linkedUrl,
      title: 'Manufacturer direct URL (retailer_links)',
      page_excerpt: '',
      source_type: 'manufacturer',
    })
  }

  const manufacturerSources = sourceList.filter((s) => {
    const type = String(s.source_type ?? '').toLowerCase()
    return (
      type === 'manufacturer' ||
      type === 'faq' ||
      type === 'ingredient_page' ||
      manufacturerHostMatchesBrand(s.url, product.brand ?? structured?.product_identity?.brand)
    )
  })

  const validations = manufacturerSources.map((s) => ({
    source_url: s.url,
    ...validateManufacturerSource(s, product, structured),
  }))

  const best = validations.find((v) => v.passed) ?? null
  const anyMaterial = validations.some((v) => v.supports_material_evidence)
  const anyIdentityOnly = validations.some(
    (v) => v.supports_product_identity && !v.supports_material_evidence,
  )

  return {
    manufacturer_sources: validations,
    validated_pdp: best,
    has_validated_pdp: Boolean(best),
    any_identity_only: anyIdentityOnly,
    any_material_support: anyMaterial,
  }
}

/**
 * @param {{ product_name?: string, brand?: string }} product
 * @param {object} structured
 */
export function suggestManufacturerPdpSearchTargets(product, structured) {
  const brand = product.brand ?? structured?.product_identity?.brand ?? ''
  const name = product.product_name ?? structured?.product_identity?.product_name ?? ''
  const coating =
    (structured?.coatings_and_finishes ?? [])[0]?.coating_name ??
    structured?.primary_contact_material?.material_identity ??
    ''
  let domain = ''
  try {
    const url = structured?.retailer_links?.manufacturer_direct_url
    if (url) domain = new URL(url).hostname.replace(/^www\./i, '')
  } catch {
    /* ignore */
  }

  const queries = [
    `${brand} ${name} official`,
    `${brand} ${name} product page`,
    `${brand} ${name} lab results`,
    `${brand} ${coating} PFAS PTFE test results`,
  ]
  if (domain) {
    queries.push(
      `site:${domain} "${name}"`,
      `site:${domain} "lab results" "${coating}"`,
    )
  }
  return queries.filter(Boolean)
}
