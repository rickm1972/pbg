import { getStructuredEvidence, getWarnings } from './evidenceMetadata'
import {
  hasPrimaryRetailerUrl,
  hasRecordedAmazonUrl,
  isAmazonUnavailableWarning,
  isContradictoryAmazonMissingBlocker,
  isNonAmazonPrimaryRetailerUrl,
  primaryRetailerCatalogUrl,
} from '../shared/agent1/amazon-source-consistency.mjs'
import { buildFieldProvenance } from './evidenceFieldProvenance'
import { COOKWARE_SCORE_DRIVING_FIELDS } from './canonicalEvidenceMapping'
import { sourceLabelForUrl } from './evidenceSourceLabels'
import type {
  AgentMetadata,
  CanonicalFieldMapping,
  CanonicalMappingsPayload,
  EvidenceSource,
  ProductEvidence,
  RequiredCheckResult,
  RequiredEvidenceValidationPayload,
  StructuredEvidencePayload,
} from '../types/agent'

export type Gate1SourceUsageStatus =
  | 'primary'
  | 'supporting'
  | 'context-only'
  | 'rejected'
  | 'mismatch'

export type Gate1SourceSection =
  | 'primary_product'
  | 'required_check'
  | 'other_context'
  | 'rejected_mismatch'

export type Gate1SourceRow = {
  url: string
  title: string
  technicalSourceType: string | null
  reviewerLabel: string
  usageStatus: Gate1SourceUsageStatus
  section: Gate1SourceSection
  reason: string | null
  fieldsSupported: string[]
  checkedAt: string | null
  requiredCheckLabel: string | null
}

export type Gate1SourcesCoverageSummary = {
  amazon: 'present' | 'missing'
  manufacturer: 'present' | 'missing'
  regulatory: 'present' | 'not_applicable' | 'missing'
  pfoaPfasDistinction: 'present' | 'missing' | 'not_applicable'
  rejectedMismatchCount: number
}

export type Gate1SourcesReviewModel = {
  coverage: Gate1SourcesCoverageSummary
  sections: Record<Gate1SourceSection, Gate1SourceRow[]>
  allRows: Gate1SourceRow[]
  missingUrlNotes: string[]
}

export type Gate1SourceCitation = {
  title: string
  reviewerLabel: string
  url: string | null
  quote: string | null
  confidence: string | null
  technicalSourceType: string | null
}

const REQUIRED_CHECK_REVIEWER_LABELS: Record<string, string> = {
  'external.regulatory_pfas_minnesota_review': 'Minnesota PCA PFAS prohibitions',
  'external.pfoa_vs_pfas_free_distinction': 'PFOA/PFAS claim distinction',
  'external.pfas_nonstick_disclosure': 'PFAS / nonstick disclosure',
}

function requiredCheckReviewerLabel(checkId: string, sourceUrl?: string | null): string {
  if (checkId === 'external.pfoa_vs_pfas_free_distinction') {
    if (sourceUrl && isAmazonUrl(sourceUrl)) return 'PFAS-free claim check (Amazon listing)'
    if (sourceUrl && isRegulatoryUrl(sourceUrl)) return 'PFOA/PFAS claim distinction (government source)'
    if (sourceUrl) return 'PFOA/PFAS claim distinction (retailer source)'
    return REQUIRED_CHECK_REVIEWER_LABELS[checkId] ?? checkId
  }
  return REQUIRED_CHECK_REVIEWER_LABELS[checkId] ?? checkId
}

const MISMATCH_WARNING_RE =
  /mismatch|wrong\s+(model|product)|different\s+(product|model|configuration)|pack[\s-]?size|not\s+authoritative|do\s+not\s+use|rejected\s+as\s+primary|variant\s+mismatch|url\s+(error|pack)/i

const URL_IN_TEXT_RE = /https?:\/\/[^\s)\]"']+/gi

const PLAIN_FIELD_LABELS: Record<string, string> = {
  primary_contact_material_id: 'Food-contact surface',
  substrate_material_id: 'Pan body / base',
  coating_modifier_id: 'Coating modifier',
  pfas_status_id: 'PFAS status',
  pfoa_free_claim: 'PFOA-free claim',
  pfas_free_claim_structurally_verified: 'PFAS-free (structurally verified)',
  pfas_free_marketing_claim: 'PFAS-free marketing claim',
  non_toxic_marketing_claim: 'Non-toxic marketing claim',
}

