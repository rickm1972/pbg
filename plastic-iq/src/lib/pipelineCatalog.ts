/**
 * V2.3.4 materials-science catalog — agent pipeline UIs only surface active products.
 * Archived rows (e.g. formulation / dish soap) stay in DB for history but are hidden here.
 *
 * **Agent 1 Run tab** lists only `unscored` products. Retries and review use other tabs or full reset.
 * **Agents 2–4** are sequential — a product only appears when the prior step is approved.
 */

/** Expected active rows in the pipeline catalog (see migration 0019 + product seed). */
export const PIPELINE_CATALOG_EXPECTED_COUNT = 25

/** Supabase filter: chain after `.from('products')` on pipeline dashboard queries. */
export function onlyActivePipelineProducts<
  T extends { eq: (column: string, value: boolean) => T },
>(query: T): T {
  return query.eq('active', true)
}

export function assertPipelineCatalogProduct(product: {
  product_name?: string
  active?: boolean | null
}): void {
  if (product.active === false) {
    throw new Error(
      `${product.product_name ?? 'Product'} is archived (inactive) and is not in the pipeline catalog.`,
    )
  }
}

const AGENT1_RUN_BLOCKED_STATUSES = new Set([
  'evidence_awaiting_review',
  'evidence_in_progress',
])

/**
 * Agent 1 Run tab — all active catalog products (25) except a run in flight or on Awaiting review.
 * Re-running Agent 1 on qa_approved / scoring_* is intentional (pipeline restart from the top).
 */
export function canRunAgent1FromPipelineStart(agentStatus: string): boolean {
  return !AGENT1_RUN_BLOCKED_STATUSES.has(agentStatus)
}

/** Agent 1-only run — no Agents 2–4 artifacts to clear first. */
export const AGENT1_FRESH_RUN_STATUSES = new Set([
  'unscored',
  'evidence_pending',
  'evidence_rejected',
  'evidence_in_progress',
  'evidence_awaiting_review',
])

/**
 * Re-running Agent 1 from scratch requires wiping scoring/QA when the product has passed Gate 1.
 * Applies to every catalog product (not product-specific).
 */
export function requiresFullPipelineResetBeforeAgent1Run(agentStatus: string): boolean {
  return !AGENT1_FRESH_RUN_STATUSES.has(agentStatus)
}

/** @deprecated alias — only brand-new rows; use canRunAgent1FromPipelineStart for Admin Run tab. */
export function canRunAgent1Sequential(agentStatus: string): boolean {
  if (AGENT1_RUN_BLOCKED_STATUSES.has(agentStatus)) return false
  return (
    agentStatus === 'unscored' ||
    agentStatus === 'evidence_pending' ||
    agentStatus === 'evidence_rejected'
  )
}

export function canRerunAgent1FromReviewSequential(agentStatus: string): boolean {
  return agentStatus === 'evidence_awaiting_review'
}

/** Cookware subcategory batch (6 active catalog products). */
export const PIPELINE_COOKWARE_SUBCATEGORY = 'Cookware'

export function isCookwarePipelineProduct(product: {
  subcategory?: string | null
}): boolean {
  return String(product.subcategory ?? '') === PIPELINE_COOKWARE_SUBCATEGORY
}

/**
 * Agent 2 Run — only products ready for a new normalization pass.
 * Past Agent 2 (`normalization_awaiting_review` / `normalization_approved`) belong on
 * Awaiting review or Agent 3, not Run.
 */
export function canRunAgent2Sequential(agentStatus: string): boolean {
  if (
    agentStatus === 'evidence_awaiting_review' ||
    agentStatus === 'evidence_in_progress'
  ) {
    return false
  }
  return (
    agentStatus === 'evidence_approved' ||
    agentStatus === 'normalization_rejected' ||
    agentStatus === 'normalization_in_progress'
  )
}

export function canRerunAgent2FromReviewSequential(agentStatus: string): boolean {
  return agentStatus === 'normalization_awaiting_review'
}

/** Agent 3 — approved normalization ready to score (not past scoring approval). */
export function canRunAgent3Sequential(agentStatus: string): boolean {
  return (
    agentStatus === 'normalization_approved' ||
    agentStatus === 'scoring_review_pending' ||
    agentStatus === 'scoring_rejected'
  )
}

/**
 * Agent 4 Run — score approved by Agent 3, or QA rejected for re-run.
 * Not qa_awaiting_review (Awaiting review) or qa_approved (pipeline complete).
 */
export function canRunAgent4Sequential(agentStatus: string): boolean {
  return agentStatus === 'scoring_approved' || agentStatus === 'qa_rejected'
}

/** Agent 4 Awaiting review — QA packet submitted, human sign-off pending. */
export function isAgent4OnAwaitingReviewTab(agentStatus: string): boolean {
  return agentStatus === 'qa_awaiting_review'
}
