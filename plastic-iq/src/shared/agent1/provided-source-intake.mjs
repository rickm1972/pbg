/**
 * Source intake — verified URLs supplied before Agent 1 (separate from commerce/affiliate links).
 */

import { fetchPageText } from '../../../scripts/lib/fetch-page-text.mjs'
import {
  classifyManufacturerUrlKind,
  detectManufacturerRegionMismatch,
  validateManufacturerSource,
} from './manufacturer-pdp-validation.mjs'
import {
  fetchManufacturerPdpEvidence,
  textContainsLabModalEvidence,
} from './manufacturer-pdp-modal-extraction.mjs'

/** @typedef {'primary_retailer_evidence' | 'amazon_evidence' | 'manufacturer_product'} ProvidedIntakeRole */

/**
 * Primary retailer evidence URL — `amazon_url` only (commerce affiliate_link is separate).
 * @param {{ amazon_url?: string | null }} product
 */
export function resolvePrimaryRetailerEvidenceUrl(product) {
  return product.amazon_url?.trim() || null
}

/**
 * @param {{ product_name?: string | null, amazon_url?: string | null, manufacturer_product_url?: string | null }} product
 */
export function buildAgent1ProvidedInput(product) {
  return {
    product_title: product.product_name?.trim() ?? '',
    primary_retailer_url: resolvePrimaryRetailerEvidenceUrl(product),
    manufacturer_product_url: product.manufacturer_product_url?.trim() || null,
  }
}

/**
 * @param {{ amazon_url?: string | null, manufacturer_product_url?: string | null }} product
 * @returns {{ url: string, role: ProvidedIntakeRole, source_type: string }[]}
 */
export function listProvidedSourceIntakeEntries(product) {
  /** @type {{ url: string, role: ProvidedIntakeRole, source_type: string }[]} */
  const entries = []
  const primaryUrl = resolvePrimaryRetailerEvidenceUrl(product)
  if (primaryUrl) {
    const isAmazon = /amazon\.(com|ca|co\.uk|de|fr)/i.test(primaryUrl)
    entries.push({
      url: primaryUrl,
      role: isAmazon ? 'amazon_evidence' : 'primary_retailer_evidence',
      source_type: isAmazon ? 'amazon' : 'retailer',
    })
  }
  const mfr = product.manufacturer_product_url?.trim()
  if (mfr) {
    entries.push({ url: mfr, role: 'manufacturer_product', source_type: 'manufacturer' })
  }
  return entries
}

function titleFromUrl(url) {
  try {
    const path = new URL(url).pathname.split('/').filter(Boolean).pop() ?? 'page'
    return decodeURIComponent(path.replace(/[-_]/g, ' '))
  } catch {
    return 'Provided source'
  }
}

/**
 * @param {ProvidedIntakeRole} role
 */
function assignedSourceRoleForIntake(role) {
  switch (role) {
    case 'amazon_evidence':
    case 'primary_retailer_evidence':
      return 'primary_retailer'
    case 'manufacturer_product':
      return 'manufacturer_primary'
    default:
      return 'provided'
  }
}

/**
 * Fetch and validate user-provided intake URLs (manufacturer/lab/FAQ; Amazon handled by Stage 1a).
 * @param {{ product_name?: string, brand?: string, manufacturer_product_url?: string | null, manufacturer_lab_results_url?: string | null, manufacturer_materials_faq_url?: string | null, agent1_source_notes?: string | null, primary_retailer_evidence_url?: string | null, amazon_url?: string | null, affiliate_link?: string | null }} product
 */
