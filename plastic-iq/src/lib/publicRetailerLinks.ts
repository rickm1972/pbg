import { buildGate1SourcesReview, type Gate1SourceRow } from './gate1SourcesReview'
import { hostOf, normalizeUrlKey } from './publicSourceDisplay'
import { orderedRetailerLinks, type RetailerLink } from './retailerLinks'
import type { ProductEvidence } from '../types/agent'
import type { Product } from '../types'
import { buildPublicDisplayContract } from './publicProductDisplayContract'
import { retailerListingHasConfirmedVariantMismatch } from './retailerVariantMatch'

type ProductRetailerFields = Pick<
  Product,
  | 'product_name'
  | 'affiliate_link'
  | 'amazon_url'
  | 'target_url'
  | 'walmart_url'
  | 'other_retailer_url'
>

export type PublicRetailerCtaDecision = {
  allowed: boolean
  reason: string
  /** Where the URL candidate came from for debug/reporting. */
  source: 'admin_product_field' | 'evidence_only'
}

const MISMATCH_WARNING_RE =
  /mismatch|wrong\s+(model|product)|different\s+(product|model|configuration)|pack[\s-]?size|not\s+authoritative|do\s+not\s+use|rejected\s+as\s+primary|variant\s+mismatch|url\s+(error|pack)/i
const URL_IN_TEXT_RE = /https?:\/\/[^\s)\]"']+/gi

/** True when URL matches an admin-curated product retailer / affiliate field. */
export function isAdminProductRetailerUrl(
  url: string,
  product: ProductRetailerFields | null | undefined,
): boolean {
  if (!product) return false
  const key = normalizeUrlKey(url)
  const candidates = [
    product.affiliate_link,
    product.amazon_url,
    product.target_url,
    product.walmart_url,
    product.other_retailer_url,
  ]
    .map((u) => String(u ?? '').trim())
    .filter(Boolean)
  return candidates.some((u) => normalizeUrlKey(u) === key)
}

/** Gate 1 states that block the exact same URL from public CTAs (not other evidence URLs). */
export function isExactUrlExplicitlyRejectedInGate1(row: Gate1SourceRow | undefined): boolean {
  if (!row) return false
  if (row.usageStatus === 'mismatch' || row.usageStatus === 'rejected') return true
  if (row.section === 'rejected_mismatch') return true
  if (row.reviewerLabel === 'Retailer variant / not used') return true
  return false
}

/** @deprecated Use isExactUrlExplicitlyRejectedInGate1 — evidence-only rows; not used for admin blanket block. */
export function isGate1RowBlockedForCta(row: Gate1SourceRow): boolean {
  return isExactUrlExplicitlyRejectedInGate1(row)
}

function evaluateAdminCuratedCta(
  url: string,
  evidence: ProductEvidence | null | undefined,
  _product: ProductRetailerFields,
): PublicRetailerCtaDecision {
  if (evidence?.sources?.length) {
    const model = buildGate1SourcesReview(evidence)
    const row = model.allRows.find((r) => normalizeUrlKey(r.url) === normalizeUrlKey(url))

    if (isExactUrlExplicitlyRejectedInGate1(row)) {
      return {
        allowed: false,
        source: 'admin_product_field',
        reason: `gate1_exact_url_rejected:${row?.usageStatus}:${row?.section}`,
      }
    }
  }

  const reviewedTitle =
    buildPublicDisplayContract(_product, evidence ?? null).reviewedProductName ||
    _product.product_name ||
    ''
  if (retailerListingHasConfirmedVariantMismatch(reviewedTitle, url, '')) {
    return {
      allowed: false,
      source: 'admin_product_field',
      reason: 'admin_url_variant_mismatch',
    }
  }

  return {
    allowed: true,
    source: 'admin_product_field',
    reason: 'admin_curated_product_link',
  }
}

/**
 * Evaluate whether a retailer URL may appear as a public CTA.
 * Admin product fields are the source of truth; Gate 1 only blocks the exact same URL when rejected.
 */
export function evaluatePublicRetailerCtaEligibility(
  url: string,
  evidence: ProductEvidence | null | undefined,
  product?: ProductRetailerFields | null,
): PublicRetailerCtaDecision {
  const trimmed = url?.trim()
  if (!trimmed) {
    return { allowed: false, reason: 'empty_url', source: 'admin_product_field' }
  }

  if (product && isAdminProductRetailerUrl(trimmed, product)) {
    return evaluateAdminCuratedCta(trimmed, evidence, product)
  }

  const h = hostOf(trimmed)
  if (/shein\.com|wish\.com|aliexpress\.com|temu\.com/i.test(h)) {
    return { allowed: false, reason: 'unsupported_reseller_host', source: 'evidence_only' }
  }

  return { allowed: false, reason: 'not_admin_curated_link', source: 'evidence_only' }
}

export function isVerifiedPublicRetailerUrl(
  url: string,
  evidence: ProductEvidence | null | undefined,
  product?: ProductRetailerFields | null,
): boolean {
  return evaluatePublicRetailerCtaEligibility(url, evidence, product).allowed
}

/** Public product page retailer CTAs from admin-curated product fields. */
export function publicRetailerLinks(
  product: Pick<
    Product,
    | 'product_name'
    | 'brand'
    | 'affiliate_link'
    | 'amazon_url'
    | 'target_url'
    | 'walmart_url'
    | 'other_retailer_label'
    | 'other_retailer_url'
  >,
  evidence: ProductEvidence | null | undefined,
): RetailerLink[] {
  return orderedRetailerLinks(product).filter((link) =>
    isVerifiedPublicRetailerUrl(link.url, evidence, product),
  )
}

export function explainPublicRetailerCtas(
  product: ProductRetailerFields,
  evidence: ProductEvidence | null | undefined,
): Array<{
  retailer: string
  url: string
  allowed: boolean
  reason: string
  source: PublicRetailerCtaDecision['source']
}> {
  return orderedRetailerLinks(product).map((link) => {
    const decision = evaluatePublicRetailerCtaEligibility(link.url, evidence, product)
    return {
      retailer: link.id,
      url: link.url,
      allowed: decision.allowed,
      reason: decision.reason,
      source: decision.source,
    }
  })
}
