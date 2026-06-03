/**
 * Agent 1 only — wipe evidence and return product to Run tab (unscored).
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
    .select('evidence_id')
    .eq('product_id', productId)
  if (eListErr) throw eListErr

  if (evidence?.length) {
    const { error: delErr } = await sb.from('product_evidence').delete().eq('product_id', productId)
    if (delErr) throw delErr
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
    evidence_deleted: evidence?.length ?? 0,
    agent_status: 'unscored',
  }
}
