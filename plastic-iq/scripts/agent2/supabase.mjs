import {
  createServiceClient,
  fetchProductById,
  fetchProductByName,
  updateAgentStatus,
} from '../agent1/supabase.mjs'

export { createServiceClient, fetchProductById, fetchProductByName, updateAgentStatus }

export async function fetchApprovedEvidence(supabase, productId) {
  const { data, error } = await supabase
    .from('product_evidence')
    .select('*')
    .eq('product_id', productId)
    .eq('review_status', 'approved')
    .order('bundle_version', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(`Failed to load approved evidence: ${error.message}`)
  if (!data) {
    throw new Error(
      `No approved evidence packet for product ${productId}. Approve Agent 1 evidence first.`,
    )
  }
  return data
}

export async function fetchLatestRejectedScoringInputs(supabase, productId) {
  const { data, error } = await supabase
    .from('scoring_inputs')
    .select('input_id, review_notes, review_timestamp, inputs')
    .eq('product_id', productId)
    .eq('review_status', 'rejected')
    .order('review_timestamp', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load rejected scoring_inputs: ${error.message}`)
  }
  return data
}

export async function insertScoringInputs(supabase, row) {
  const { data, error } = await supabase
    .from('scoring_inputs')
    .insert(row)
    .select()
    .single()

  if (error) throw new Error(`Failed to insert scoring_inputs: ${error.message}`)
  return data
}
