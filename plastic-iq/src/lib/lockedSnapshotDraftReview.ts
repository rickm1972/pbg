import { supabase } from './supabaseClient'
import type { LockedSnapshotDraftRow } from '../types/lockedSnapshotDraft'
import { listReviewableLockedSnapshotDrafts, updateLockedSnapshotDraftReviewStatus } from './lockedSnapshotDraft/lockedSnapshotDraftStore'
import { pickLatestPerCatalogDisplay } from './lockedPipeline/displayDedupe'

export type LockedSnapshotDraftDashboardItem = {
  draft: LockedSnapshotDraftRow
  product_name: string | null
  brand: string | null
}

export async function fetchLockedSnapshotDraftDashboard(): Promise<{
  drafts: LockedSnapshotDraftDashboardItem[]
}> {
  const drafts = await listReviewableLockedSnapshotDrafts()
  if (!drafts.length) return { drafts: [] }

  const productIds = [...new Set(drafts.map((d) => d.product_id))]
  const { data: products, error } = await supabase
    .from('products')
    .select('product_id, product_name, brand')
    .in('product_id', productIds)
  if (error) throw error
  const byId = new Map((products ?? []).map((p) => [p.product_id, p]))

  const items = drafts.map((draft) => {
    const p = byId.get(draft.product_id)
    return {
      draft,
      product_id: draft.product_id,
      created_at: draft.created_at,
      product_name: p?.product_name ?? draft.snapshot_payload?.product_name ?? null,
      brand: p?.brand ?? draft.snapshot_payload?.brand ?? null,
    }
  })

  const deduped = pickLatestPerCatalogDisplay(items)
  return {
    drafts: deduped.map((item) => ({
      draft: item.draft,
      product_name: item.product_name,
      brand: item.brand,
    })),
  }
}

export async function rejectLockedSnapshotDraft(params: {
  locked_snapshot_draft_id: string
  reviewed_by: string
  review_notes?: string | null
}): Promise<LockedSnapshotDraftRow> {
  return updateLockedSnapshotDraftReviewStatus({
    locked_snapshot_draft_id: params.locked_snapshot_draft_id,
    draft_status: 'rejected',
    reviewed_by: params.reviewed_by,
    review_notes: params.review_notes ?? null,
  })
}

export async function markLockedSnapshotDraftReadyForReview(params: {
  locked_snapshot_draft_id: string
  reviewed_by: string
}): Promise<LockedSnapshotDraftRow> {
  return updateLockedSnapshotDraftReviewStatus({
    locked_snapshot_draft_id: params.locked_snapshot_draft_id,
    draft_status: 'ready_for_review',
    reviewed_by: params.reviewed_by,
  })
}
