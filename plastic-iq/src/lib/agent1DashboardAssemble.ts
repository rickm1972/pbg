import { isAgent1HeldFromAwaitingReviewTab } from './agent1RunTabOnly'
import type { Agent1DashboardData, ProductEvidence, ProductPipelineRow } from '../types/agent'

export type PendingReviewEntry = Agent1DashboardData['pendingReview'][number] & {
  evidenceMismatch?: 'draft_not_pending_review' | 'no_pending_review_row'
}

export function assembleAgent1Dashboard(
  products: ProductPipelineRow[],
  evidenceRows: ProductEvidence[],
): Agent1DashboardData {
  const latestSubmitted = new Map<string, ProductEvidence>()
  const latestDraft = new Map<string, ProductEvidence>()
  for (const row of evidenceRows) {
    if (row.review_status === 'pending_review' && !latestSubmitted.has(row.product_id)) {
      latestSubmitted.set(row.product_id, row)
    }
    if (row.review_status === 'draft' && !latestDraft.has(row.product_id)) {
      latestDraft.set(row.product_id, row)
    }
  }

  const pendingReview: PendingReviewEntry[] = []
  const heldRuns: Agent1DashboardData['heldRuns'] = []

  for (const product of products) {
    if (product.agent_status === 'evidence_awaiting_review') {
      if (isAgent1HeldFromAwaitingReviewTab(product.product_id)) continue
      const pending = latestSubmitted.get(product.product_id)
      if (pending) {
        pendingReview.push({ product, evidence: pending })
        continue
      }
      const draft = latestDraft.get(product.product_id)
      if (draft) {
        pendingReview.push({
          product,
          evidence: draft,
          evidenceMismatch: 'draft_not_pending_review',
        })
        continue
      }
      pendingReview.push({
        product,
        evidence: null,
        evidenceMismatch: 'no_pending_review_row',
      })
    }
    if (product.agent_status === 'evidence_pending') {
      heldRuns.push({
        product,
        evidence: latestDraft.get(product.product_id) ?? null,
      })
    }
  }

  pendingReview.sort((a, b) => a.product.product_name.localeCompare(b.product.product_name))
  heldRuns.sort((a, b) => a.product.product_name.localeCompare(b.product.product_name))

  const statusCounts: Record<string, number> = {}
  for (const p of products) {
    const key = p.agent_status || 'unscored'
    statusCounts[key] = (statusCounts[key] ?? 0) + 1
  }

  return {
    products,
    pendingReview,
    validationRunQueue: [],
    heldRuns,
    statusCounts,
  }
}

export function mergeEvidenceRows(
  primary: ProductEvidence[],
  extra: ProductEvidence[],
): ProductEvidence[] {
  const byId = new Map<string, ProductEvidence>()
  for (const row of primary) {
    if (row.evidence_id) byId.set(row.evidence_id, row)
  }
  for (const row of extra) {
    if (row.evidence_id) byId.set(row.evidence_id, row)
  }
  return [...byId.values()].sort((a, b) => {
    const bv = (b.bundle_version ?? 0) - (a.bundle_version ?? 0)
    if (bv !== 0) return bv
    return String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''))
  })
}
