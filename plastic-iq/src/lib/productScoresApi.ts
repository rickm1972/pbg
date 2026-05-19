import { supabase } from './supabaseClient'
import type { ProductTier } from '../types'

export type ApprovedProductScore = {
  pac_safety_score: number
  tier: ProductTier
  ingredient_transparency_score: number | null
  displayed_confidence_range: string | null
  transparency_badge: string | null
  explanation_draft: string | null
}

export async function fetchApprovedProductScore(
  productId: string,
): Promise<ApprovedProductScore | null> {
  const { data, error } = await supabase
    .from('product_scores')
    .select(
      'pac_safety_score, tier, ingredient_transparency_score, displayed_confidence_range, transparency_badge, explanation_draft',
    )
    .eq('product_id', productId)
    .eq('review_status', 'approved')
    .order('review_timestamp', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  return {
    pac_safety_score: data.pac_safety_score,
    tier: data.tier as ProductTier,
    ingredient_transparency_score: data.ingredient_transparency_score,
    displayed_confidence_range: data.displayed_confidence_range,
    transparency_badge: data.transparency_badge,
    explanation_draft: data.explanation_draft,
  }
}
