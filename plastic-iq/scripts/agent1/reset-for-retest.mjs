/**
 * Agent 1 only — clear active Gate 1 queue and return product to Run tab (unscored).
 * Supersedes pending/draft evidence; deletes only deletable rows. Approved/superseded history stays.
 * Does not delete scoring_inputs / scores / QA (use reset-validation-three for full wipe).
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} sb
 * @param {string} productId
 */
export async function resetAgent1ForRetest(sb, productId) {
  if (!productId) throw new Error('product_id is required')

  const { data: product, error: pErr } = await sb
    .from('products')
    .select('product_id, product_name, agent_status')
    .eq('product_id', productId)
    .maybeSingle()
  if (pErr) throw pErr
  if (!product) throw new Error(`Product ${productId} not found`)

  const { data: evidence, error: eListErr } = await sb
    .from('product_evidence')
    .select('evidence_id, review_status')
    .eq('product_id', productId)
  if (eListErr) throw eListErr

  const now = new Date().toISOString()
  const notes = 'Agent 1 retest reset — prior bundle cleared for fresh run.'
  let evidence_cleared = 0

  for (const row of evidence ?? []) {
    if (row.review_status === 'approved' || row.review_status === 'superseded') {
      continue
    }
    if (row.review_status === 'pending_review' || row.review_status === 'draft') {
      const { error: updErr } = await sb
        .from('product_evidence')
        .update({
          review_status: 'superseded',
          reviewer_notes: notes,
          reviewed_at: now,
        })
        .eq('evidence_id', row.evidence_id)
      if (updErr) throw updErr
      evidence_cleared += 1
      continue
    }
    const { error: delErr } = await sb
      .from('product_evidence')
      .delete()
      .eq('evidence_id', row.evidence_id)
    if (delErr) throw delErr
    evidence_cleared += 1
  }

  const { error: updErr } = await sb
    .from('products')
    .update({
      agent_status: 'unscored',
      active_evidence_id: null,
    })
    .eq('product_id', productId)
  if (updErr) throw updErr

  return {
    product_id: productId,
    product_name: product.product_name,
    prior_status: product.agent_status,
    evidence_deleted: evidence_cleared,
    evidence_cleared,
    agent_status: 'unscored',
  }
}
