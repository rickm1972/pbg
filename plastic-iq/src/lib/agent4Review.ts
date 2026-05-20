import { supabase } from './supabaseClient'
import { humanizeAgentStatus } from './agent1Review'
import type {
  Agent4DashboardData,
  ProductPipelineRow,
  ProductQaRow,
  ProductScoreRow,
} from '../types/agent'

export { humanizeAgentStatus }

const PRODUCT_PIPELINE_SELECT =
  'product_id, product_name, brand, category, subcategory, agent_status, score_basis, testing_queue_reason'

const QA_RUN_STATUSES = new Set([
  'scoring_review_pending',
  'scoring_approved',
  'qa_pending',
  'qa_awaiting_review',
])

export function canRunAgent4(status: string): boolean {
  return QA_RUN_STATUSES.has(status)
}

export function agent4ApiBase(): string {
  return import.meta.env.VITE_AGENT4_API_URL || '/api/agent4'
}

function agent4Secret(): string {
  return import.meta.env.VITE_ADMIN_PASSWORD ?? ''
}

export type Agent4RunOutcome = {
  ok: boolean
  message?: string
  overallStatus?: string
}

export type Agent4BatchRunResult = {
  productId: string
  productName: string
  ok: boolean
  message?: string
}

export async function fetchAgent4Dashboard(): Promise<Agent4DashboardData> {
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select(PRODUCT_PIPELINE_SELECT)
    .order('product_name', { ascending: true })

  if (productsError) throw productsError

  const { data: qaRows, error: qaError } = await supabase
    .from('product_qa')
    .select('*')
    .order('run_timestamp', { ascending: false })

  if (qaError) throw qaError

  const { data: scoreRows, error: scoresError } = await supabase
    .from('product_scores')
    .select('*')
    .order('run_timestamp', { ascending: false })

  if (scoresError) throw scoresError

  const rows = (products ?? []) as ProductPipelineRow[]
  const scores = (scoreRows ?? []) as ProductScoreRow[]
  const qas = (qaRows ?? []) as ProductQaRow[]

  const latestApprovedScore = new Map<string, ProductScoreRow>()
  const latestPendingScore = new Map<string, ProductScoreRow>()
  const latestAnyScore = new Map<string, ProductScoreRow>()

  for (const score of scores) {
    if (!latestAnyScore.has(score.product_id)) {
      latestAnyScore.set(score.product_id, score)
    }
    if (score.review_status === 'approved' && !latestApprovedScore.has(score.product_id)) {
      latestApprovedScore.set(score.product_id, score)
    }
    if (score.review_status === 'pending_review' && !latestPendingScore.has(score.product_id)) {
      latestPendingScore.set(score.product_id, score)
    }
  }

  const latestPendingQa = new Map<string, ProductQaRow>()
  const latestApprovedQa = new Map<string, ProductQaRow>()
  const latestAnyQa = new Map<string, ProductQaRow>()

  for (const qa of qas) {
    if (!latestAnyQa.has(qa.product_id)) {
      latestAnyQa.set(qa.product_id, qa)
    }
    if (qa.review_status === 'pending_review' && !latestPendingQa.has(qa.product_id)) {
      latestPendingQa.set(qa.product_id, qa)
    }
    if (qa.review_status === 'approved' && !latestApprovedQa.has(qa.product_id)) {
      latestApprovedQa.set(qa.product_id, qa)
    }
  }

  const scoresByIdMap = new Map(scores.map((s) => [s.score_id, s]))

  const pendingReview: Agent4DashboardData['pendingReview'] = []

  for (const product of rows) {
    if (product.agent_status !== 'qa_awaiting_review') continue
    const qa = latestPendingQa.get(product.product_id)
    if (!qa) continue
    const score =
      scoresByIdMap.get(qa.score_id) ??
      latestApprovedScore.get(product.product_id) ??
      latestAnyScore.get(product.product_id)
    if (!score) continue
    pendingReview.push({ product, qa, score })
  }

  pendingReview.sort((a, b) =>
    a.product.product_name.localeCompare(b.product.product_name),
  )

  const runnable: ProductPipelineRow[] = []

  for (const product of rows) {
    if (!canRunAgent4(product.agent_status)) continue
    const hasScore =
      latestApprovedScore.has(product.product_id) ||
      latestPendingScore.has(product.product_id)
    if (!hasScore) continue
    runnable.push(product)
  }

  runnable.sort((a, b) => a.product_name.localeCompare(b.product_name))

  const withQaHistory: ProductPipelineRow[] = rows.filter((p) => latestAnyQa.has(p.product_id))

  const statusCounts: Record<string, number> = {}
  for (const p of rows) {
    const key = p.agent_status || 'unscored'
    statusCounts[key] = (statusCounts[key] ?? 0) + 1
  }

  const pendingQaByProductId: Record<string, ProductQaRow> = {}
  const approvedQaByProductId: Record<string, ProductQaRow> = {}
  const latestQaByProductId: Record<string, ProductQaRow> = {}
  for (const [id, qa] of latestPendingQa) pendingQaByProductId[id] = qa
  for (const [id, qa] of latestApprovedQa) approvedQaByProductId[id] = qa
  for (const [id, qa] of latestAnyQa) latestQaByProductId[id] = qa

  const approvedScoreByProductId: Record<string, ProductScoreRow> = {}
  for (const [id, score] of latestApprovedScore) approvedScoreByProductId[id] = score

  const scoreById: Record<string, ProductScoreRow> = {}
  for (const score of scores) scoreById[score.score_id] = score

  return {
    products: rows,
    pendingReview,
    runnable,
    withQaHistory,
    pendingQaByProductId,
    approvedQaByProductId,
    latestQaByProductId,
    approvedScoreByProductId,
    scoreById,
    statusCounts,
  }
}

