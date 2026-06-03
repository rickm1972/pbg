import type { Product } from '../types'
import { filterPublicListProducts } from './publicProductDisplay'
import { isExcellentProduct, isGoodOrExcellentProduct } from './score'

const MAX_SAFER_ALTERNATIVES = 3

/**
 * Safer alternatives for product pages: Excellent first, then Good, up to 3 (or fewer).
 */
export function pickSaferAlternatives(
  products: Product[],
  excludeProductId: string,
): Product[] {
  return filterPublicListProducts(products)
    .filter((p) => p.product_id !== excludeProductId)
    .map((p) => ({
      p,
      score: p.pac_safety_score as number,
      tier: p.tier,
    }))
    .filter(({ score, tier }) => isGoodOrExcellentProduct(score, tier))
    .sort((a, b) => {
      const aExcellent = isExcellentProduct(a.score, a.tier)
      const bExcellent = isExcellentProduct(b.score, b.tier)
      if (aExcellent !== bExcellent) return aExcellent ? -1 : 1
      return b.score - a.score
    })
    .map(({ p }) => p)
    .slice(0, MAX_SAFER_ALTERNATIVES)
}
