import { supabase } from './supabaseClient'
import type { Agent4LockedAuditRow } from '../types/agent4LockedAudit'
import {
  listReviewableAgent4LockedAudits,
  updateAgent4LockedAuditReviewStatus,
} from './agent4LockedAudit/agent4LockedAuditStore'
import { pickLatestPerCatalogDisplay } from './lockedPipeline/displayDedupe'

export type Agent4LockedAuditDashboardItem = {
  audit: Agent4LockedAuditRow
  product_name: string | null
  brand: string | null
}

export async function fetchAgent4LockedAuditDashboard(): Promise<{
  audits: Agent4LockedAuditDashboardItem[]
}> {
  const audits = await listReviewableAgent4LockedAudits()
  if (!audits.length) return { audits: [] }

  const productIds = [...new Set(audits.map((a) => a.product_id))]
  const { data: products, error } = await supabase
    .from('products')
    .select('product_id, product_name, brand')
    .in('product_id', productIds)

  if (error) throw error
  const byId = new Map((products ?? []).map((p) => [p.product_id, p]))

  const items = audits.map((audit) => {
    const p = byId.get(audit.product_id)
    return {
      audit,
      product_id: audit.product_id,
      created_at: audit.created_at,
      product_name: p?.product_name ?? null,
      brand: p?.brand ?? null,
    }
  })

  const deduped = pickLatestPerCatalogDisplay(items)

  return {
    audits: deduped.map((item) => ({
      audit: item.audit,
      product_name: item.product_name,
      brand: item.brand,
    })),
  }
}

export async function rejectAgent4LockedAudit(params: {
  locked_audit_id: string
  reviewed_by: string
  review_notes?: string | null
}): Promise<Agent4LockedAuditRow> {
  return updateAgent4LockedAuditReviewStatus({
    locked_audit_id: params.locked_audit_id,
    audit_status: 'rejected',
    reviewed_by: params.reviewed_by,
    review_notes: params.review_notes ?? null,
  })
}
