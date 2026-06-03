import { supabase } from './supabaseClient'
import type { ProductTier } from '../types'

export type ProductPageScore = {
  pac_safety_score: number
  tier: ProductTier
  ingredient_transparency_score: number | null
  displayed_confidence_range: string | null
  transparency_badge: string | null
  explanation_draft: string | null
}

type RpcRow = {
  pac_safety_score?: number | null
  tier?: string | null
  displayed_confidence_range?: string | null
  transparency_badge?: string | null
  explanation_draft?: string | null
}

function parseProductPageScore(data: RpcRow | null): ProductPageScore | null {
  if (!data || typeof data.pac_safety_score !== 'number') return null
  const tier = String(data.tier ?? '').trim() as ProductTier
  if (!tier) return null

  return {
    pac_safety_score: data.pac_safety_score,
    tier,
    ingredient_transparency_score: null,
    displayed_confidence_range: data.displayed_confidence_range?.trim() || null,
    transparency_badge: data.transparency_badge?.trim() || null,
    explanation_draft: data.explanation_draft?.trim() || null,
  }
}

function buildRangeFromCi(score: number, ciHalf: number): string | null {
  if (!ciHalf || ciHalf <= 0) return null
  const lower = Math.max(0, score - ciHalf)
  const upper = Math.min(99, score + ciHalf)
  return `${lower}–${upper}`
}

async function fetchProductPageScoreViaRpc(
  productId: string,
): Promise<ProductPageScore | null> {
  const { data, error } = await supabase.rpc('get_product_page_score', {
    p_product_id: productId,
  })
  if (error) return null
  return parseProductPageScore((data as RpcRow | null) ?? null)
}

/**
 * Phase 2A: public score only via get_product_page_score RPC
 * (published + approved product_scores; no pending_review or products row cache).
 */
export async function fetchProductPageScore(
  productId: string,
): Promise<ProductPageScore | null> {
  return fetchProductPageScoreViaRpc(productId)
}

/** @deprecated Use fetchProductPageScore */
export const fetchApprovedProductScore = fetchProductPageScore

export type ApprovedProductScore = ProductPageScore

export { buildRangeFromCi }