function normalizeUrlKey(url: string): string {
  try {
    const u = new URL(url)
    u.hash = ''
    const path = u.pathname.replace(/\/+$/, '') || '/'
    return `${u.protocol}//${u.host.toLowerCase()}${path}${u.search}`
  } catch {
    return String(url ?? '').trim().toLowerCase()
  }
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, '').toLowerCase()
  } catch {
    return ''
  }
}

function isAmazonUrl(url: string): boolean {
  return /amazon\.(com|ca|co\.uk|de|fr)/i.test(hostOf(url))
}

function isWilliamsSonomaUrl(url: string): boolean {
  return hostOf(url).includes('williams-sonoma.com')
}

function isKnownCatalogRetailerHost(url: string): boolean {
  const h = hostOf(url)
  return (
    isAmazonUrl(url) ||
    isWilliamsSonomaUrl(url) ||
    h.includes('target.com') ||
    h.includes('walmart.com') ||
    h.includes('costco.com') ||
    h.includes('homedepot.com') ||
    h.includes('lowes.com') ||
    h.includes('bestbuy.com') ||
    h.includes('crateandbarrel.com') ||
    h.includes('surlatable.com')
  )
}

function primaryRetailerReviewerLabel(url: string): string {
  if (isAmazonUrl(url)) return 'Amazon listing'
  if (isWilliamsSonomaUrl(url)) return 'Williams Sonoma listing'
  const h = hostOf(url)
  if (h.includes('target.com')) return 'Target listing'
  if (h.includes('walmart.com')) return 'Walmart listing'
  if (h.includes('costco.com')) return 'Costco listing'
  if (h.includes('crateandbarrel.com')) return 'Crate & Barrel listing'
  if (h.includes('surlatable.com')) return 'Sur La Table listing'
  return 'Primary retailer listing'
}

function isRegulatoryUrl(url: string): boolean {
  const h = hostOf(url)
  return /\.gov$/i.test(h) || h.includes('pca.state.mn.us') || h.includes('revisor.mn.gov')
}

function isAlternateRetailerType(type: string): boolean {
  const t = type.toLowerCase()
  return (
    t === 'target' ||
    t === 'walmart' ||
    t === 'other_retailer' ||
    t === 'search_result' ||
    t.includes('shein')
  )
}

function isAlternateRetailerUrl(url: string): boolean {
  const h = hostOf(url)
  return (
    h.includes('target.com') ||
    h.includes('walmart.com') ||
    h.includes('shein.com') ||
    h.includes('wayfair.com')
  )
}

function urlsFromWarnings(warnings: string[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const w of warnings) {
    if (!MISMATCH_WARNING_RE.test(w)) continue
    const urls = w.match(URL_IN_TEXT_RE) ?? []
    for (const raw of urls) {
      const url = raw.replace(/[.,;]+$/, '')
      map.set(normalizeUrlKey(url), w)
    }
    for (const token of ['target', 'walmart', 'shein']) {
      if (new RegExp(token, 'i').test(w) && MISMATCH_WARNING_RE.test(w)) {
        map.set(`__host:${token}`, w)
      }
    }
  }
  return map
}

function warningMatchesUrl(
  warningByUrl: Map<string, string>,
  url: string,
): string | null {
  const key = normalizeUrlKey(url)
  if (warningByUrl.has(key)) return warningByUrl.get(key) ?? null
  const h = hostOf(url)
  for (const [k, msg] of warningByUrl) {
    if (k.startsWith('__host:') && h.includes(k.slice('__host:'.length))) return msg
  }
  return null
}

