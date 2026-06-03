import { supabase } from './supabaseClient'

/**
 * Latest Agent 2 pipeline product description for the public product page.
 * Reads scoring_inputs.inputs.product_description via security-definer RPC
 * (direct table select is admin-only under RLS).
 */
export async function fetchProductDescription(productId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('get_product_description', {
    p_product_id: productId,
  })

  if (error) throw error
  if (typeof data !== 'string') return null
  const trimmed = data.trim()
  return trimmed.length ? trimmed : null
}
