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

/**
 * Valid peer = active product, approved score on current chain:
 * active_evidence_id → approved scoring_inputs → approved product_scores.
 * Excludes legacy_do_not_use archive tables (main pipeline rows only).
 */
export async function fetchSubcategoryPeerScores(supabase, product, excludeScoreId) {
  if (!product.subcategory) return []

  const { data: peers, error: peersError } = await supabase
    .from('products')
    .select(
      'product_id, product_name, category, subcategory, active, publish_status, active_evidence_id, agent_status',
    )
    .eq('subcategory', product.subcategory)
    .eq('active', true)
    .neq('product_id', product.product_id)

  if (peersError) throw new Error(`Failed to load subcategory peers: ${peersError.message}`)
  if (!peers?.length) return []

  const results = []

  for (const peer of peers) {
    if (!peer.active_evidence_id) continue

    const { data: evidence, error: evErr } = await supabase
      .from('product_evidence')
      .select('evidence_id, review_status')
      .eq('evidence_id', peer.active_evidence_id)
      .eq('product_id', peer.product_id)
      .maybeSingle()
    if (evErr) throw new Error(`Failed to load peer evidence: ${evErr.message}`)
    if (!evidence || evidence.review_status !== 'approved') continue

    const { data: scoringInput, error: inErr } = await supabase
      .from('scoring_inputs')
      .select('input_id, evidence_id, review_status, inputs')
      .eq('product_id', peer.product_id)
      .eq('evidence_id', peer.active_evidence_id)
      .eq('review_status', 'approved')
      .order('review_timestamp', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (inErr) throw new Error(`Failed to load peer scoring_inputs: ${inErr.message}`)
    if (!scoringInput) continue

    const { data: score, error: scErr } = await supabase
      .from('product_scores')
      .select('score_id, product_id, pac_safety_score, tier, component_nprs, input_id, review_status, run_timestamp')
      .eq('product_id', peer.product_id)
      .eq('input_id', scoringInput.input_id)
      .eq('review_status', 'approved')
      .order('run_timestamp', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (scErr) throw new Error(`Failed to load peer product_scores: ${scErr.message}`)
    if (!score || score.score_id === excludeScoreId) continue

    results.push({
      product: peer,
      score,
      inputs: scoringInput.inputs ?? null,
      evidence_id: evidence.evidence_id,
      input_id: scoringInput.input_id,
    })
  }

  return results
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
