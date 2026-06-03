/**
 * Shared Agent 1 dashboard join: products.agent_status + latest product_evidence versions.
 */

const AGENT1_TFAL_PRODUCT_ID = '7a457a86-ab62-4cbf-90b9-ccaeafe06896'

function isAgent1HeldFromAwaitingReviewTab(productId) {
  return productId === AGENT1_TFAL_PRODUCT_ID
}

/**
 * @param {Array<{ product_id: string, agent_status: string, product_name?: string, brand?: string | null, category?: string | null, subcategory?: string | null }>} products
 * @param {Array<{ product_id: string, review_status: string, bundle_version: number, evidence_id?: string }>} evidenceRows
 */
export function assembleAgent1Dashboard(products, evidenceRows) {
  const latestSubmitted = new Map()
  const latestDraft = new Map()
  for (const row of evidenceRows ?? []) {
    if (row.review_status === 'pending_review' && !latestSubmitted.has(row.product_id)) {
      latestSubmitted.set(row.product_id, row)
    }
    if (row.review_status === 'draft' && !latestDraft.has(row.product_id)) {
      latestDraft.set(row.product_id, row)
    }
  }

  /** @type {Array<{ product: object, evidence: object | null, evidenceMismatch?: string }>} */
  const pendingReview = []
  /** @type {Array<{ product: object, evidence: object | null }>} */
  const heldRuns = []

  for (const product of products ?? []) {
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

  pendingReview.sort((a, b) =>
    String(a.product.product_name ?? '').localeCompare(String(b.product.product_name ?? '')),
  )
  heldRuns.sort((a, b) =>
    String(a.product.product_name ?? '').localeCompare(String(b.product.product_name ?? '')),
  )

  const statusCounts = {}
  for (const p of products ?? []) {
    const key = p.agent_status || 'unscored'
    statusCounts[key] = (statusCounts[key] ?? 0) + 1
  }

  return {
    products: products ?? [],
    pendingReview,
    validationRunQueue: [],
    heldRuns,
    statusCounts,
  }
}

/**
 * Merge evidence rows by evidence_id (API rows win on duplicate id).
 * @param {Array<object>} primary
 * @param {Array<object>} extra
 */
export function mergeEvidenceRows(primary, extra) {
  const byId = new Map()
  for (const row of primary ?? []) {
    if (row?.evidence_id) byId.set(row.evidence_id, row)
  }
  for (const row of extra ?? []) {
    if (row?.evidence_id) byId.set(row.evidence_id, row)
  }
  return [...byId.values()].sort((a, b) => {
    const bv = (b.bundle_version ?? 0) - (a.bundle_version ?? 0)
    if (bv !== 0) return bv
    return String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''))
  })
}
