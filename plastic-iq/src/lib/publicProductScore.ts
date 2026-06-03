import type { Product, ProductTier } from '../types'

/** Public catalog rows may embed approved scores from PostgREST. */
export type PublicProductScoreRow = {
  pac_safety_score: number
  tier: string
  review_status: string
  run_timestamp?: string | null
}

export type ProductRowWithPublicScores = Product & {
  product_scores?: PublicProductScoreRow[] | null
}

/**
 * Phase 2A: public listings use approved product_scores only — never products.* cache
 * written at Agent 3 run (may be pending_review).
 */
export function applyApprovedPublicScores<T extends Product>(row: T): T {
  const scores = (row as ProductRowWithPublicScores).product_scores ?? []
  const approved = scores
    .filter((s) => s.review_status === 'approved')
    .sort((a, b) => {
      const at = a.run_timestamp ? new Date(a.run_timestamp).getTime() : 0
      const bt = b.run_timestamp ? new Date(b.run_timestamp).getTime() : 0
      return bt - at
    })[0]

  if (!approved) {
    return {
      ...row,
      pac_safety_score: null,
      tier: null,
    }
  }

  return {
    ...row,
    pac_safety_score: approved.pac_safety_score,
    tier: approved.tier as ProductTier,
  }
}