export async function runAgent4Remote(
  productId: string,
  options?: { scoreId?: string; replaceExisting?: boolean },
): Promise<Agent4RunOutcome> {
  const secret = agent4Secret()
  if (!secret) {
    throw new Error('VITE_ADMIN_PASSWORD is not set (required to call Agent 4 API).')
  }

  const res = await fetch(`${agent4ApiBase()}/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Agent-Secret': secret,
    },
    body: JSON.stringify({
      product_id: productId,
      score_id: options?.scoreId,
      replace_existing: options?.replaceExisting ?? true,
    }),
  })

  const body = (await res.json().catch(() => ({}))) as {
    ok?: boolean
    reason?: string
    summary?: string
    error?: string
    overall_status?: string
  }

  if (!res.ok) {
    throw new Error(body.error || body.reason || `Agent 4 failed (${res.status})`)
  }

  if (body.ok === false) {
    return {
      ok: false,
      message: body.reason || body.summary || 'Agent 4 could not run for this product.',
    }
  }

  return {
    ok: true,
    message: body.summary,
    overallStatus: body.overall_status,
  }
}

const BATCH_PAUSE_MS = 300

export async function runAgent4Batch(
  products: Array<{ product_id: string; product_name: string }>,
  onProgress?: (current: number, total: number, productName: string) => void,
): Promise<Agent4BatchRunResult[]> {
  const results: Agent4BatchRunResult[] = []

  for (let i = 0; i < products.length; i++) {
    const p = products[i]
    onProgress?.(i + 1, products.length, p.product_name)

    try {
      const outcome = await runAgent4Remote(p.product_id, { replaceExisting: true })
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
        message: e instanceof Error ? e.message : 'Agent 4 run failed',
      })
    }

    if (i < products.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_PAUSE_MS))
    }
  }

  return results
}

export async function approveProductQa(
  qaId: string,
  productId: string,
  reviewedBy?: string | null,
  reviewNotes?: string | null,
) {
  const now = new Date().toISOString()

  const { error: qaError } = await supabase
    .from('product_qa')
    .update({
      review_status: 'approved',
      review_timestamp: now,
      reviewer: reviewedBy ?? null,
      review_notes: reviewNotes?.trim() || null,
    })
    .eq('qa_id', qaId)

  if (qaError) throw qaError

  const { error: productError } = await supabase
    .from('products')
    .update({ agent_status: 'qa_approved' })
    .eq('product_id', productId)

  if (productError) throw productError
}

export async function rejectProductQa(
  qaId: string,
  productId: string,
  reviewNotes: string,
  reviewedBy?: string | null,
) {
  const now = new Date().toISOString()

  const { error: qaError } = await supabase
    .from('product_qa')
    .update({
      review_status: 'rejected',
      review_timestamp: now,
      reviewer: reviewedBy ?? null,
      review_notes: reviewNotes.trim() || null,
    })
    .eq('qa_id', qaId)

  if (qaError) throw qaError

  const { error: productError } = await supabase
    .from('products')
    .update({ agent_status: 'qa_rejected' })
    .eq('product_id', productId)

  if (productError) throw productError
}
