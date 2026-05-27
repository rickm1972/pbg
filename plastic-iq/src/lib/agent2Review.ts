import { supabase } from './supabaseClient'
import { humanizeAgentStatus } from './agent1Review'
import type {
  Agent2DashboardData,
  NormalizationInputs,
  ProductPipelineRow,
  ScoringInputRow,
} from '../types/agent'

export { humanizeAgentStatus }

const PRODUCT_PIPELINE_SELECT =
  'product_id, product_name, brand, category, subcategory, agent_status, score_basis, testing_queue_reason'

export async function fetchAgent2Dashboard(): Promise<Agent2DashboardData> {
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select(PRODUCT_PIPELINE_SELECT)
    .order('product_name', { ascending: true })

  if (productsError) throw productsError

  const { data: inputRows, error: inputsError } = await supabase
    .from('scoring_inputs')
    .select('*')
    .order('run_timestamp', { ascending: false })

  if (inputsError) throw inputsError

  const rows = (products ?? []) as ProductPipelineRow[]

  const latestSubmitted = new Map<string, ScoringInputRow>()
  const latestAny = new Map<string, ScoringInputRow>()
  for (const row of inputRows ?? []) {
    const s = row as ScoringInputRow
    const normalized = {
      ...s,
      inputs: s.inputs as NormalizationInputs,
    }
    if (!latestAny.has(s.product_id)) {
      latestAny.set(s.product_id, normalized)
    }
    if (s.review_status === 'submitted' && !latestSubmitted.has(s.product_id)) {
      latestSubmitted.set(s.product_id, normalized)
    }
  }

  const pendingReview: Agent2DashboardData['pendingReview'] = []
  const testingQueue: Agent2DashboardData['testingQueue'] = []
  for (const product of rows) {
    if (product.agent_status === 'normalization_awaiting_review') {
      const scoringInput = latestSubmitted.get(product.product_id)
      if (scoringInput) pendingReview.push({ product, scoringInput })
    }
    if (product.agent_status === 'in_testing_queue') {
      const scoringInput = latestAny.get(product.product_id)
      testingQueue.push({ product, scoringInput: scoringInput ?? null })
    }
  }

  pendingReview.sort((a, b) =>
    a.product.product_name.localeCompare(b.product.product_name),
  )
  testingQueue.sort((a, b) =>
    a.product.product_name.localeCompare(b.product.product_name),
  )

  const statusCounts: Record<string, number> = {}
  for (const p of rows) {
    const key = p.agent_status || 'unscored'
    statusCounts[key] = (statusCounts[key] ?? 0) + 1
  }

  return { products: rows, pendingReview, testingQueue, statusCounts }
}

export async function approveNormalization(
  inputId: string,
  productId: string,
  reviewedBy?: string | null,
  reviewNotes?: string | null,
) {
  const now = new Date().toISOString()
  const { error: inputError } = await supabase
    .from('scoring_inputs')
    .update({
      review_status: 'approved',
      review_timestamp: now,
      human_reviewer: reviewedBy ?? null,
      review_notes: reviewNotes?.trim() || null,
    })
    .eq('input_id', inputId)

  if (inputError) throw inputError

  const { error: productError } = await supabase
    .from('products')
    .update({ agent_status: 'normalization_approved' })
    .eq('product_id', productId)

  if (productError) throw productError
}

export async function rejectNormalization(
  inputId: string,
  productId: string,
  reviewNotes: string,
  reviewedBy?: string | null,
) {
  const now = new Date().toISOString()
  const { error: inputError } = await supabase
    .from('scoring_inputs')
    .update({
      review_status: 'rejected',
      review_timestamp: now,
      review_notes: reviewNotes.trim() || null,
      human_reviewer: reviewedBy ?? null,
    })
    .eq('input_id', inputId)

  if (inputError) throw inputError

  const { error: productError } = await supabase
    .from('products')
    .update({ agent_status: 'normalization_rejected' })
    .eq('product_id', productId)

  if (productError) throw productError
}

export const NORMALIZATION_PIPELINE_STATUSES = [
  'normalization_in_progress',
  'normalization_awaiting_review',
  'normalization_approved',
  'normalization_rejected',
  'in_testing_queue',
] as const

export function agent2ApiBase(): string {
  return import.meta.env.VITE_AGENT2_API_URL || '/api/agent2'
}

function agent2Secret(): string {
  return import.meta.env.VITE_ADMIN_PASSWORD ?? ''
}

/** Lodge + HexClad — materials-science validation duo (V2.3.4). */
export const AGENT2_VALIDATION_RERUN_PRODUCT_IDS: readonly string[] = [
  '1cf2fa4e-5cdd-4798-8f3c-6c273ae69fa8', // Lodge cast iron skillet
  'fd05c5fb-19c2-4bc0-9882-ce73a7644ef5', // HexClad frying pan
] as const

export function isAgent2ValidationRerunProduct(productId: string): boolean {
  return (AGENT2_VALIDATION_RERUN_PRODUCT_IDS as readonly string[]).includes(productId)
}

