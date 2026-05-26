import { createServiceClient } from './supabase.mjs'

const PRODUCT_PIPELINE_SELECT =
  'product_id, product_name, brand, category, subcategory, agent_status'

/**
 * Admin dashboard payload (service role — bypasses RLS on product_evidence).
 * @returns {Promise<import('../../src/types/agent.ts').Agent1DashboardData>}
 */
export async function fetchAgent1DashboardData() {
  const supabase = createServiceClient()

  const { data: products, error: productsError } = await supabase
    .from('products')
    .select(PRODUCT_PIPELINE_SELECT)
    .order('product_name', { ascending: true })

  if (productsError) throw productsError

  const { data: evidenceRows, error: evidenceError } = await supabase
    .from('product_evidence')
    .select('*')
    .in('review_status', ['submitted', 'draft'])
    .order('bundle_version', { ascending: false })

  if (evidenceError) throw evidenceError

  const rows = products ?? []
  const byId = new Map(rows.map((p) => [p.product_id, p]))

  const latestSubmitted = new Map()
  const latestDraft = new Map()
  for (const row of evidenceRows ?? []) {
    if (row.review_status === 'submitted' && !latestSubmitted.has(row.product_id)) {
      latestSubmitted.set(row.product_id, row)
    }
    if (row.review_status === 'draft' && !latestDraft.has(row.product_id)) {
      latestDraft.set(row.product_id, row)
    }
  }

  /** @type {import('../../src/types/agent.ts').Agent1DashboardData['pendingReview']} */
  const pendingReview = []
  /** @type {import('../../src/types/agent.ts').Agent1DashboardData['heldRuns']} */
  const heldRuns = []

  for (const product of rows) {
    if (product.agent_status === 'evidence_awaiting_review') {
      const evidence = latestSubmitted.get(product.product_id)
      if (evidence) pendingReview.push({ product, evidence })
    }
    if (product.agent_status === 'evidence_pending') {
      heldRuns.push({
        product,
        evidence: latestDraft.get(product.product_id) ?? null,
      })
    }
  }

  pendingReview.sort((a, b) =>
    a.product.product_name.localeCompare(b.product.product_name),
  )
  heldRuns.sort((a, b) =>
    a.product.product_name.localeCompare(b.product.product_name),
  )

  const statusCounts = {}
  for (const p of rows) {
    const key = p.agent_status || 'unscored'
    statusCounts[key] = (statusCounts[key] ?? 0) + 1
  }

  return { products: rows, pendingReview, validationRunQueue: [], heldRuns, statusCounts }
}
