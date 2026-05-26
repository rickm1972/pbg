import { supabase } from './supabaseClient'
import type { NormalizationComponent } from '../types/agent'

export async function fetchNormalizationComponents(
  productId: string,
): Promise<NormalizationComponent[] | null> {
  const { data, error } = await supabase.rpc('get_normalization_components', {
    p_product_id: productId,
  })

  if (error) throw error
  if (!data || !Array.isArray(data)) return null
  if (data.length === 0) return null

  return data as NormalizationComponent[]
}
