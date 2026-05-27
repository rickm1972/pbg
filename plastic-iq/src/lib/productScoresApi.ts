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

type ScoreRow = RpcRow & {
  review_status?: string | null
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

async function fetchProductPageScoreDirect(
  productId: string,
): Promise<ProductPageScore | null> {
  const { data: rows, error } = await supabase
    .from('product_scores')
    .select(
      'pac_safety_score, tier, displayed_confidence_range, transparency_badge, explanation_draft, review_status',
    )
    .eq('product_id', productId)
    .in('review_status', ['approved', 'pending_review'])
    .order('run_timestamp', { ascending: false })

  if (error) throw error
  const list = (rows ?? []) as ScoreRow[]
  const row =
    list.find((r) => r.review_status === 'approved') ?? list[0] ?? null
  if (!row) return null

  const parsed = parseProductPageScore(row)
  if (parsed) return parsed

  return null
}

/** Public product page score — Agent 3 product_scores with Agent 2 layer_4b fallback via RPC. */
export async function fetchProductPageScore(
  productId: string,
): Promise<ProductPageScore | null> {
  const viaRpc = await fetchProductPageScoreViaRpc(productId)
  if (viaRpc) return viaRpc

  const direct = await fetchProductPageScoreDirect(productId)
  if (direct) return direct

  return null
}

/** @deprecated Use fetchProductPageScore */
export const fetchApprovedProductScore = fetchProductPageScore

export type ApprovedProductScore = ProductPageScore

export { buildRangeFromCi }
