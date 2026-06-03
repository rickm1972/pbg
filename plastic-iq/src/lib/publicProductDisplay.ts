import type { ProductPageScore } from './productScoresApi'

/** Public lists only show products with an approved numeric PAC score. */
export function hasPublicDisplayScore(product: {
  pac_safety_score: number | null | undefined
}): boolean {
  return typeof product.pac_safety_score === 'number' && Number.isFinite(product.pac_safety_score)
}

export function filterPublicListProducts<T extends { pac_safety_score: number | null | undefined }>(
  products: T[],
): T[] {
  return products.filter(hasPublicDisplayScore)
}

export function hasApprovedPageScore(pageScore: ProductPageScore | null | undefined): boolean {
  return (
    pageScore != null &&
    typeof pageScore.pac_safety_score === 'number' &&
    Number.isFinite(pageScore.pac_safety_score)
  )
}

export const PUBLIC_SCORE_PENDING_MESSAGE = 'Product not yet reviewed'