function reviewerLabelForSource(
  source: EvidenceSource | null,
  url: string,
  usageStatus: Gate1SourceUsageStatus,
): string {
  const type = (source?.source_type ?? '').toLowerCase()
  if (usageStatus === 'mismatch' || usageStatus === 'rejected') {
    if (type === 'target' || hostOf(url).includes('target.com')) return 'Retailer variant / not used'
    if (type === 'walmart' || hostOf(url).includes('walmart.com')) return 'Retailer variant / not used'
    if (hostOf(url).includes('shein')) return 'Retailer variant / not used'
    return 'Source not used as primary evidence'
  }
  if (isAmazonUrl(url)) return 'Amazon listing'
  if (isWilliamsSonomaUrl(url)) return 'Williams Sonoma listing'
  if (usageStatus === 'primary' && isKnownCatalogRetailerHost(url)) {
    return primaryRetailerReviewerLabel(url)
  }
  if (type === 'amazon' && !isAmazonUrl(url)) return primaryRetailerReviewerLabel(url)
  if (type === 'manufacturer' || (type === 'retailer' && !isAlternateRetailerUrl(url))) {
    if (isRegulatoryUrl(url)) return 'Government/regulatory source'
    return 'Manufacturer product page'
  }
  if (type === 'ingredient_page' || type === 'faq') return 'Manufacturer disclosure page'
  if (type === 'regulatory' || type === 'government' || isRegulatoryUrl(url)) {
    return 'Government/regulatory source'
  }
  if (type === 'third_party_review' || type === 'certification') return 'Context source only'
  if (type === 'other_retailer' && !isAlternateRetailerUrl(url)) {
    return primaryRetailerReviewerLabel(url)
  }
  if (isAlternateRetailerType(type) || isAlternateRetailerUrl(url)) return 'Retailer variant / not used'
  if (type === 'spec_sheet' || type === 'sds') return 'Manufacturer disclosure page'
  return 'Context source only'
}

function collectCanonicalFieldLabels(mappings: CanonicalMappingsPayload | null | undefined): Map<string, string[]> {
  const byUrl = new Map<string, string[]>()
  function add(url: string | null | undefined, label: string) {
    if (!url?.trim()) return
    const key = normalizeUrlKey(url)
    const list = byUrl.get(key) ?? []
    if (!list.includes(label)) list.push(label)
    byUrl.set(key, list)
  }

  if (!mappings) return byUrl

  for (const req of COOKWARE_SCORE_DRIVING_FIELDS) {
    const row = mappings[req.field_key as keyof CanonicalMappingsPayload] as
      | CanonicalFieldMapping
      | undefined
    if (row) add(row.source_url, PLAIN_FIELD_LABELS[req.field_key] ?? req.label)
  }
  for (const [i, flag] of (mappings.regulatory_flag_ids ?? []).entries()) {
    add(flag.source_url, `Regulatory flag ${i + 1}`)
  }
  for (const [key, row] of Object.entries(mappings.safety_claim_ids ?? {})) {
    if (row) add(row.source_url, PLAIN_FIELD_LABELS[key] ?? `Safety claim · ${key.replace(/_/g, ' ')}`)
  }

  return byUrl
}

function collectProvenanceLabels(
  structured: StructuredEvidencePayload | null,
  sources: EvidenceSource[],
): Map<string, string[]> {
  if (!structured) return new Map()
  const prov = buildFieldProvenance(structured, sources)
  const byUrl = new Map<string, string[]>()
  for (const [path, entry] of Object.entries(prov)) {
    if (!entry.source_url) continue
    const key = normalizeUrlKey(entry.source_url)
    const label = path.replace(/^primary_contact_material\./, 'Primary contact · ').replace(/[._]/g, ' ')
    const list = byUrl.get(key) ?? []
    if (!list.includes(label)) list.push(label)
    byUrl.set(key, list)
  }
  return byUrl
}

function mergeLabelsForUrl(url: string, ...maps: Map<string, string[]>[]): string[] {
  const key = normalizeUrlKey(url)
  const out = new Set<string>()
  for (const m of maps) {
    for (const l of m.get(key) ?? []) out.add(l)
  }
  return [...out].sort()
}

function requiredCheckRows(results: RequiredCheckResult[] | null | undefined): Gate1SourceRow[] {
  if (!results?.length) return []
  const rows: Gate1SourceRow[] = []
  for (const r of results) {
    if (!r.source_url?.trim()) continue
    const label = requiredCheckReviewerLabel(r.check_id, r.source_url)
    rows.push({
      url: r.source_url,
      title: sourceLabelForUrl(r.source_url, []).split(' (')[0] || label,
      technicalSourceType: 'required_check',
      reviewerLabel: label,
      usageStatus: r.status === 'passed' ? 'supporting' : 'context-only',
      section: 'required_check',
      reason: r.status !== 'passed' ? `Required check status: ${r.status}` : null,
      fieldsSupported: r.canonical_ids_added?.length
        ? r.canonical_ids_added.map((id) => `Canonical: ${id}`)
        : [label],
      checkedAt: r.timestamp ?? null,
      requiredCheckLabel: label,
    })
  }
  return rows
}

