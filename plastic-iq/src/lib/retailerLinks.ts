import type { Product } from '../types'
import {
  isAmazonHost,
  retailerDisplayNameFromProductUrl,
} from './publicRetailerHostLabels'

export type RetailerId = 'amazon' | 'target' | 'walmart' | 'other'

export type RetailerLink = {
  id: RetailerId
  url: string
  buyLabel: string
  viewLabel: string
}

function capitalizeWord(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s
}

type ProductBuyLinkFields = Pick<
  Product,
  'brand' | 'other_retailer_label' | 'other_retailer_url'
>

/** Primary buy link may live in amazon_url/affiliate_link even when it is a non-Amazon retailer PDP. */
function primaryBuyLinkLabels(
  url: string,
  product?: ProductBuyLinkFields | null,
): Pick<RetailerLink, 'id' | 'buyLabel' | 'viewLabel'> {
  try {
    const host = new URL(url).hostname.toLowerCase()
    if (isAmazonHost(host)) {
      return { id: 'amazon', buyLabel: 'Buy on Amazon', viewLabel: 'View on Amazon' }
    }
    if (host.includes('target.com')) {
      return { id: 'target', buyLabel: 'Buy on Target', viewLabel: 'View on Target' }
    }
    if (host.includes('walmart.com')) {
      return { id: 'walmart', buyLabel: 'Buy on Walmart', viewLabel: 'View on Walmart' }
    }
    const retailerName = retailerDisplayNameFromProductUrl(url, product)
    if (retailerName) {
      return {
        id: 'other',
        buyLabel: `Buy on ${retailerName}`,
        viewLabel: `View on ${retailerName}`,
      }
    }
    const brandName = (product?.brand || '').trim()
    if (brandName) {
      return {
        id: 'other',
        buyLabel: `Buy on ${brandName}`,
        viewLabel: `View on ${brandName}`,
      }
    }
    return {
      id: 'other',
      buyLabel: 'Buy on Brand Site',
      viewLabel: 'View on Brand Site',
    }
  } catch {
    const retailerName = retailerDisplayNameFromProductUrl(url, product)
    if (retailerName) {
      return {
        id: 'other',
        buyLabel: `Buy on ${retailerName}`,
        viewLabel: `View on ${retailerName}`,
      }
    }
    const brandName = (product?.brand || '').trim()
    if (brandName) {
      return {
        id: 'other',
        buyLabel: `Buy on ${brandName}`,
        viewLabel: `View on ${brandName}`,
      }
    }
    return { id: 'other', buyLabel: 'Buy on Brand Site', viewLabel: 'View on Brand Site' }
  }
}

export function orderedRetailerLinks(
  product: Pick<
    Product,
    | 'brand'
    | 'affiliate_link'
    | 'amazon_url'
    | 'target_url'
    | 'walmart_url'
    | 'other_retailer_label'
    | 'other_retailer_url'
  >,
): RetailerLink[] {
  const amazon = (product.affiliate_link || product.amazon_url || '').trim()
  const out: RetailerLink[] = []
  if (amazon) {
    out.push({
      url: amazon,
      ...primaryBuyLinkLabels(amazon, product),
    })
  }
  const target = (product.target_url || '').trim()
  if (target) {
    out.push({
      id: 'target',
      url: target,
      buyLabel: 'Buy on Target',
      viewLabel: 'View on Target',
    })
  }
  const walmart = (product.walmart_url || '').trim()
  if (walmart) {
    out.push({
      id: 'walmart',
      url: walmart,
      buyLabel: 'Buy on Walmart',
      viewLabel: 'View on Walmart',
    })
  }
  const other = (product.other_retailer_url || '').trim()
  if (other) {
    const label = (product.other_retailer_label || '').trim()
    const viewLabel = label ? `View on ${label}` : 'View on Manufacturer Site'
    const buyLabel = label ? `Buy on ${label}` : 'Buy on Manufacturer Site'
    out.push({
      id: 'other',
      url: other,
      buyLabel,
      viewLabel,
    })
  }
  return out
}

/** Excellent / Good → “Buy on …”; Caution / Concern / High Risk → “View on …”. */
export function publicRetailerCtaLabel(link: RetailerLink, tier: string, _muted?: boolean): string {
  if (tier === 'Excellent' || tier === 'Good') return link.buyLabel
  return link.viewLabel
}

/** Muted button styling for non-Excellent/Good tiers. */
export function usePublicRetailerMutedStyle(tier: string, _pacScore?: number): boolean {
  return tier !== 'Excellent' && tier !== 'Good'
}
