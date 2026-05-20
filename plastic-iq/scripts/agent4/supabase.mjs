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
    .order('approved_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(`Failed to load approved evidence: ${error.message}`)
  if (!data) {
    throw new Error(`No approved evidence for product ${productId}`)
  }
  return data
}

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
    throw new Error(`No approved normalization for product ${productId}`)
  }
  return data
}

export async function fetchScoreToAudit(supabase, productId, scoreId) {
  if (scoreId) {
    const { data, error } = await supabase
      .from('product_scores')
      .select('*')
      .eq('score_id', scoreId)
      .eq('product_id', productId)
      .maybeSingle()
    if (error) throw new Error(`Failed to load score: ${error.message}`)
    if (!data) throw new Error(`Score ${scoreId} not found for product`)
    return data
  }

  const { data: approved, error: approvedError } = await supabase
    .from('product_scores')
    .select('*')
    .eq('product_id', productId)
    .eq('review_status', 'approved')
    .order('run_timestamp', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (approvedError) throw new Error(`Failed to load approved score: ${approvedError.message}`)
  if (approved) return approved

  const { data: pending, error: pendingError } = await supabase
    .from('product_scores')
    .select('*')
    .eq('product_id', productId)
    .eq('review_status', 'pending_review')
    .order('run_timestamp', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (pendingError) throw new Error(`Failed to load pending score: ${pendingError.message}`)
  if (pending) return pending

  throw new Error(`No product_scores row to audit for product ${productId}`)
}

export async function fetchSubcategoryPeerScores(supabase, product, excludeScoreId) {
  if (!product.subcategory) return []

  const { data: peers, error: peersError } = await supabase
    .from('products')
    .select('product_id')
    .eq('subcategory', product.subcategory)
    .neq('product_id', product.product_id)

  if (peersError) throw new Error(`Failed to load subcategory peers: ${peersError.message}`)
  if (!peers?.length) return []

  const peerIds = peers.map((p) => p.product_id)
  const { data: scores, error: scoresError } = await supabase
    .from('product_scores')
    .select('score_id, product_id, pac_safety_score, component_nprs, input_id')
    .in('product_id', peerIds)
    .eq('review_status', 'approved')
    .order('run_timestamp', { ascending: false })

  if (scoresError) throw new Error(`Failed to load peer scores: ${scoresError.message}`)

  const latestByProduct = new Map()
  for (const row of scores ?? []) {
    if (row.score_id === excludeScoreId) continue
    if (!latestByProduct.has(row.product_id)) {
      latestByProduct.set(row.product_id, row)
    }
  }

  const inputIds = [...new Set([...latestByProduct.values()].map((s) => s.input_id).filter(Boolean))]
  const inputsById = new Map()
  if (inputIds.length) {
    const { data: inputRows, error: inputError } = await supabase
      .from('scoring_inputs')
      .select('input_id, inputs')
      .in('input_id', inputIds)
    if (inputError) throw new Error(`Failed to load peer inputs: ${inputError.message}`)
    for (const row of inputRows ?? []) {
      inputsById.set(row.input_id, row.inputs)
    }
  }

  return [...latestByProduct.values()].map((score) => ({
    score,
    inputs: inputsById.get(score.input_id) ?? null,
  }))
}

export async function insertProductQa(supabase, row) {
  const { data, error } = await supabase
    .from('product_qa')
    .insert(row)
    .select()
    .single()

  if (error) throw new Error(`Failed to insert product_qa: ${error.message}`)
  return data
}

export async function updateProductQa(supabase, qaId, row) {
  const { data, error } = await supabase
    .from('product_qa')
    .update(row)
    .eq('qa_id', qaId)
    .select()
    .single()

  if (error) throw new Error(`Failed to update product_qa: ${error.message}`)
  return data
}

export async function findExistingQaForScore(supabase, scoreId) {
  const { data, error } = await supabase
    .from('product_qa')
    .select('qa_id, review_status')
    .eq('score_id', scoreId)
    .maybeSingle()
  if (error) throw new Error(`Failed to check existing QA: ${error.message}`)
  return data
}