export async function retrieveProvidedSourceIntake(product) {
  const plan = listProvidedSourceIntakeEntries(product).filter(
    (e) => e.role !== 'amazon_evidence' && e.role !== 'primary_retailer_evidence',
  )
  const fetchedAt = new Date().toISOString()
  /** @type {object[]} */
  const entries = []

  for (const item of plan) {
    /** @type {object} */
    const row = {
      url: item.url,
      intended_role: item.role,
      source_type: item.source_type,
      assigned_source_role: assignedSourceRoleForIntake(item.role),
      fetch_ok: false,
      fetch_error: null,
      title: titleFromUrl(item.url),
      page_excerpt: '',
      validation: null,
      fields_supported: [],
      failure_reason: null,
      used_as_primary_evidence: false,
      search_discovered_alternate_url: null,
      fetched_at: fetchedAt,
    }

    try {
      if (item.role === 'manufacturer_product') {
        const pdp = await fetchManufacturerPdpEvidence(item.url)
        row.page_excerpt = pdp.combined_excerpt.slice(0, 4000)
        row.modal_evidence_excerpt = pdp.modal_excerpt || null
        row.modal_blocks_found = pdp.modal_blocks?.length ?? 0
        row.has_lab_modal_evidence = pdp.has_lab_modal_evidence
        row.fetch_ok = true
        row.title =
          pdp.has_material_modal_evidence || pdp.visible_excerpt
            ? pdp.visible_excerpt.slice(0, 120).trim() || row.title
            : row.title
      } else {
        const text = await fetchPageText(item.url, { maxChars: 6000 })
        row.page_excerpt = text.slice(0, 2500)
        row.fetch_ok = true
        row.title = row.page_excerpt.slice(0, 120).trim() || row.title
      }
    } catch (err) {
      row.fetch_error = err instanceof Error ? err.message : String(err)
      row.failure_reason = row.fetch_error
    }

    if (item.role === 'manufacturer_product') {
      const validation = validateManufacturerSource(
        { url: item.url, title: row.title, page_excerpt: row.page_excerpt },
        product,
      )
      row.validation = validation
      if (validation.supports_material_evidence) {
        row.fields_supported.push('material/coating evidence')
      }
      if (validation.supports_product_identity) {
        row.fields_supported.push('product identity')
      }
      if (row.has_lab_modal_evidence || textContainsLabModalEvidence(row.page_excerpt)) {
        row.fields_supported.push('manufacturer-published third-party lab testing')
      }
      if (!validation.passed) {
        row.failure_reason = validation.issues?.join(' ') || validation.code || 'Validation failed'
      }
      if (item.role === 'manufacturer_product' && validation.passed) {
        row.used_as_primary_evidence = true
      }
    } else if (row.fetch_ok) {
      row.used_as_primary_evidence = true
    }

    entries.push(row)
  }

  return {
    schema_version: '1.0',
    retrieved_at: fetchedAt,
    entries,
    /** Sources shaped for Agent 1 synthesis / Gate 1 list */
    sources: entries
      .filter((e) => e.url)
      .map((e) => ({
        source_type: e.source_type,
        url: e.url,
        title: e.title,
        fetched_at: e.fetched_at,
        page_excerpt: e.page_excerpt || undefined,
        provided_intake_role: e.intended_role,
        provided_intake: true,
        manufacturer_modal_evidence: Boolean(e.has_lab_modal_evidence || e.modal_blocks_found),
        modal_evidence_excerpt: e.modal_evidence_excerpt ?? undefined,
      })),
  }
}

/**
 * Record primary retailer intake from Stage 1a Amazon/retailer fetch.
 * @param {object | null | undefined} amazonRetrieval
 * @param {{ product_name?: string, brand?: string, primary_retailer_evidence_url?: string | null, amazon_url?: string | null }} product
 */
export function buildPrimaryRetailerIntakeEntry(amazonRetrieval, product) {
  const url = resolvePrimaryRetailerEvidenceUrl(product)
  if (!url) return null

  const isAmazon = /amazon\.(com|ca|co\.uk|de|fr)/i.test(url)
  const role = isAmazon ? 'amazon_evidence' : 'primary_retailer_evidence'
  const excerpt = amazonRetrieval?.excerpt ?? amazonRetrieval?.page_excerpt ?? ''
  const fetchOk = Boolean(amazonRetrieval?.ok)
  const fetchError = amazonRetrieval?.error ?? null

  return {
    url,
    intended_role: role,
    source_type: isAmazon ? 'amazon' : 'retailer',
    assigned_source_role: 'primary_retailer',
    fetch_ok: fetchOk,
    fetch_error: fetchError,
    title: isAmazon ? 'Amazon listing (provided)' : 'Primary retailer listing (provided)',
    page_excerpt: excerpt,
    validation: { passed: fetchOk, issues: fetchError ? [fetchError] : [] },
    fields_supported: fetchOk ? ['product identity', 'retailer claims'] : [],
    failure_reason: fetchError,
    used_as_primary_evidence: fetchOk,
    search_discovered_alternate_url: null,
    fetched_at: amazonRetrieval?.fetched_at ?? new Date().toISOString(),
  }
}

