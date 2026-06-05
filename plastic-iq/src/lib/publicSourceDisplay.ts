import { buildGate1SourcesReview, type Gate1SourceRow } from './gate1SourcesReview'
import type { ProductEvidence } from '../types/agent'
import { isPrimaryRetailerReviewerLabel } from './publicRetailerHostLabels'

export type PublicSourceLabel = 'Manufacturer' | 'Retailer' | 'Regulatory' | 'Context'

export type PublicSourceStatus = 'primary' | 'supporting' | 'context'

export type PublicSourceEligibility = {
  public_display: boolean
  public_label?: PublicSourceLabel
  public_status?: PublicSourceStatus
  hide_reason?: string
}

export type PublicProductSource = {
  source_type: string
  url: string
  title: string
  public_label: PublicSourceLabel
  public_status: PublicSourceStatus
}

const HIDDEN_SOURCE_TYPES =
  /^(search_result|failed_fetch|audit_only|internal|shein|scraping_error|not_found)$/i

const HIDDEN_HOST_RE =
  /shein\.com|wish\.com|aliexpress\.com|temu\.com|dhgate\.com|alibaba\.com/i

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

const RETAILER_CONTEXT_HOST_RE =
  /target\.com|walmart\.com|homedepot\.com|lowes\.com|bestbuy\.com|amazon\.|costco\.com|williams-sonoma\.com|crateandbarrel\.com|surlatable\.com/

export function isRetailerContextHost(url: string): boolean {
  return RETAILER_CONTEXT_HOST_RE.test(hostOf(url))
}

function publicLabelFromReviewerLabel(reviewerLabel: string, url: string): PublicSourceLabel {
  if (isPrimaryRetailerReviewerLabel(reviewerLabel)) return 'Retailer'
  if (isRetailerContextHost(url)) return 'Retailer'
  if (/manufacturer/i.test(reviewerLabel)) return 'Manufacturer'
  if (/government|regulatory/i.test(reviewerLabel)) return 'Regulatory'
  return 'Context'
}

function publicSourceTitle(row: Gate1SourceRow): string {
  const base = row.title?.trim() || row.url
  if (row.reviewerLabel === 'Manufacturer disclosure page') {
    return `Manufacturer materials page: ${base}`
  }
  if (row.reviewerLabel === 'Manufacturer product page') {
    return `Manufacturer product page: ${base}`
  }
  if (isPrimaryRetailerReviewerLabel(row.reviewerLabel)) {
    return row.usageStatus === 'primary'
      ? `Primary retailer listing: ${base}`
      : `Retailer listing: ${base}`
  }
  if (row.reviewerLabel === 'Context source only') {
    const type = (row.technicalSourceType ?? '').toLowerCase()
    if (isRetailerContextHost(row.url)) {
      return `Retailer listing: ${base}`
    }
    if (type === 'third_party_review' || /review|blog|editorial|consumer\s+reports/i.test(base)) {
      return `Third-party review: ${base}`
    }
    if (/carawayhome\.com|manufacturer/i.test(hostOf(row.url))) {
      return `Manufacturer context: ${base}`
    }
    return `Context source: ${base}`
  }
  return base
}

function publicStatusFromUsage(
  usageStatus: Gate1SourceRow['usageStatus'],
): PublicSourceStatus {
  if (usageStatus === 'primary') return 'primary'
  if (usageStatus === 'supporting') return 'supporting'
  return 'context'
}

/** Resolve whether an audited Gate 1 source row may appear on the public product page. */
export function resolvePublicSourceEligibility(row: Gate1SourceRow): PublicSourceEligibility {
  if (row.usageStatus === 'mismatch' || row.usageStatus === 'rejected') {
    return {
      public_display: false,
      hide_reason: row.reason ?? 'Source not approved for public display.',
    }
  }
  if (row.section === 'rejected_mismatch') {
    return {
      public_display: false,
      hide_reason: row.reason ?? 'Source flagged as mismatched or not authoritative.',
    }
  }
  if (row.reviewerLabel === 'Retailer variant / not used') {
    return {
      public_display: false,
      hide_reason:
        row.reason ?? 'Alternate retailer listing — not verified as this exact product.',
    }
  }

  if (row.usageStatus === 'context-only') {
    return {
      public_display: false,
      hide_reason: row.reason ?? 'Context-only source — not shown as an exact product page.',
    }
  }

  const type = (row.technicalSourceType ?? '').toLowerCase()
  if (HIDDEN_SOURCE_TYPES.test(type)) {
    return {
      public_display: false,
      hide_reason: 'Internal or non-authoritative source type.',
    }
  }
  if (HIDDEN_HOST_RE.test(hostOf(row.url))) {
    return {
      public_display: false,
      hide_reason: 'Third-party reseller source not used as primary evidence.',
    }
  }

  return {
    public_display: true,
    public_label: publicLabelFromReviewerLabel(row.reviewerLabel, row.url),
    public_status: publicStatusFromUsage(row.usageStatus),
  }
}

/** Build consumer-facing sources from approved evidence using Gate 1 audit rules. */
export function buildPublicSourcesFromEvidence(
  evidence: ProductEvidence,
): PublicProductSource[] {
  const model = buildGate1SourcesReview(evidence)
  const seen = new Set<string>()
  const out: PublicProductSource[] = []

  for (const row of model.allRows) {
    const eligibility = resolvePublicSourceEligibility(row)
    if (!eligibility.public_display || !eligibility.public_label || !eligibility.public_status) {
      continue
    }
    const key = normalizeUrlKey(row.url)
    if (seen.has(key)) continue
    seen.add(key)

    const source = evidence.sources?.find((s) => normalizeUrlKey(s.url) === key)
    out.push({
      source_type: String(source?.source_type ?? row.technicalSourceType ?? 'other').trim() || 'other',
      url: row.url,
      title: publicSourceTitle(row),
      public_label: eligibility.public_label,
      public_status: eligibility.public_status,
    })
  }

  return out.sort((a, b) => a.title.localeCompare(b.title))
}

/** Heuristic fallback when evidence display pack is unavailable (unpublished dev, pre-migration). */
export function filterSourcesHeuristic(
  sources: Array<{ source_type: string; url: string; title: string | null }>,
): PublicProductSource[] {
  const seen = new Set<string>()
  const out: PublicProductSource[] = []

  for (const source of sources) {
    const url = source.url?.trim()
    if (!url) continue
    const type = (source.source_type ?? '').toLowerCase()
    if (HIDDEN_SOURCE_TYPES.test(type)) continue
    if (HIDDEN_HOST_RE.test(hostOf(url))) continue
    const key = normalizeUrlKey(url)
    if (seen.has(key)) continue
    seen.add(key)

    let public_label: PublicSourceLabel = 'Context'
    if (type === 'amazon' || /amazon\.(com|ca)/i.test(hostOf(url))) public_label = 'Retailer'
    else if (
      type === 'manufacturer' ||
      type === 'ingredient_page' ||
      type === 'faq' ||
      type === 'spec_sheet'
    ) {
      public_label = 'Manufacturer'
    } else if (type === 'regulatory' || type === 'government' || /\.gov$/i.test(hostOf(url))) {
      public_label = 'Regulatory'
    }

    out.push({
      source_type: source.source_type,
      url,
      title: source.title?.trim() || hostOf(url) || url,
      public_label,
      public_status: public_label === 'Context' ? 'context' : 'supporting',
    })
  }

  return out
}

export { normalizeUrlKey, hostOf }
