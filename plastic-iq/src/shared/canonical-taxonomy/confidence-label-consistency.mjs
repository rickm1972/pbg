/**
 * Phase 3.5 — align canonical mapping confidence_label with source_type / claim role.
 * Does not change canonical_id or mapping rules.
 */
import {
  BRAND_SOURCE_CONFIRMED,
  GOVERNMENT_SOURCE_CONFIRMED,
  MARKETING_CLAIM,
} from './constants.mjs'

export { BRAND_SOURCE_CONFIRMED, MARKETING_CLAIM } from './constants.mjs'

const MANUFACTURER_TYPES = new Set([
  'manufacturer',
  'ingredient_page',
  'faq',
  'spec_sheet',
  'sds',
])
const RETAILER_TYPES = new Set(['amazon', 'target', 'walmart', 'retailer', 'other_retailer'])
const THIRD_PARTY_REVIEW_HOST_RE =
  /thenewknew|wirecutter|nytimes|goodhousekeeping|consumerreports|review|blog\.|medium\.com|substack/i

/**
 * @param {string} url
 */
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

/**
 * @param {string} url
 */
function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./i, '').toLowerCase()
  } catch {
    return ''
  }
}

/**
 * @param {object[]} sources
 * @param {string | null | undefined} sourceUrl
 */
function findSourceForUrl(sources, sourceUrl) {
  if (!sourceUrl?.trim()) return null
  const key = normalizeUrlKey(sourceUrl)
  return (sources ?? []).find((s) => s?.url && normalizeUrlKey(s.url) === key) ?? null
}

/**
 * @param {object | null} source
 * @param {string | null | undefined} sourceUrl
 * @returns {'manufacturer' | 'amazon' | 'retailer' | 'regulatory' | 'third_party_review' | 'other'}
 */
export function resolveSourceTier(source, sourceUrl) {
  const url = String(sourceUrl ?? source?.url ?? '')
  const type = String(source?.source_type ?? '').toLowerCase()
  const host = hostOf(url)

  if (
    type === 'regulatory' ||
    type === 'government' ||
    /pca\.state\.mn\.us|revisor\.mn\.gov/i.test(url) ||
    /\.gov$/i.test(host)
  ) {
    return 'regulatory'
  }
  if (type === 'amazon' || /amazon\.(com|ca|co\.uk|de|fr)/i.test(host)) return 'amazon'
  if (RETAILER_TYPES.has(type) || /target\.com|walmart\.com|shein\.com/i.test(host)) {
    return 'retailer'
  }
  if (
    type === 'context' ||
    type === 'third_party_review' ||
    type === 'blog' ||
    THIRD_PARTY_REVIEW_HOST_RE.test(host)
  ) {
    return 'third_party_review'
  }
  if (MANUFACTURER_TYPES.has(type) || /t-fal|tfal|groupe-seb|manufacturer/i.test(url)) {
    return 'manufacturer'
  }
  if (type === 'certification' || type === 'certification_registry') return 'other'
  return 'other'
}

/**
 * @param {object} structured
 * @param {object[]} sources
 * @param {string} claimKey
 */
export function resolveSafetyClaimSourceUrl(structured, sources, claimKey) {
  const sc = structured?.safety_claims ?? {}
  const links = structured?.retailer_links ?? {}

  if (claimKey === 'pfoa_free_claim') {
    const rc = (structured?.required_check_results ?? []).find(
      (r) =>
        r.check_id === 'external.pfoa_vs_pfas_free_distinction' &&
        (r.status === 'passed' || r.source_url),
    )
    if (rc?.source_url) return rc.source_url
    const pfoaPage = (sources ?? []).find(
      (s) => /\/pfoa/i.test(s.url ?? '') || /\bpfoa\b/i.test(s.title ?? ''),
    )
    if (pfoaPage?.url) return pfoaPage.url
    return links.manufacturer_direct_url ?? structured?.primary_contact_material?.source_url ?? null
  }

  if (claimKey === 'non_toxic_marketing_claim') {
    if (sc.non_toxic_claim?.source_url) return sc.non_toxic_claim.source_url
    const amazon = links.amazon_url
    if (amazon) return amazon
    const amazonSrc = (sources ?? []).find(
      (s) => s.source_type === 'amazon' || /amazon\.(com|ca)/i.test(s.url ?? ''),
    )
    return amazonSrc?.url ?? structured?.primary_contact_material?.source_url ?? null
  }

  const schemaKey =
    claimKey === 'pfas_free_marketing_claim' || claimKey === 'pfas_free_claim_structurally_verified'
      ? 'pfas_free_claim'
      : claimKey.replace(/_marketing_claim$/, '_claim')
  if (schemaKey && sc[schemaKey]?.source_url) return sc[schemaKey].source_url
  return structured?.primary_contact_material?.source_url ?? null
}

/**
 * @param {string} claimKey
 * @param {string | null | undefined} sourceUrl
 * @param {object[]} sources
 * @param {object} [structured]
 * @returns {string}
 */