export function isAgent2OnAwaitingReviewTab(status: string): boolean {
  return status === 'normalization_awaiting_review'
}

/**
 * Normalization awaiting review with a stale bundle — show on Run tab until a successful
 * re-run moves the product to Awaiting review (dashboard tracks via readyForReviewAfterRunIds).
 */
export function isAgent2AwaitingRerunOnRunTab(status: string): boolean {
  return isAgent2OnAwaitingReviewTab(status)
}

/** @deprecated Use isAgent2AwaitingRerunOnRunTab — validation products follow the same rule. */
export function isAgent2ValidationAwaitingRerunOnRunTab(
  status: string,
  _productId: string,
): boolean {
  return isAgent2AwaitingRerunOnRunTab(status)
}

/** Run tab — pipeline states that allow a new normalization run (not awaiting review). */
export function canRunAgent2(status: string, _productId?: string): boolean {
  if (isAgent2OnAwaitingReviewTab(status)) return false
  return (
    status === 'evidence_approved' ||
    status === 'normalization_rejected' ||
    status === 'normalization_in_progress' ||
    status === 'normalization_approved' ||
    status === 'scoring_review_pending' ||
    status === 'scoring_approved'
  )
}

/** Show on Run tab (includes validation awaiting review until post-run override). */
export function showOnAgent2RunTab(
  product: { agent_status: string; product_id: string },
  readyForReviewAfterRunIds: ReadonlySet<string>,
): boolean {
  if (canRunAgent2(product.agent_status, product.product_id)) return true
  if (
    isAgent2AwaitingRerunOnRunTab(product.agent_status) &&
    !readyForReviewAfterRunIds.has(product.product_id)
  ) {
    return true
  }
  return false
}

/** Show on Awaiting review tab (excludes validation still queued for Run-tab re-run). */
export function showOnAgent2ReviewTab(
  product: { agent_status: string; product_id: string },
  readyForReviewAfterRunIds: ReadonlySet<string>,
): boolean {
  if (!isAgent2OnAwaitingReviewTab(product.agent_status)) return false
  if (
    isAgent2AwaitingRerunOnRunTab(product.agent_status) &&
    !readyForReviewAfterRunIds.has(product.product_id)
  ) {
    return false
  }
  return true
}

/** Re-run from review card after a successful run placed the product on Awaiting review. */
export function canRerunAgent2FromReviewCard(
  status: string,
  productId: string,
  readyForReviewAfterRunIds: ReadonlySet<string>,
): boolean {
  return isAgent2OnAwaitingReviewTab(status) && readyForReviewAfterRunIds.has(productId)
}

export async function checkAgent2ServerHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${agent2ApiBase()}/health`, { method: 'GET' })
    if (!res.ok) return false
    const body = (await res.json()) as { ok?: boolean }
    return body.ok === true
  } catch {
    return false
  }
}

export function hasNormalizationRun(status: string): boolean {
  return (
    status === 'normalization_in_progress' ||
    status === 'normalization_awaiting_review' ||
    status === 'normalization_approved' ||
    status === 'normalization_rejected'
  )
}

export type Agent2RunOutcome = {
  ok: boolean
  message?: string
}

export type Agent2BatchRunResult = {
  productId: string
  productName: string
  ok: boolean
  message?: string
}

export async function runAgent2Remote(productId: string): Promise<Agent2RunOutcome> {
  const secret = agent2Secret()
  if (!secret) {
    throw new Error('VITE_ADMIN_PASSWORD is not set (required to call Agent 2 API).')
  }

  const res = await fetch(`${agent2ApiBase()}/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Agent-Secret': secret,
    },
    body: JSON.stringify({ product_id: productId }),
  })

  const body = (await res.json().catch(() => ({}))) as {
    error?: string
    ok?: boolean
    reason?: string
    summary?: string
  }

  if (!res.ok) {
    throw new Error(body.error || body.reason || `Agent 2 failed (${res.status})`)
  }

  if (body.ok === false) {
    return {
      ok: false,
      message: body.reason || body.summary || 'Agent 2 could not run for this product.',
    }
  }

  return { ok: true, message: body.summary }
}

const BATCH_PAUSE_MS = 5000

export async function runAgent2Batch(
  products: Array<{ product_id: string; product_name: string }>,
  onProgress?: (current: number, total: number, productName: string) => void,
): Promise<Agent2BatchRunResult[]> {
  const results: Agent2BatchRunResult[] = []

  for (let i = 0; i < products.length; i++) {
    const p = products[i]
    onProgress?.(i + 1, products.length, p.product_name)

    try {
      const outcome = await runAgent2Remote(p.product_id)
      results.push({
        productId: p.product_id,
        productName: p.product_name,
        ok: outcome.ok,
        message: outcome.message,
      })
    } catch (e) {
      results.push({
        productId: p.product_id,
        productName: p.product_name,
        ok: false,
        message: e instanceof Error ? e.message : 'Agent 2 run failed',
      })
    }

    if (i < products.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_PAUSE_MS))
    }
  }

  return results
}