/**
 * Apply provided intake priority to structured evidence and sources after synthesis.
 * Valid provided manufacturer PDP wins over search-discovered homepage/wrong-region URLs.
 * @param {object} structured
 * @param {object[]} sources
 * @param {object} product
 * @param {object} intakeReport
 */
export function applyProvidedSourceIntakePriority(structured, sources, product, intakeReport) {
  if (!structured) return { structured, sources, intakeReport }

  structured.retailer_links = structured.retailer_links ?? {}

  const primaryUrl = resolvePrimaryRetailerEvidenceUrl(product)
  if (primaryUrl) {
    const isAmazon = /amazon\.(com|ca|co\.uk|de|fr)/i.test(primaryUrl)
    if (isAmazon) {
      structured.retailer_links.amazon_url = primaryUrl
    }
  }

  const providedMfr = product.manufacturer_product_url?.trim()
  const mfrEntry = (intakeReport?.entries ?? []).find((e) => e.intended_role === 'manufacturer_product')
  const mfrValidation = mfrEntry?.validation

  if (providedMfr && mfrValidation?.passed) {
    structured.retailer_links.manufacturer_direct_url = providedMfr
    if (mfrEntry) mfrEntry.used_as_primary_evidence = true
  } else if (providedMfr && mfrEntry) {
    structured.retailer_links.manufacturer_direct_url = providedMfr
  }

  const discoveredMfrUrl = structured.retailer_links.manufacturer_direct_url?.trim()
  if (
    providedMfr &&
    mfrValidation?.passed &&
    discoveredMfrUrl &&
    discoveredMfrUrl !== providedMfr
  ) {
    if (mfrEntry) {
      mfrEntry.search_discovered_alternate_url = discoveredMfrUrl
    }
    structured.retailer_links.manufacturer_direct_url = providedMfr
  }

  /** @type {Map<string, object>} */
  const byUrl = new Map()
  for (const s of intakeReport?.sources ?? []) {
    if (s.url) byUrl.set(s.url, { ...s, provided_intake: true })
  }
  for (const s of sources ?? []) {
    if (!s.url) continue
    if (byUrl.has(s.url)) continue
    const isDiscoveredMfr =
      String(s.source_type ?? '').toLowerCase() === 'manufacturer' &&
      manufacturerHostMatchesBrandLoose(s.url, product.brand)
    if (
      providedMfr &&
      mfrValidation?.passed &&
      isDiscoveredMfr &&
      s.url !== providedMfr
    ) {
      const kind = classifyManufacturerUrlKind(s.url)
      const regionMismatch = detectManufacturerRegionMismatch(s.url)
      if (kind !== 'product_detail' || regionMismatch) {
        const supplemental = {
          ...s,
          provided_intake_supplemental: true,
          provided_intake_mismatch: `Search-discovered manufacturer URL (${s.url}) is supplemental only — provided PDP takes priority.`,
        }
        if (mfrEntry && !mfrEntry.search_discovered_alternate_url) {
          mfrEntry.search_discovered_alternate_url = s.url
        }
        byUrl.set(s.url, supplemental)
        continue
      }
    }
    byUrl.set(s.url, s)
  }

  const merged = [...byUrl.values()]
  const providedFirst = merged.sort((a, b) => {
    if (a.provided_intake && !b.provided_intake) return -1
    if (!a.provided_intake && b.provided_intake) return 1
    return 0
  })

  return { structured, sources: providedFirst, intakeReport }
}

function manufacturerHostMatchesBrandLoose(url, brand) {
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
 * Merge primary retailer + fetched intake into full report for Gate 1.
 * @param {object | null | undefined} primaryEntry
 * @param {object} fetchedIntake
 */
export function assembleProvidedSourceIntakeReport(primaryEntry, fetchedIntake) {
  const entries = []
  if (primaryEntry) entries.push(primaryEntry)
  entries.push(...(fetchedIntake?.entries ?? []))
  return {
    schema_version: '1.0',
    retrieved_at: fetchedIntake?.retrieved_at ?? new Date().toISOString(),
    entries,
  }
}