export function inferConfidenceForSafetyClaim(claimKey, sourceUrl, sources, structured = {}) {
  const url = sourceUrl ?? resolveSafetyClaimSourceUrl(structured, sources, claimKey)
  const source = findSourceForUrl(sources, url)
  const tier = resolveSourceTier(source, url)

  if (claimKey === 'pfoa_free_claim') {
    if (tier === 'manufacturer') return BRAND_SOURCE_CONFIRMED
    if (tier === 'amazon' || tier === 'retailer') return 'retailer_confirmed'
    return 'manufacturer_confirmed'
  }

  if (claimKey === 'non_toxic_marketing_claim') {
    if (tier === 'amazon' || tier === 'retailer') return MARKETING_CLAIM
    if (tier === 'manufacturer') return BRAND_SOURCE_CONFIRMED
    return MARKETING_CLAIM
  }

  if (claimKey === 'pfas_free_claim_structurally_verified') {
    if (tier === 'manufacturer') return 'structurally_verified'
    if (tier === 'amazon' || tier === 'retailer') return 'retailer_claim_structurally_supported'
    return 'structurally_verified'
  }

  if (claimKey === 'pfas_free_marketing_claim') {
    if (tier === 'amazon' || tier === 'retailer') return MARKETING_CLAIM
    if (tier === 'manufacturer') return BRAND_SOURCE_CONFIRMED
    return 'retailer_confirmed'
  }

  if (tier === 'manufacturer') return 'manufacturer_confirmed'
  if (tier === 'amazon' || tier === 'retailer') return 'retailer_confirmed'
  return 'manufacturer_confirmed'
}

/**
 * @param {import('./types.mjs').CanonicalFieldMapping | null | undefined} row
 * @param {object[]} sources
 * @param {object} [structured]
 * @param {string} [fieldKey]
 */
export function reconcileMappingConfidence(row, sources, structured = {}) {
  if (!row) return row
  const sourceUrl = row.source_url
  const source = findSourceForUrl(sources, sourceUrl)
  const tier = resolveSourceTier(source, sourceUrl)
  let label = row.confidence_label ?? null

  if (row.canonical_id === 'pfoa_free_claim') {
    label = inferConfidenceForSafetyClaim('pfoa_free_claim', sourceUrl, sources, structured)
  } else if (row.canonical_id === 'non_toxic_marketing_claim') {
    label = inferConfidenceForSafetyClaim('non_toxic_marketing_claim', sourceUrl, sources, structured)
  } else if (row.canonical_id === 'pfas_free_claim_structurally_verified') {
    label = inferConfidenceForSafetyClaim(
      'pfas_free_claim_structurally_verified',
      sourceUrl,
      sources,
      structured,
    )
  } else if (row.canonical_id === 'pfas_free_marketing_claim') {
    label = inferConfidenceForSafetyClaim('pfas_free_marketing_claim', sourceUrl, sources, structured)
  } else if (tier === 'regulatory') {
    label = GOVERNMENT_SOURCE_CONFIRMED
  } else if (tier === 'third_party_review') {
    if (label === 'manufacturer_confirmed' || label === 'fully_disclosed_by_manufacturer') {
      label = 'third_party_review_citing_manufacturer'
    } else if (!label || label === 'unknown') {
      label = 'third_party_context_source'
    }
  } else if (tier === 'manufacturer' && label === 'retailer_confirmed') {
    label = 'manufacturer_confirmed'
  } else if ((tier === 'amazon' || tier === 'retailer') && label === 'manufacturer_confirmed') {
    label = 'retailer_confirmed'
  } else if (
    (tier === 'amazon' || tier === 'retailer') &&
    /manufacturer|brand/i.test(String(row.source_quote ?? '')) &&
    label !== 'retailer_confirmed'
  ) {
    label = 'manufacturer_claim_via_secondary_source'
  }

  return { ...row, confidence_label: label }
}

/**
 * Align structured_evidence confidence_label fields with canonical mapping provenance.
 * @param {object} structured
 * @param {import('./types.mjs').CanonicalMappingsPayload} mappings
 */
export function syncStructuredConfidenceFromMappings(structured, mappings) {
  if (!structured || !mappings) return
  const pcm = structured.primary_contact_material
  if (pcm && mappings.primary_contact_material_id?.confidence_label) {
    pcm.confidence_label = mappings.primary_contact_material_id.confidence_label
  }
  const coat = structured.coatings_and_finishes?.[0]
  if (coat && mappings.coating_modifier_id?.confidence_label) {
    coat.confidence_label = mappings.coating_modifier_id.confidence_label
  }
}

/**
 * @param {import('./types.mjs').CanonicalMappingsPayload} mappings
 * @param {object[]} sources
 * @param {object} [structured]
 */
export function reconcileCanonicalMappingsConfidence(mappings, sources, structured = {}) {
  if (!mappings) return mappings

  for (const key of [
    'primary_contact_material_id',
    'substrate_material_id',
    'coating_modifier_id',
    'pfas_status_id',
  ]) {
    if (mappings[key]) {
      mappings[key] = reconcileMappingConfidence(mappings[key], sources, structured, key)
    }
  }

  for (const [claimKey, row] of Object.entries(mappings.safety_claim_ids ?? {})) {
    if (!row) continue
    const url = resolveSafetyClaimSourceUrl(structured, sources, claimKey) ?? row.source_url
    const quote =
      claimKey === 'pfoa_free_claim'
        ? (structured?.required_check_results?.find(
            (r) => r.check_id === 'external.pfoa_vs_pfas_free_distinction',
          )?.source_quote ?? row.source_quote)
        : row.source_quote
    mappings.safety_claim_ids[claimKey] = reconcileMappingConfidence(
      {
        ...row,
        source_url: url,
        source_quote: quote ?? row.source_quote,
        confidence_label: inferConfidenceForSafetyClaim(claimKey, url, sources, structured),
      },
      sources,
      structured,
    )
  }

  for (let i = 0; i < (mappings.regulatory_flag_ids ?? []).length; i++) {
    const row = mappings.regulatory_flag_ids[i]
    mappings.regulatory_flag_ids[i] = reconcileMappingConfidence(row, sources, structured)
  }

  return mappings
}