function buildCoverage(
  structured: StructuredEvidencePayload | null,
  validation: RequiredEvidenceValidationPayload | null | undefined,
  results: RequiredCheckResult[] | null | undefined,
  rows: Gate1SourceRow[],
): Gate1SourcesCoverageSummary {
  const amazonUrl = structured?.retailer_links?.amazon_url?.trim()
  const mfrUrl = structured?.retailer_links?.manufacturer_direct_url?.trim()

  const amazonPresent =
    Boolean(amazonUrl && isAmazonUrl(amazonUrl)) ||
    rows.some(
      (r) =>
        r.usageStatus !== 'mismatch' &&
        isAmazonUrl(r.url) &&
        (r.reviewerLabel === 'Amazon listing' || r.technicalSourceType === 'amazon'),
    )

  const mfrPresent =
    Boolean(mfrUrl) ||
    rows.some(
      (r) =>
        r.usageStatus !== 'mismatch' &&
        (r.reviewerLabel === 'Manufacturer product page' ||
          r.reviewerLabel === 'Manufacturer disclosure page'),
    )

  const mnCheck = results?.find((r) => r.check_id === 'external.regulatory_pfas_minnesota_review')
  const pfoaCheck = results?.find((r) => r.check_id === 'external.pfoa_vs_pfas_free_distinction')

  const regulatoryNa =
    validation?.checklist_items?.some(
      (i) =>
        i.id.includes('regulatory') &&
        i.status === 'not_applicable',
    ) ?? false

  const regulatoryPresent =
    mnCheck?.status === 'passed' ||
    rows.some((r) => r.reviewerLabel === 'Government/regulatory source' && r.usageStatus !== 'mismatch')

  const pfoaNa =
    validation?.checklist_items?.some(
      (i) => i.id.includes('pfoa') && i.status === 'not_applicable',
    ) ?? false

  const pfoaPresent = pfoaCheck?.status === 'passed' || Boolean(pfoaCheck?.source_url)

  return {
    amazon: amazonPresent ? 'present' : 'missing',
    manufacturer: mfrPresent ? 'present' : 'missing',
    regulatory: regulatoryNa
      ? 'not_applicable'
      : regulatoryPresent
        ? 'present'
        : 'missing',
    pfoaPfasDistinction: pfoaNa ? 'not_applicable' : pfoaPresent ? 'present' : 'missing',
    rejectedMismatchCount: rows.filter(
      (r) => r.usageStatus === 'mismatch' || r.usageStatus === 'rejected',
    ).length,
  }
}

