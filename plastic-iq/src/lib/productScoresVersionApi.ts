import { supabase } from './supabaseClient'
import type { ProductScoreRow } from '../types/agent'

export async function fetchProductScoreVersionsForProduct(
  productId: string,
): Promise<ProductScoreRow[]> {
  const { data, error } = await supabase
    .from('product_scores')
    .select('*')
    .eq('product_id', productId)
    .order('run_timestamp', { ascending: false })

  if (error) throw error
  return (data ?? []) as ProductScoreRow[]
}

export async function fetchProductScoreById(scoreId: string): Promise<ProductScoreRow | null> {
  const { data, error } = await supabase
    .from('product_scores')
    .select('*')
    .eq('score_id', scoreId)
    .maybeSingle()

  if (error) throw error
  return (data as ProductScoreRow | null) ?? null
}

export async function fetchScoringInputSummaryForScore(inputId: string): Promise<{
  input_id: string
  review_status: string
  evidence_id: string
  run_timestamp: string
} | null> {
  const { data, error } = await supabase
    .from('scoring_inputs')
    .select('input_id, review_status, evidence_id, run_timestamp')
    .eq('input_id', inputId)
    .maybeSingle()

  if (error) throw error
  return data
}
