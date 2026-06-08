/**
 * Mutable commerce / affiliate link layer — separate from frozen APR display truth.
 */

import type { Product } from '../../types'
import type { AprDisplayBuyCta } from '../../types/apr'
import { orderedRetailerLinks } from '../retailerLinks'
import { publicRetailerCtaLabel } from '../retailerLinks'
import { retailerDisplayNameFromProductUrl } from '../publicRetailerHostLabels'
import { validateCommerceLinkForProduct } from './commerceLinkValidation'

export type ProductCommerceLink = {
  link_id: string
  product_id: string
  retailer_key: 'amazon' | 'target' | 'walmart' | 'other'
  retailer_name: string
  canonical_url: string | null
  affiliate_url: string
  active: boolean
  priority: number
  disclosure_required: boolean
  last_checked: string | null
  created_at: string
  updated_at: string
}

function retailerNameFromLink(
  link: { id: string; url: string; buyLabel: string },
  product: Pick<Product, 'brand' | 'other_retailer_label'>,
): string {
  if (link.id === 'other') {
    return (
      (product.other_retailer_label || '').trim() ||
      retailerDisplayNameFromProductUrl(link.url, product) ||
      'Retailer'
    )
  }
  const match = link.buyLabel.match(/(?:Buy|View) on (.+)/i)
  return match?.[1]?.trim() || link.id
}

/** Derive commerce links from admin product retailer fields (mutable source of truth). */
export function commerceLinksFromProduct(product: Product): ProductCommerceLink[] {
  const now = new Date().toISOString()
  return orderedRetailerLinks(product).map((link, priority) => ({
    link_id: `${product.product_id}:${link.id}:${priority}`,
    product_id: product.product_id,
    retailer_key: link.id,
    retailer_name: retailerNameFromLink(link, product),
    canonical_url: link.url,
    affiliate_url: link.url,
    active: true,
    priority,
    disclosure_required: true,
    last_checked: null,
    created_at: now,
    updated_at: now,
  }))
}

export function loadCommerceLinksForProduct(product: Product): ProductCommerceLink[] {
  return commerceLinksFromProduct(product)
}

/** Apply a commerce URL update — returns new link row; does not touch display snapshot. */
export function updateCommerceLinkAffiliateUrl(
  link: ProductCommerceLink,
  affiliate_url: string,
): ProductCommerceLink {
  return {
    ...link,
    affiliate_url: affiliate_url.trim(),
    updated_at: new Date().toISOString(),
  }
}

export function commerceLinksToBuyCta(
  links: ProductCommerceLink[],
  tier: string,
  product?: Pick<Product, 'brand' | 'other_retailer_label'>,
): AprDisplayBuyCta[] {
  const active = links
    .filter((l) => l.active && l.affiliate_url.trim())
    .sort((a, b) => a.priority - b.priority)

  const out: AprDisplayBuyCta[] = []
  for (const link of active) {
    const validation = validateCommerceLinkForProduct(link.affiliate_url, product ?? null)
    if (!validation.allowed) continue
    const retailerLink = {
      id: link.retailer_key,
      url: link.affiliate_url,
      buyLabel: `Buy on ${link.retailer_name}`,
      viewLabel: `View on ${link.retailer_name}`,
    }
    out.push({
      label: publicRetailerCtaLabel(retailerLink, tier),
      url: link.affiliate_url,
    })
  }
  return out
}

export function commerceLinkChangeEvent(
  link: ProductCommerceLink,
  before: Partial<ProductCommerceLink>,
  eventType: 'update' | 'activate' | 'deactivate',
) {
  return {
    event_id: crypto.randomUUID?.() ?? `evt-${Date.now()}`,
    link_id: link.link_id,
    product_id: link.product_id,
    event_type: eventType,
    before_state: before,
    after_state: link,
    created_at: new Date().toISOString(),
  }
}