export function buildGate1SourcesReview(evidence: ProductEvidence): Gate1SourcesReviewModel {
  const meta = evidence.agent_metadata ?? {}
  const structured = getStructuredEvidence(meta)
  const sources = evidence.sources ?? []
  const warnings = getWarnings(meta as AgentMetadata)
  const warningByUrl = urlsFromWarnings(warnings)
  const mappings = structured?.canonical_mappings
  const canonicalByUrl = collectCanonicalFieldLabels(mappings)
  const provenanceByUrl = collectProvenanceLabels(structured, sources)
  const validation = structured?.required_evidence_validation
  const requiredResults = structured?.required_check_results

  const usedUrlKeys = new Set<string>()
  function markUsed(url: string | null | undefined) {
    if (url?.trim()) usedUrlKeys.add(normalizeUrlKey(url))
  }

  for (const url of canonicalByUrl.keys()) usedUrlKeys.add(url)
  for (const url of provenanceByUrl.keys()) usedUrlKeys.add(url)
  markUsed(structured?.retailer_links?.amazon_url)
  markUsed(structured?.retailer_links?.manufacturer_direct_url)
  for (const r of requiredResults ?? []) {
    if (r.status === 'passed') markUsed(r.source_url)
  }
  for (const item of validation?.checklist_items ?? []) {
    if (item.status === 'passed') markUsed(item.source_url)
  }

  const sourceByUrlKey = new Map<string, EvidenceSource>()
  for (const s of sources) {
    if (s.url) sourceByUrlKey.set(normalizeUrlKey(s.url), s)
  }

  const rowByKey = new Map<string, Gate1SourceRow>()

  function upsertRow(url: string, patch: Partial<Gate1SourceRow> & { title: string }) {
    const key = normalizeUrlKey(url)
    const existing = sourceByUrlKey.get(key)
    const fields = mergeLabelsForUrl(url, canonicalByUrl, provenanceByUrl)
    const warnReason = warningMatchesUrl(warningByUrl, url)
    const type = (patch.technicalSourceType ?? existing?.source_type ?? '').toLowerCase()
    const used = usedUrlKeys.has(key)
    const altRetailer = isAlternateRetailerType(type) || isAlternateRetailerUrl(url)

    let usageStatus: Gate1SourceUsageStatus = patch.usageStatus ?? 'context-only'
    let section: Gate1SourceSection = patch.section ?? 'other_context'
    let reason = patch.reason ?? warnReason

    if (warnReason || (altRetailer && !used)) {
      usageStatus = 'mismatch'
      section = 'rejected_mismatch'
      reason =
        warnReason ??
        (altRetailer
          ? 'Alternate retailer listing — not used as primary evidence for this SKU.'
          : reason)
    } else if (patch.section === 'required_check') {
      usageStatus = patch.usageStatus ?? 'supporting'
      section = 'required_check'
    } else if (
      used &&
      normalizeUrlKey(url) === normalizeUrlKey(structured?.retailer_links?.amazon_url ?? '') &&
      (isAmazonUrl(url) || isNonAmazonPrimaryRetailerUrl(url))
    ) {
      usageStatus = 'primary'
      section = 'primary_product'
    } else if (
      (type === 'manufacturer' ||
        type === 'ingredient_page' ||
        type === 'faq' ||
        normalizeUrlKey(url) === normalizeUrlKey(structured?.retailer_links?.manufacturer_direct_url ?? '')) &&
      used
    ) {
      usageStatus = 'primary'
      section = 'primary_product'
    } else if (used) {
      usageStatus = 'supporting'
      section = isRegulatoryUrl(url) ? 'required_check' : 'other_context'
    } else {
      usageStatus = 'context-only'
      section = 'other_context'
    }

    if (usageStatus === 'primary' && (warnReason || (altRetailer && !used))) {
      usageStatus = 'mismatch'
      section = 'rejected_mismatch'
    }

    const reviewerLabel =
      patch.reviewerLabel ?? reviewerLabelForSource(existing ?? null, url, usageStatus)

    const merged: Gate1SourceRow = {
      url,
      title: patch.title || existing?.title?.trim() || sourceLabelForUrl(url, sources).split(' (')[0] || url,
      technicalSourceType: patch.technicalSourceType ?? existing?.source_type ?? null,
      reviewerLabel,
      usageStatus,
      section,
      reason,
      fieldsSupported: [...new Set([...(patch.fieldsSupported ?? []), ...fields])].sort(),
      checkedAt: patch.checkedAt ?? existing?.fetched_at ?? null,
      requiredCheckLabel: patch.requiredCheckLabel ?? null,
    }

    const prior = rowByKey.get(key)
    if (prior) {
      rowByKey.set(key, {
        ...merged,
        fieldsSupported: [...new Set([...prior.fieldsSupported, ...merged.fieldsSupported])].sort(),
        section:
          prior.section === 'rejected_mismatch' || merged.section === 'rejected_mismatch'
            ? 'rejected_mismatch'
            : prior.section === 'required_check' || merged.section === 'required_check'
              ? 'required_check'
              : prior.section === 'primary_product' || merged.section === 'primary_product'
                ? 'primary_product'
                : merged.section,
        usageStatus:
          prior.usageStatus === 'mismatch' || merged.usageStatus === 'mismatch'
            ? 'mismatch'
            : prior.usageStatus === 'primary' || merged.usageStatus === 'primary'
              ? 'primary'
              : merged.usageStatus,
        reason: prior.reason ?? merged.reason,
      })
    } else {
      rowByKey.set(key, merged)
    }
  }

  for (const s of sources) {
    if (!s.url?.trim()) continue
    upsertRow(s.url, { title: s.title?.trim() || s.url })
  }

  const catalogRetailerUrl = structured?.retailer_links?.amazon_url?.trim()
  if (catalogRetailerUrl) {
    if (isAmazonUrl(catalogRetailerUrl)) {
      upsertRow(catalogRetailerUrl, {
        title: 'Amazon product listing',
        reviewerLabel: 'Amazon listing',
        section: 'primary_product',
      })
    } else {
      upsertRow(catalogRetailerUrl, {
        title: 'Primary retailer product listing',
        reviewerLabel: primaryRetailerReviewerLabel(catalogRetailerUrl),
        section: 'primary_product',
      })
    }
  }

  const mfrUrl = structured?.retailer_links?.manufacturer_direct_url?.trim()
  if (mfrUrl) {
    upsertRow(mfrUrl, {
      title: 'Manufacturer product page',
      reviewerLabel: 'Manufacturer product page',
      section: 'primary_product',
    })
  }

  for (const rc of requiredCheckRows(requiredResults)) {
    upsertRow(rc.url, rc)
  }

  const allRows = [...rowByKey.values()].sort((a, b) =>
    a.reviewerLabel.localeCompare(b.reviewerLabel),
  )

  const sections: Record<Gate1SourceSection, Gate1SourceRow[]> = {
    primary_product: [],
    required_check: [],
    other_context: [],
    rejected_mismatch: [],
  }

  for (const row of allRows) {
    sections[row.section].push(row)
  }

  const coverage = buildCoverage(structured, validation, requiredResults, allRows)
  const recordedAmazon = hasRecordedAmazonUrl(structured, sources)
  const primaryRetailerUrl = primaryRetailerCatalogUrl(structured)
  const nonAmazonPrimary = isNonAmazonPrimaryRetailerUrl(primaryRetailerUrl)
  const amazonRetrievalWarning = warnings.find((w) => isAmazonUnavailableWarning(w))
  const missingUrlNotes: string[] = []
  if (coverage.amazon === 'missing' && !hasPrimaryRetailerUrl(structured)) {
    missingUrlNotes.push('Primary retailer URL missing — required for this product matrix.')
  } else if (coverage.amazon === 'missing' && nonAmazonPrimary) {
    missingUrlNotes.push(
      `No Amazon listing found; ${primaryRetailerReviewerLabel(primaryRetailerUrl)} used as primary retailer source.`,
    )
  } else if (recordedAmazon && amazonRetrievalWarning) {
    missingUrlNotes.push(
      'Amazon URL is recorded (catalog or supporting source). Stage 1a primary listing retrieval did not return usable content — see validation warnings.',
    )
  }
  if (coverage.manufacturer === 'missing') {
    missingUrlNotes.push('Manufacturer product URL missing — required for this product matrix.')
  }
  for (const b of validation?.approval_blockers ?? []) {
    if (isContradictoryAmazonMissingBlocker(b, recordedAmazon)) continue
    if (
      nonAmazonPrimary &&
      /amazon\s+product\s+url\s+missing|amazon\s+url\s+missing|required for this product matrix/i.test(
        String(b),
      )
    ) {
      continue
    }
    if (/amazon|manufacturer|retailer/i.test(b) && !missingUrlNotes.includes(b)) {
      missingUrlNotes.push(b)
    }
  }

  return { coverage, sections, allRows, missingUrlNotes }
}

