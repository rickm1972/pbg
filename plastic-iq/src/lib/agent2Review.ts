import { supabase } from './supabaseClient'
import { humanizeAgentStatus } from './agent1Review'
import {
  canRunAgent2Sequential,
  isCookwarePipelineProduct,
  onlyActivePipelineProducts,
  PIPELINE_COOKWARE_SUBCATEGORY,
} from './pipelineCatalog'

export { isCookwarePipelineProduct, PIPELINE_COOKWARE_SUBCATEGORY }
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
  const { data: products, error: productsError } = await onlyActivePipelineProducts(
    supabase.from('products').select(PRODUCT_PIPELINE_SELECT),
  ).order('product_name', { ascending: true })

  if (productsError) throw productsError

  const { data: inputRows, error: inputsError } = await supabase
    .from('scoring_inputs')
    .select('*')
    .order('run_timestamp', { ascending: false })

  if (inputsError) throw inputsError

  const rows = (products ?? []) as ProductPipelineRow[]

  const latestPendingNormalization = new Map<string, ScoringInputRow>()
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
    if (s.review_status === 'pending_review' && !latestPendingNormalization.has(s.product_id)) {
      latestPendingNormalization.set(s.product_id, normalized)
    }
  }

  const pendingReview: Agent2DashboardData['pendingReview'] = []
  const testingQueue: Agent2DashboardData['testingQueue'] = []
  for (const product of rows) {
    if (product.agent_status === 'normalization_awaiting_review') {
      const scoringInput = latestPendingNormalization.get(product.product_id)
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

  const latestScoringByProductId: Record<string, ScoringInputRow> = {}
  for (const [productId, row] of latestAny) {
    latestScoringByProductId[productId] = row
  }

  return { products: rows, pendingReview, testingQueue, statusCounts, latestScoringByProductId }
}

export async function approveNormalization(
  inputId: string,
  productId: string,
  reviewedBy?: string | null,
  reviewNotes?: string | null,
) {
  const { data, error } = await supabase.rpc('approve_scoring_inputs', {
    p_input_id: inputId,
    p_reviewed_by: reviewedBy ?? null,
    p_review_notes: reviewNotes?.trim() || null,
  })

  if (error) throw error

  const row = data as { product_id?: string } | null
  if (row?.product_id && row.product_id !== productId) {
    throw new Error(
      `scoring_inputs ${inputId} belongs to product ${row.product_id}, not ${productId}`,
    )
  }
}

export async function rejectNormalization(
  inputId: string,
  productId: string,
  reviewNotes: string,
  reviewedBy?: string | null,
) {
  const { data, error } = await supabase.rpc('reject_scoring_inputs', {
    p_input_id: inputId,
    p_review_notes: reviewNotes.trim() || null,
    p_reviewed_by: reviewedBy ?? null,
  })

  if (error) throw error

  const row = data as { product_id?: string } | null
  if (row?.product_id && row.product_id !== productId) {
    throw new Error(
      `scoring_inputs ${inputId} belongs to product ${row.product_id}, not ${productId}`,
    )
  }
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

/** Must match scripts/agent2/deterministic/product-description-generate.mjs */
export const EXPECTED_AGENT2_DESCRIPTION_GENERATOR_VERSION =
  '2026-06-01-hazard-sort-acronym'

function agent2Secret(): string {
  return import.meta.env.VITE_ADMIN_PASSWORD ?? ''
}

/** Lodge + HexClad + T-Fal — materials-science validation trio (V2.3.4). */
export const AGENT2_VALIDATION_RERUN_PRODUCT_IDS: readonly string[] = [
  '1cf2fa4e-5cdd-4798-8f3c-6c273ae69fa8', // Lodge cast iron skillet
  'fd05c5fb-19c2-4bc0-9882-ce73a7644ef5', // HexClad frying pan
  '7a457a86-ab62-4cbf-90b9-ccaeafe06896', // T-Fal fry pan set
] as const

export function isAgent2ValidationRerunProduct(productId: string): boolean {
  return (AGENT2_VALIDATION_RERUN_PRODUCT_IDS as readonly string[]).includes(productId)
}

/** Lodge / HexClad / T-Fal — re-run Agent 2 from Run tab or Awaiting review (same idea as Agent 1 validation). */
const AGENT2_VALIDATION_RERUN_STATUSES = new Set([
  'evidence_approved',
  'normalization_rejected',
  'normalization_in_progress',
  'normalization_awaiting_review',
  'normalization_approved',
  'scoring_review_pending',
  'scoring_approved',
])

/** Status set after a successful Agent 2 run — human approval still required. */
export function isAgent2AwaitingHumanReview(status: string): boolean {
  return status === 'normalization_awaiting_review'
}

/** Awaiting review tab — submitted normalization packet ready to approve. */
export function isAgent2OnAwaitingReviewTab(
  status: string,
  scoringInput?: Pick<ScoringInputRow, 'review_status'> | null,
): boolean {
  return isAgent2AwaitingHumanReview(status) && scoringInput?.review_status === 'pending_review'
}

/** Failed Agent 2 run left status on awaiting review but saved a draft packet. */
export function isAgent2FailedDraftStuck(
  agentStatus: string,
  scoringInput?: Pick<ScoringInputRow, 'review_status'> | null,
): boolean {
  return agentStatus === 'normalization_awaiting_review' && scoringInput?.review_status === 'draft'
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

/** Run tab — evidence approved only (same rule for every catalog product). */
export function canRunAgent2(status: string, _productId?: string): boolean {
  return canRunAgent2Sequential(status)
}

/** Show on Run tab — ready for Agent 2 or stuck after a failed draft run. */
export function showOnAgent2RunTab(
  product: { agent_status: string; product_id: string },
  _readyForReviewAfterRunIds: ReadonlySet<string>,
  latestScoring?: Pick<ScoringInputRow, 'review_status'> | null,
): boolean {
  if (product.agent_status === 'normalization_in_progress') return true
  return (
    canRunAgent2Sequential(product.agent_status) ||
    isAgent2FailedDraftStuck(product.agent_status, latestScoring)
  )
}

/** Show on Awaiting review tab — submitted packet ready for human approval. */
export function showOnAgent2ReviewTab(
  product: { agent_status: string; product_id: string },
  _readyForReviewAfterRunIds: ReadonlySet<string>,
  latestScoring?: Pick<ScoringInputRow, 'review_status'> | null,
): boolean {
  return isAgent2OnAwaitingReviewTab(product.agent_status, latestScoring)
}

/** Re-run from Awaiting review card while normalization is still awaiting review. */
export function canRerunAgent2FromReviewCard(
  status: string,
  _productId: string,
  _readyForReviewAfterRunIds: ReadonlySet<string>,
): boolean {
  return isAgent2AwaitingHumanReview(status)
}

export type Agent2ServerHealth = {
  ok: boolean
  description_generator_version?: string | null
}

export async function checkAgent2ServerHealth(): Promise<Agent2ServerHealth> {
  try {
    const res = await fetch(`${agent2ApiBase()}/health`, { method: 'GET' })
    if (!res.ok) return { ok: false }
    const body = (await res.json()) as {
      ok?: boolean
      description_generator_version?: string
    }
    return {
      ok: body.ok === true,
      description_generator_version: body.description_generator_version ?? null,
    }
  } catch {
    return { ok: false }
  }
}

export function isAgent2DescriptionGeneratorCurrent(version: string | null | undefined): boolean {
  return version === EXPECTED_AGENT2_DESCRIPTION_GENERATOR_VERSION
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
  description_generator_version?: string | null
  product_description_preview?: string | null
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
    description_generator_version?: string | null
    product_description_preview?: string | null
  }

  if (!res.ok) {
    const detail = body.error || body.reason || `HTTP ${res.status}`
    throw new Error(
      res.status >= 500
        ? `Agent 2 server error: ${detail}. Restart npm run dev on port 5173 and try again.`
        : detail,
    )
  }

  if (body.ok === false) {
    return {
      ok: false,
      message: body.reason || body.summary || 'Agent 2 could not run for this product.',
      description_generator_version: body.description_generator_version,
      product_description_preview: body.product_description_preview,
    }
  }

  const genVersion = body.description_generator_version ?? null
  let message = body.summary ?? 'Agent 2 finished. Open Awaiting review to approve.'
  if (!isAgent2DescriptionGeneratorCurrent(genVersion)) {
    message += ` Warning: description generator ${genVersion ?? 'missing'} (expected ${EXPECTED_AGENT2_DESCRIPTION_GENERATOR_VERSION}). Restart Vite on port 5173 if product copy looks wrong.`
  }

  return {
    ok: true,
    message,
    description_generator_version: genVersion,
    product_description_preview: body.product_description_preview,
  }
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
