import {
  createServiceClient,
  fetchProductById,
  fetchProductByName,
  updateAgentStatus,
} from '../agent1/supabase.mjs'

export { createServiceClient, fetchProductById, fetchProductByName, updateAgentStatus }

export async function fetchApprovedScoringInputs(supabase, productId) {
  const { data, error } = await supabase
    .from('scoring_inputs')
    .select('*')
    .eq('product_id', productId)
    .eq('review_status', 'approved')
    .order('review_timestamp', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(`Failed to load approved scoring_inputs: ${error.message}`)
  if (!data) {
    throw new Error(
      `No approved normalization packet for product ${productId}. Approve Agent 2 normalization first.`,
    )
  }
  return data
}

export async function insertProductScore(supabase, row) {
  const { data, error } = await supabase
    .from('product_scores')
    .insert(row)
    .select()
    .single()

  if (error) throw new Error(`Failed to insert product_scores: ${error.message}`)
  return data
}