export function getCanonicalSourceCitation(
  row: CanonicalFieldMapping | null | undefined,
  sources: EvidenceSource[],
): Gate1SourceCitation {
  const url = row?.source_url?.trim() || null
  if (!url) {
    return {
      title: '—',
      reviewerLabel: '—',
      url: null,
      quote: row?.source_quote ?? null,
      confidence: row?.confidence_label ?? null,
      technicalSourceType: null,
    }
  }

  const source = sources.find((s) => normalizeUrlKey(s.url) === normalizeUrlKey(url)) ?? null
  const type = (source?.source_type ?? '').toLowerCase()
  let usageStatus: Gate1SourceUsageStatus = 'supporting'
  if (type === 'amazon' || isAmazonUrl(url)) usageStatus = 'primary'
  else if (
    type === 'manufacturer' ||
    type === 'ingredient_page' ||
    type === 'faq' ||
    isRegulatoryUrl(url)
  ) {
    usageStatus = 'primary'
  }

  return {
    title: source?.title?.trim() || sourceLabelForUrl(url, sources).split(' (')[0] || url,
    reviewerLabel: reviewerLabelForSource(source, url, usageStatus),
    url,
    quote: row?.source_quote ?? null,
    confidence: row?.confidence_label ?? null,
    technicalSourceType: source?.source_type ?? null,
  }
}
