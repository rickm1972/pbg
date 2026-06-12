import { supabase } from './supabaseClient'
import type { Agent3LockedOutputRow } from '../types/agent3LockedOutput'
import {
  getAgent3LockedOutputForReview,
  getLatestAgent3LockedOutputForProduct,
  listPendingAgent3LockedOutputs,
  updateAgent3LockedOutputReviewStatus,
} from './agent3LockedOutput/agent3LockedOutputStore'
import { pickLatestPerCatalogDisplay } from './lockedPipeline/displayDedupe'

export type Agent3LockedOutputDashboardItem = {
  output: Agent3LockedOutputRow
  product_name: string | null
  brand: string | null
}

export async function fetchAgent3LockedOutputDashboard(): Promise<{
  pending: Agent3LockedOutputDashboardItem[]
}> {
  const outputs = await listPendingAgent3LockedOutputs()
  if (!outputs.length) return { pending: [] }

  const productIds = [...new Set(outputs.map((o) => o.product_id))]
  const { data: products, error } = await supabase
    .from('products')
    .select('product_id, product_name, brand')
    .in('product_id', productIds)

  if (error) throw error
  const byId = new Map((products ?? []).map((p) => [p.product_id, p]))

  const items = outputs.map((output) => {
    const p = byId.get(output.product_id)
    return {
      output,
      product_id: output.product_id,
      created_at: output.created_at,
      product_name: p?.product_name ?? output.display_payload?.product_name ?? null,
      brand: p?.brand ?? output.display_payload?.brand ?? null,
    }
  })

  const deduped = pickLatestPerCatalogDisplay(items)

  return {
    pending: deduped.map((item) => ({
      output: item.output,
      product_name: item.product_name,
      brand: item.brand,
    })),
  }
}

export async function approveAgent3LockedOutput(params: {
  locked_output_id: string
  reviewed_by: string
  review_notes?: string | null
}): Promise<Agent3LockedOutputRow> {
  return updateAgent3LockedOutputReviewStatus({
    locked_output_id: params.locked_output_id,
    review_status: 'approved',
    reviewed_by: params.reviewed_by,
    review_notes: params.review_notes ?? null,
  })
}

export async function rejectAgent3LockedOutput(params: {
  locked_output_id: string
  reviewed_by: string
  review_notes?: string | null
}): Promise<Agent3LockedOutputRow> {
  return updateAgent3LockedOutputReviewStatus({
    locked_output_id: params.locked_output_id,
    review_status: 'rejected',
    reviewed_by: params.reviewed_by,
    review_notes: params.review_notes ?? null,
  })
}

export {
  getAgent3LockedOutputForReview,
  getLatestAgent3LockedOutputForProduct,
}
