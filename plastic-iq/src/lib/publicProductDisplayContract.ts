import type { NormalizationComponent, ProductEvidence } from '../types/agent'
import type { WhyThisScoreFields } from './whyThisScoreApi'
import { getStructuredEvidence } from './evidenceMetadata'
import { whyThisScoreLabelForComponent } from './whyThisScoreLabels'
import { sortComponentsByHazardDesc } from './whyThisScoreSort'
import {
  contextFallbackTitleFromUrl,
  isFilenameLikeSourceTitle,
  isMalformedPublicSourceTitle,
  manufacturerFallbackTitleFromUrl,
  retailerFallbackTitleFromUrl,
  sanitizePublicSourceTitleText,
  stripPublicSourceRolePrefix,
} from './publicSourceTitleFormat'
import { retailerDisplayNameFromHost } from './publicRetailerHostLabels'
import { normalizeUrlKey, hostOf, isRetailerContextHost, type PublicProductSource } from './publicSourceDisplay'
import {
  filterPublicSourcesByContractEligibility,
  resolvePublicSourceContractEligibility,
} from './publicSourceEligibility'

export { manufacturerTitleConflictsReviewedIdentity } from './publicSourceEligibility'

const HIDDEN_SOURCE_TYPES =
  /^(search_result|failed_fetch|audit_only|internal|shein|scraping_error|not_found)$/i

const HIDDEN_HOST_RE =
  /shein\.com|wish\.com|aliexpress\.com|temu\.com|dhgate\.com|alibaba\.com/i

function visibleWhyOptions(options: string[]): string[] {
  if (!options.length) return []
  if (options.length === 1 && options[0] === 'None') return []
  return options.filter((o) => o !== 'None')
}

const CONSTRUCTION_SECONDARY_ROLES = new Set([
  'handle',
  'lid',
  'rivet',
  'gasket',
  'packaging',
  'structural',
])

export type PublicDisplayContract = {
  reviewedProductName: string
  primaryRetailerUrl: string | null
  brand?: string | null
}

export type PublicProductDisplayInput = {
  product_name: string
  brand?: string | null
  affiliate_link?: string | null
  amazon_url?: string | null
}

/** Approved reviewed identity + primary buy-link provenance for public rendering. */
export function buildPublicDisplayContract(
  product: PublicProductDisplayInput,
  evidence: ProductEvidence | null | undefined,
): PublicDisplayContract {
  const structured = getStructuredEvidence(evidence?.agent_metadata ?? {})
  const fromEvidence = structured?.product_identity?.product_name?.trim()
  const primaryRetailerUrl =
    structured?.retailer_links?.amazon_url?.trim() ||
    product.affiliate_link?.trim() ||
    product.amazon_url?.trim() ||
    null

  return {
    reviewedProductName: fromEvidence || product.product_name.trim(),
    primaryRetailerUrl,
    brand: product.brand?.trim() || structured?.product_identity?.brand?.trim() || null,
  }
}

function normalizeSecondaryPublicLabel(label: string): string {
  const text = String(label ?? '').trim()
  if (/graphite structural core|graphite core layer|graphite core \(structural\)/i.test(text)) {
    return 'Graphite core'
  }
  return text
}

function constructionSecondaryLabelsFromComponents(
  components: NormalizationComponent[] | null | undefined,
): string[] {
  const picked: string[] = []
  for (const c of sortComponentsByHazardDesc(components ?? [])) {
    const role = String(c.component_role ?? c.role ?? '')
    if (!CONSTRUCTION_SECONDARY_ROLES.has(role)) continue
    const raw = whyThisScoreLabelForComponent(c.material_id, role, 'secondary')
    const label = raw ? normalizeSecondaryPublicLabel(raw) : null
    if (label && !picked.includes(label)) picked.push(label)
  }
  return picked
}

/** Merge approved Gate 2 secondary options with all construction-relevant normalized components. */
export function publicSecondaryMaterialLabels(
  fields: WhyThisScoreFields,
  components: NormalizationComponent[] | null | undefined,
): string[] {
  const fromComponents = constructionSecondaryLabelsFromComponents(components)
  const fromStored = visibleWhyOptions(fields.secondary_materials_options).map(normalizeSecondaryPublicLabel)

  const merged: string[] = []
  for (const label of fromComponents) {
    if (!merged.includes(label)) merged.push(label)
  }
  for (const label of fromStored) {
    if (label === 'None distinct from primary material') continue
    if (!merged.includes(label)) merged.push(label)
  }
  return merged
}

export function applyPublicSecondaryMaterialsToFields(
  fields: WhyThisScoreFields,
  components: NormalizationComponent[] | null | undefined,
): WhyThisScoreFields {
  const secondary = publicSecondaryMaterialLabels(fields, components)
  return {
    ...fields,
    secondary_materials_options: secondary.length ? secondary : fields.secondary_materials_options,
  }
}

function cleanManufacturerPublicTitle(
  url: string,
  rawTitle: string,
  brand?: string | null,
): string {
  const raw = stripPublicSourceRolePrefix(rawTitle)

  if (isFilenameLikeSourceTitle(raw)) {
    return manufacturerFallbackTitleFromUrl(url, brand)
  }

  const stripped = sanitizePublicSourceTitleText(raw)

  if (isFilenameLikeSourceTitle(stripped) || isMalformedPublicSourceTitle(stripped)) {
    return manufacturerFallbackTitleFromUrl(url, brand)
  }

  const cleaned = sanitizePublicSourceTitleText(stripped)
  if (isMalformedPublicSourceTitle(cleaned)) {
    return manufacturerFallbackTitleFromUrl(url, brand)
  }
  return cleaned
}

