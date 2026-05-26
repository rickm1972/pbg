import { supabase } from './supabaseClient'
import { humanizeAgentStatus } from './agent1Review'
import type {
  Agent3DashboardData,
  NormalizationLayer4a,
  ProductPipelineRow,
  ProductScoreRow,
} from '../types/agent'

export { humanizeAgentStatus }

const PRODUCT_PIPELINE_SELECT =
  'product_id, product_name, brand, category, subcategory, agent_status, score_basis, testing_queue_reason'

export async function fetchAgent3Dashboard(): Promise<Agent3DashboardData> {
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select(PRODUCT_PIPELINE_SELECT)
    .order('product_name', { ascending: true })

  if (productsError) throw productsError

  const { data: scoreRows, error: scoresError } = await supabase
    .from('product_scores')
    .select('*')
    .order('run_timestamp', { ascending: false })

  if (scoresError) throw scoresError

  const rows = (products ?? []) as ProductPipelineRow[]
  const latestPending = new Map<string, ProductScoreRow>()
  const latestApproved = new Map<string, ProductScoreRow>()
  const latestAny = new Map<string, ProductScoreRow>()

  for (const row of scoreRows ?? []) {
    const s = row as ProductScoreRow
    if (!latestAny.has(s.product_id)) {
      latestAny.set(s.product_id, s)
    }
    if (s.review_status === 'pending_review' && !latestPending.has(s.product_id)) {
      latestPending.set(s.product_id, s)
    }
    if (s.review_status === 'approved' && !latestApproved.has(s.product_id)) {
      latestApproved.set(s.product_id, s)
    }
  }

  const pendingReview: Agent3DashboardData['pendingReview'] = []
  const runnable: ProductPipelineRow[] = []

  for (const product of rows) {
    if (product.agent_status === 'scoring_review_pending') {
      const productScore = latestPending.get(product.product_id)
      if (productScore) pendingReview.push({ product, productScore })
    }
    if (!canRunAgent3(product.agent_status)) continue
    if (isAgent3ValidationRerunProduct(product.product_id)) {
      runnable.push(product)
      continue
    }
    if (product.agent_status === 'scoring_approved') continue
    if (!latestApproved.has(product.product_id)) {
      runnable.push(product)
    }
  }

  pendingReview.sort((a, b) =>
    a.product.product_name.localeCompare(b.product.product_name),
  )
  runnable.sort((a, b) => a.product_name.localeCompare(b.product_name))

  const statusCounts: Record<string, number> = {}
  for (const p of rows) {
    const key = p.agent_status || 'unscored'
    statusCounts[key] = (statusCounts[key] ?? 0) + 1
  }

  const approvedByProductId: Record<string, ProductScoreRow> = {}
  const latestScoreByProductId: Record<string, ProductScoreRow> = {}
  for (const [id, score] of latestApproved) approvedByProductId[id] = score
  for (const [id, score] of latestAny) latestScoreByProductId[id] = score

  const inputIds = [
    ...new Set(
      (scoreRows ?? [])
        .map((r) => (r as ProductScoreRow).input_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ]

  const layer4aByInputId: Record<string, NormalizationLayer4a | undefined> = {}
  if (inputIds.length > 0) {
    const { data: inputRows, error: inputsError } = await supabase
      .from('scoring_inputs')
      .select('input_id, inputs')
      .in('input_id', inputIds)

    if (inputsError) throw inputsError

    for (const row of inputRows ?? []) {
      const inputs = row.inputs as { layer_4a?: NormalizationLayer4a } | null
      if (row.input_id) {
        layer4aByInputId[row.input_id] = inputs?.layer_4a
      }
    }
  }

  return {
    products: rows,
    pendingReview,
    approvedByProductId,
    latestScoreByProductId,
    layer4aByInputId,
    runnable,
    statusCounts,
  }
}

/** Lodge + HexClad — materials-science validation duo (V2.3.4). */
export const AGENT3_VALIDATION_RERUN_PRODUCT_IDS: readonly string[] = [
  '1cf2fa4e-5cdd-4798-8f3c-6c273ae69fa8', // Lodge cast iron skillet
  'fd05c5fb-19c2-4bc0-9882-ce73a7644ef5', // HexClad frying pan
] as const

export function isAgent3ValidationRerunProduct(productId: string): boolean {
  return AGENT3_VALIDATION_RERUN_PRODUCT_IDS.includes(productId)
}

export function canRunAgent3(status: string): boolean {
  return (
    status === 'normalization_approved' ||
    status === 'scoring_review_pending' ||
    status === 'scoring_approved'
  )
}

export function agent3ApiBase(): string {
  return import.meta.env.VITE_AGENT3_API_URL || '/api/agent3'
}

function agent3Secret(): string {
  return import.meta.env.VITE_ADMIN_PASSWORD ?? ''
}

export type Agent3RunOutcome = {
  ok: boolean
  message?: string
}

export type Agent3BatchRunResult = {
  productId: string
  productName: string
  ok: boolean
  message?: string
}

export async function runAgent3Remote(productId: string): Promise<Agent3RunOutcome> {
  const secret = agent3Secret()
  if (!secret) {
    throw new Error('VITE_ADMIN_PASSWORD is not set (required to call Agent 3 API).')
  }

  const res = await fetch(`${agent3ApiBase()}/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Agent-Secret': secret,
    },
    body: JSON.stringify({ product_id: productId }),
  })

  const body = (await res.json().catch(() => ({}))) as {
    ok?: boolean
    reason?: string
    summary?: string
    error?: string
  }

  if (!res.ok) {
    throw new Error(body.error || body.reason || `Agent 3 failed (${res.status})`)
  }

  if (body.ok === false) {
    return {
      ok: false,
      message: body.reason || body.summary || 'Agent 3 could not run for this product.',
    }
  }

  return { ok: true, message: body.summary }
}

const BATCH_PAUSE_MS = 300

export async function runAgent3Batch(
  products: Array<{ product_id: string; product_name: string }>,
  onProgress?: (current: number, total: number, productName: string) => void,
): Promise<Agent3BatchRunResult[]> {
  const results: Agent3BatchRunResult[] = []

  for (let i = 0; i < products.length; i++) {
    const p = products[i]
    onProgress?.(i + 1, products.length, p.product_name)

    try {
      const outcome = await runAgent3Remote(p.product_id)
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
        message: e instanceof Error ? e.message : 'Agent 3 run failed',
      })
    }

    if (i < products.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_PAUSE_MS))
    }
  }

  return results
}

export async function approveProductScore(
  scoreId: string,
  productId: string,
  score: ProductScoreRow,
  reviewedBy?: string | null,
  reviewNotes?: string | null,
) {
  const now = new Date().toISOString()

  const { error: scoreError } = await supabase
    .from('product_scores')
    .update({
      review_status: 'approved',
      review_timestamp: now,
      reviewer: reviewedBy ?? null,
      review_notes: reviewNotes?.trim() || null,
    })
    .eq('score_id', scoreId)

  if (scoreError) throw scoreError

  const { error: productError } = await supabase
    .from('products')
    .update({
      pac_safety_score: score.pac_safety_score,
      tier: score.tier,
      agent_status: 'scoring_approved',
    })
    .eq('product_id', productId)

  if (productError) throw productError
}

export async function rejectProductScore(
  scoreId: string,
  productId: string,
  reviewNotes: string,
  reviewedBy?: string | null,
) {
  const now = new Date().toISOString()

  const { error: scoreError } = await supabase
    .from('product_scores')
    .update({
      review_status: 'rejected',
      review_timestamp: now,
      reviewer: reviewedBy ?? null,
      review_notes: reviewNotes.trim() || null,
    })
    .eq('score_id', scoreId)

  if (scoreError) throw scoreError

  const { error: productError } = await supabase
    .from('products')
    .update({ agent_status: 'scoring_rejected' })
    .eq('product_id', productId)

  if (productError) throw productError
}
