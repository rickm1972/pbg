import { supabase } from './supabaseClient'
import {
  type ClaimIntakeMap,
  type ClaimIntakeType,
  type ClaimIntakeValue,
  type ProductClaimIntakeRow,
  CLAIM_INTAKE_TYPES,
  claimIntakeValueFromLegacy,
  emptyClaimIntakeMap,
  mergeClaimIntakeRows,
} from './productClaimIntake'
import type { Product } from '../types'

export async function loadProductClaimIntake(productId: string): Promise<ClaimIntakeMap> {
  const { data, error } = await supabase
    .from('product_claim_intake')
    .select('*')
    .eq('product_id', productId)
  if (error) throw error
  return mergeClaimIntakeRows((data ?? []) as ProductClaimIntakeRow[])
}

export function buildClaimIntakeFromProduct(product: Product): ClaimIntakeMap {
  const out = emptyClaimIntakeMap()
  out.bpa_free = claimIntakeValueFromLegacy(product.bpa_free)
  out.phthalate_free = claimIntakeValueFromLegacy(product.phthalate_free_claim)
  return out
}

export async function syncProductClaimIntake(
  productId: string,
  claims: ClaimIntakeMap,
): Promise<void> {
  const rows = CLAIM_INTAKE_TYPES.map((claim_type) => ({
    product_id: productId,
    claim_type,
    claim_value: (claims[claim_type] ?? 'unknown') as ClaimIntakeValue,
  }))

  const { error: deleteError } = await supabase
    .from('product_claim_intake')
    .delete()
    .eq('product_id', productId)
  if (deleteError) throw deleteError

  const { error: insertError } = await supabase.from('product_claim_intake').insert(rows)
  if (insertError) throw insertError
}