function retailerPublicTitle(
  url: string,
  base: string,
  reviewedProductName: string,
  isPrimary: boolean,
): string {
  const retailer = retailerDisplayNameFromHost(hostOf(url))
  if (isPrimary && reviewedProductName) {
    return retailer ? `${retailer} — ${reviewedProductName}` : reviewedProductName
  }
  const cleaned = sanitizePublicSourceTitleText(base)
  if (cleaned && !isMalformedPublicSourceTitle(cleaned)) {
    return retailer ? `${retailer} — ${cleaned}` : cleaned
  }
  return retailer ? `${retailer} — ${retailerFallbackTitleFromUrl(url)}` : retailerFallbackTitleFromUrl(url)
}

export function publicSourceDisplayTitle(
  source: Pick<PublicProductSource, 'url' | 'title' | 'public_label' | 'public_status'>,
  contract: PublicDisplayContract | null | undefined,
): string {
  const base = stripPublicSourceRolePrefix(source.title?.trim() || source.url)
  const reviewed = contract?.reviewedProductName?.trim() ?? ''
  const brand = contract?.brand ?? null
  const isPrimaryRetailer =
    source.public_label === 'Retailer' && source.public_status === 'primary'

  if (source.public_label === 'Retailer') {
    return retailerPublicTitle(source.url, base, reviewed, isPrimaryRetailer)
  }

  if (source.public_label === 'Manufacturer') {
    return cleanManufacturerPublicTitle(source.url, base, brand)
  }

  if (source.public_label === 'Context') {
    const cleaned = sanitizePublicSourceTitleText(base)
    if (cleaned && !isMalformedPublicSourceTitle(cleaned)) return cleaned
    return contextFallbackTitleFromUrl(source.url)
  }

  const cleaned = sanitizePublicSourceTitleText(base)
  return cleaned || source.url
}

/** Enforce primary retailer provenance on public sources (display contract). */
export function applyPublicDisplayContractToSources(
  sources: PublicProductSource[],
  contract: PublicDisplayContract | null | undefined,
): PublicProductSource[] {
  let out: PublicProductSource[]

  if (!contract?.primaryRetailerUrl) {
    out = sources.map((s) => ({
      ...s,
      title: publicSourceDisplayTitle(s, contract),
    }))
  } else {
    const primaryKey = normalizeUrlKey(contract.primaryRetailerUrl)
    const seen = new Set(sources.map((s) => normalizeUrlKey(s.url)))
    out = sources.map((source) => {
      const key = normalizeUrlKey(source.url)
      if (key !== primaryKey) {
        return {
          ...source,
          title: publicSourceDisplayTitle(source, contract),
        }
      }
      const upgraded: PublicProductSource = {
        ...source,
        public_label: 'Retailer',
        public_status: 'primary',
        title: publicSourceDisplayTitle(
          {
            ...source,
            public_label: 'Retailer',
            public_status: 'primary',
          },
          contract,
        ),
      }
      return upgraded
    })

    if (!seen.has(primaryKey) && isRetailerContextHost(contract.primaryRetailerUrl)) {
      const retailer = retailerDisplayNameFromHost(hostOf(contract.primaryRetailerUrl))
      const title = retailer
        ? `${retailer} — ${contract.reviewedProductName}`
        : contract.reviewedProductName
      out.push({
        source_type: 'other_retailer',
        url: contract.primaryRetailerUrl,
        title,
        public_label: 'Retailer',
        public_status: 'primary',
      })
    }
  }

  return filterPublicSourcesByContractEligibility(
    out
      .map((source) => ({
        ...source,
        public_source_eligible: resolvePublicSourceContractEligibility(source, contract)
          .public_source_eligible,
      }))
      .sort((a, b) => a.title.localeCompare(b.title)),
    contract,
  )
}

export function heuristicPublicSourcesFromRaw(
  sources: Array<{ source_type: string; url: string; title: string | null }>,
  contract: PublicDisplayContract | null | undefined,
): PublicProductSource[] {
  const primaryKey = contract?.primaryRetailerUrl
    ? normalizeUrlKey(contract.primaryRetailerUrl)
    : null
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

    let public_label: PublicProductSource['public_label'] = 'Context'
    let public_status: PublicProductSource['public_status'] = 'context'

    if (type === 'amazon' && /amazon\.(com|ca)/i.test(hostOf(url))) {
      public_label = 'Retailer'
      public_status = primaryKey === key ? 'primary' : 'supporting'
    } else if (isRetailerContextHost(url) || type === 'other_retailer') {
      public_label = 'Retailer'
      public_status = primaryKey === key ? 'primary' : 'supporting'
    } else if (
      type === 'manufacturer' ||
      type === 'ingredient_page' ||
      type === 'faq' ||
      type === 'spec_sheet'
    ) {
      public_label = 'Manufacturer'
      public_status = 'supporting'
    } else if (type === 'regulatory' || type === 'government' || /\.gov$/i.test(hostOf(url))) {
      public_label = 'Regulatory'
      public_status = 'supporting'
    }

    out.push({
      source_type: source.source_type,
      url,
      title: source.title?.trim() || hostOf(url) || url,
      public_label,
      public_status,
    })
  }

  return applyPublicDisplayContractToSources(out, contract)
}
