import type { Product } from '../../types'
import type { ProductTier } from '../../types'
import type { AprDisplayBuyCta } from '../../types/apr'
import { publicRetailerLinks } from '../publicRetailerLinks'
import { publicRetailerCtaLabel } from '../retailerLinks'

/** Admin-curated buy CTAs for safer-alternative rows (category list fetch, no per-product APR). */
export function alternativeProductBuyCtas(
  product: Product,
  tier: ProductTier = 'Excellent',
): AprDisplayBuyCta[] {
  return publicRetailerLinks(product, null).map((link) => ({
    label: publicRetailerCtaLabel(link, tier, false),
    url: link.url,
  }))
}
