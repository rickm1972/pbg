import { supabase } from './supabaseClient'
import {
  assembleAgent1Dashboard,
  mergeEvidenceRows,
} from './agent1DashboardAssemble'
import { AGENT1_LODGE_PRODUCT_ID, AGENT1_TFAL_PRODUCT_ID } from './agent1RunTabOnly'
import {
  canRerunAgent1FromReviewSequential,
  canRunAgent1FromPipelineStart,
  onlyActivePipelineProducts,
  PIPELINE_CATALOG_EXPECTED_COUNT,
  requiresFullPipelineResetBeforeAgent1Run,
} from './pipelineCatalog'

export {
  AGENT1_LODGE_PRODUCT_ID,
  AGENT1_TFAL_PRODUCT_ID,
  canAgent1RetestReset,
  mustResetAgent1BeforeRerun,
  showAgent1RetestResetButton,
} from './agent1RunTabOnly'

export { requiresFullPipelineResetBeforeAgent1Run } from './pipelineCatalog'

export { PIPELINE_CATALOG_EXPECTED_COUNT }
import type {
  Agent1DashboardData,
  AgentMetadata,
  EvidenceFact,
  ProductEvidence,
  ProductPipelineRow,
} from '../types/agent'

const PRODUCT_PIPELINE_SELECT =
  'product_id, product_name, brand, category, subcategory, agent_status'

export function agent1ApiBase(): string {
  return import.meta.env.VITE_AGENT1_API_URL || '/api/agent1'
}

export function agent1Secret(): string | undefined {
  return import.meta.env.VITE_ADMIN_PASSWORD as string | undefined
}

/** Dev API: pending_review rows via service role (when browser Supabase cannot read product_evidence). */
export async function fetchPendingEvidenceRowsViaApi(): Promise<ProductEvidence[]> {
  const secret = agent1Secret()
  if (!secret) return []

  const res = await fetch(`${agent1ApiBase()}/pending-evidence`, {
    headers: { 'X-Agent-Secret': secret },
  })
  const body = (await res.json().catch(() => ({}))) as {
    rows?: ProductEvidence[]
    error?: string
  }
  if (!res.ok) return []
  return body.rows ?? []
}

/** Latest pending_review bundle for one product (dev API → service role). */
export async function fetchPendingEvidenceForProductViaApi(
  productId: string,
): Promise<ProductEvidence | null> {
  const secret = agent1Secret()
  if (!secret) return null

  const q = new URLSearchParams({ product_id: productId })
  const res = await fetch(`${agent1ApiBase()}/pending-evidence?${q}`, {
    headers: { 'X-Agent-Secret': secret },
  })
  const body = (await res.json().catch(() => ({}))) as {
    evidence?: ProductEvidence | null
    error?: string
  }
  if (!res.ok) return null
  return body.evidence ?? null
}

export async function fetchLatestPendingEvidenceForProduct(
  productId: string,
): Promise<ProductEvidence | null> {
  const { data, error } = await supabase
    .from('product_evidence')
    .select('*')
    .eq('product_id', productId)
    .eq('review_status', 'pending_review')
    .order('bundle_version', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  const row = (data as ProductEvidence | null) ?? null
  if (row) return row

  return fetchPendingEvidenceForProductViaApi(productId)
}

export async function fetchAgent1Dashboard(): Promise<Agent1DashboardData> {
  const secret = agent1Secret()
  if (secret) {
    try {
      const res = await fetch(`${agent1ApiBase()}/dashboard`, {
        headers: { 'X-Agent-Secret': secret },
      })
      const body = (await res.json().catch(() => ({}))) as Agent1DashboardData & {
        error?: string
      }
      if (res.ok) return body
    } catch {
      // Fall through to Supabase + pending-evidence API merge.
    }
  }

  return fetchAgent1DashboardViaSupabase()
}

async function fetchAgent1DashboardViaSupabase(): Promise<Agent1DashboardData> {
  const { data: products, error: productsError } = await onlyActivePipelineProducts(
    supabase.from('products').select(PRODUCT_PIPELINE_SELECT),
  ).order('product_name', { ascending: true })

  if (productsError) throw productsError

  const rows = (products ?? []) as ProductPipelineRow[]

  const { data: evidenceRows, error: evidenceError } = await supabase
    .from('product_evidence')
    .select('*')
    .in('review_status', ['pending_review', 'draft'])
    .order('bundle_version', { ascending: false })

  if (evidenceError) throw evidenceError

  let merged = (evidenceRows ?? []) as ProductEvidence[]

  const awaitingCount = rows.filter((p) => p.agent_status === 'evidence_awaiting_review').length
  const pendingInMerge = merged.filter((e) => e.review_status === 'pending_review').length

  if (awaitingCount > 0 && (merged.length === 0 || pendingInMerge === 0)) {
    const apiRows = await fetchPendingEvidenceRowsViaApi()
    if (apiRows.length > 0) {
      merged = mergeEvidenceRows(merged, apiRows)
    }
  }

  for (const product of rows) {
    if (product.agent_status !== 'evidence_awaiting_review') continue
    const hasPending = merged.some(
      (e) => e.product_id === product.product_id && e.review_status === 'pending_review',
    )
    if (hasPending) continue
    const row = await fetchLatestPendingEvidenceForProduct(product.product_id)
    if (row) merged = mergeEvidenceRows(merged, [row])
  }

  return assembleAgent1Dashboard(rows, merged)
}

export async function approveEvidence(
  evidenceId: string,
  productId: string,
  reviewedBy?: string | null,
) {
  const { data, error } = await supabase.rpc('approve_product_evidence', {
    p_evidence_id: evidenceId,
    p_reviewed_by: reviewedBy ?? null,
  })

  if (error) throw error

  const row = data as { product_id?: string } | null
  if (row?.product_id && row.product_id !== productId) {
    throw new Error(
      `Evidence ${evidenceId} belongs to product ${row.product_id}, not ${productId}`,
    )
  }
}

export async function rejectEvidence(
  evidenceId: string,
  productId: string,
  reviewerNotes: string,
  reviewedBy?: string | null,
) {
  const now = new Date().toISOString()
  const { error: evidenceError } = await supabase
    .from('product_evidence')
    .update({
      review_status: 'rejected',
      reviewed_at: now,
      reviewer_notes: reviewerNotes.trim() || null,
      reviewed_by: reviewedBy ?? null,
    })
    .eq('evidence_id', evidenceId)

  if (evidenceError) throw evidenceError

  const { error: productError } = await supabase
    .from('products')
    .update({ agent_status: 'evidence_rejected' })
    .eq('product_id', productId)

  if (productError) throw productError
}

export type Agent1ApiUsage = {
  input_tokens?: number
  output_tokens?: number
  web_search_requests?: number
  estimated_cost_usd?: number
  total_estimated_cost_usd?: number
  perplexity_search_requests?: number
  perplexity_estimated_cost_usd?: number
  amazon_anthropic_estimated_cost_usd?: number
  claude_estimated_cost_usd?: number
  cache_read_input_tokens?: number
  cache_creation_input_tokens?: number
  anthropic_api_calls?: number
}

export type Agent1RunOutcome = {
  ok: boolean
  message?: string
  apiUsage?: Agent1ApiUsage
}

export function formatAgent1ApiUsage(usage: Agent1ApiUsage | null | undefined): string | null {
  if (!usage) return null
  const cost =
    usage.estimated_cost_usd != null
      ? `$${usage.estimated_cost_usd.toFixed(3)}`
      : null
  const total = usage.total_estimated_cost_usd ?? usage.estimated_cost_usd
  const parts = [
    usage.perplexity_search_requests != null && usage.perplexity_search_requests > 0
      ? `${usage.perplexity_search_requests} Perplexity search${usage.perplexity_search_requests === 1 ? '' : 'es'}`
      : null,
    usage.amazon_anthropic_estimated_cost_usd != null && usage.amazon_anthropic_estimated_cost_usd > 0
      ? `$${usage.amazon_anthropic_estimated_cost_usd.toFixed(3)} Amazon web_search`
      : null,
    usage.perplexity_estimated_cost_usd != null && usage.perplexity_estimated_cost_usd > 0
      ? `$${usage.perplexity_estimated_cost_usd.toFixed(3)} Perplexity`
      : null,
    usage.anthropic_api_calls != null
      ? `${usage.anthropic_api_calls} Claude call${usage.anthropic_api_calls === 1 ? '' : 's'}`
      : null,
    usage.input_tokens != null ? `${usage.input_tokens.toLocaleString()} in` : null,
    usage.output_tokens != null ? `${usage.output_tokens.toLocaleString()} out` : null,
    usage.web_search_requests != null && usage.web_search_requests > 0
      ? `${usage.web_search_requests} Anthropic web searches`
      : null,
    usage.cache_read_input_tokens != null && usage.cache_read_input_tokens > 0
      ? `${usage.cache_read_input_tokens.toLocaleString()} cache read`
      : null,
    usage.cache_creation_input_tokens != null && usage.cache_creation_input_tokens > 0
      ? `${usage.cache_creation_input_tokens.toLocaleString()} cache write`
      : null,
    total != null ? `$${total.toFixed(3)} total est` : cost != null ? `${cost} est` : null,
  ].filter(Boolean)
  return parts.length > 0 ? parts.join(' · ') : null
}

export type Agent1BatchRunResult = {
  productId: string
  productName: string
  ok: boolean
  message?: string
}

export async function runAgent1Remote(productId: string): Promise<Agent1RunOutcome> {
  const secret = agent1Secret()
  if (!secret) {
    throw new Error('VITE_ADMIN_PASSWORD is not set (required to call Agent 1 API).')
  }

  const res = await fetch(`${agent1ApiBase()}/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Agent-Secret': secret,
    },
    body: JSON.stringify({ product_id: productId }),
  })

  const body = (await res.json().catch(() => ({}))) as {
    error?: string | Array<{ path?: string[]; message?: string }>
    ok?: boolean
    summary?: string
    api_usage?: Agent1ApiUsage
  }

  if (!res.ok) {
    const errDetail =
      typeof body.error === 'string'
        ? body.error
        : Array.isArray(body.error)
          ? body.error
              .slice(0, 3)
              .map((i: { path?: string[]; message?: string }) =>
                `${(i.path ?? []).join('.')}: ${i.message ?? 'invalid'}`,
              )
              .join('; ')
          : `Agent 1 failed (${res.status})`
    throw new Error(errDetail)
  }

  const usageSummary = formatAgent1ApiUsage(body.api_usage)
  const costNote = usageSummary ? ` API usage: ${usageSummary}.` : ''

  if (body.ok === false) {
    return {
      ok: false,
      message:
        (body.summary || 'Minimum threshold not met — saved as draft (testing queue).') +
        costNote,
      apiUsage: body.api_usage,
    }
  }

  return {
    ok: true,
    message: `Agent 1 finished.${costNote} Compare this charge on console.anthropic.com.`,
    apiUsage: body.api_usage,
  }
}

export type Agent1RetestResetOutcome = {
  ok: boolean
  message?: string
  prior_status?: string
  evidence_deleted?: number
}

export async function resetAgent1ForRetestRemote(productId: string): Promise<Agent1RetestResetOutcome> {
  const secret = agent1Secret()
  if (!secret) {
    throw new Error('VITE_ADMIN_PASSWORD is not set (required to call Agent 1 API).')
  }

  const res = await fetch(`${agent1ApiBase()}/reset-for-retest`, {
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
    result?: { prior_status?: string; evidence_deleted?: number; product_name?: string }
  }

  if (!res.ok) {
    throw new Error(typeof body.error === 'string' ? body.error : `Reset failed (${res.status})`)
  }

  const r = body.result
  return {
    ok: true,
    message: `Reset ${r?.product_name ?? 'product'}: deleted ${r?.evidence_deleted ?? 0} evidence bundle(s), status → unscored. Run Agent 1 again from Run tab.`,
    prior_status: r?.prior_status,
    evidence_deleted: r?.evidence_deleted,
  }
}

const BATCH_PAUSE_MS = 5000

export async function runAgent1Batch(
  products: Array<{ product_id: string; product_name: string }>,
  onProgress?: (current: number, total: number, productName: string) => void,
): Promise<Agent1BatchRunResult[]> {
  const results: Agent1BatchRunResult[] = []
  if (products.length === 0) return results

  onProgress?.(0, products.length, products[0].product_name)

  for (let i = 0; i < products.length; i++) {
    const p = products[i]
    onProgress?.(i + 1, products.length, p.product_name)

    try {
      const outcome = await runAgent1Remote(p.product_id)
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
        message: e instanceof Error ? e.message : 'Agent 1 run failed',
      })
    }

    if (i < products.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_PAUSE_MS))
    }
  }

  return results
}

function formatFactValueItem(item: unknown): string {
  if (item == null) return ''
  if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') {
    return String(item)
  }
  if (typeof item === 'object') {
    const row = item as Record<string, unknown>
    if (typeof row.cert_name === 'string') {
      const url = row.source_url ?? row.registry_url ?? row.page_source_url
      return url ? `${row.cert_name} (${url})` : row.cert_name
    }
    if (typeof row.certification_name === 'string') return row.certification_name
  }
  return String(item)
}

export function formatFactValue(value: EvidenceFact['fact_value']): string {
  if (value == null) return '—'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (Array.isArray(value)) {
    return value.map(formatFactValueItem).filter(Boolean).join('; ') || '—'
  }
  if (typeof value === 'object') {
    const formatted = formatFactValueItem(value)
    return formatted || '—'
  }
  if (typeof value === 'string' && value.startsWith('[') && value.endsWith(']')) {
    try {
      const parsed = JSON.parse(value) as unknown
      if (Array.isArray(parsed)) {
        return parsed.map(formatFactValueItem).filter(Boolean).join('; ') || value
      }
    } catch {
      /* use raw */
    }
  }
  return String(value)
}

export function confidenceBadgeClass(confidence: string): string {
  switch (confidence) {
    case 'manufacturer confirmed':
    case 'certification verified':
      return 'bg-emerald-100 text-emerald-900 border-emerald-200'
    case 'retailer confirmed':
    case 'inferred from description':
      return 'bg-amber-100 text-amber-900 border-amber-200'
    case 'inferred from category pattern':
    case 'claim not independently verified':
      return 'bg-orange-100 text-orange-900 border-orange-200'
    case 'proprietary or undisclosed':
    case 'unknown':
      return 'bg-red-100 text-red-900 border-red-200'
    default:
      return 'bg-slate-100 text-slate-800 border-slate-200'
  }
}

export function humanizeAgentStatus(status: string): string {
  return status.replace(/_/g, ' ')
}

export function getEvidenceGaps(facts: EvidenceFact[]): EvidenceFact[] {
  return facts.filter(
    (f) =>
      f.fact_key === 'information_gaps' ||
      f.fact_type === 'gap' ||
      f.fact_key.includes('gap'),
  )
}

export function getDisplayFacts(facts: EvidenceFact[]): EvidenceFact[] {
  const hasStructuredCerts = facts.some(
    (f) => f.fact_key === 'verified_certifications' || f.fact_key === 'claimed_but_not_verified',
  )
  return facts.filter(
    (f) =>
      f.fact_key !== 'information_gaps' &&
      f.fact_type !== 'gap' &&
      !(hasStructuredCerts && f.fact_key === 'certifications_found'),
  )
}

export { getStructuredEvidence, getWarnings } from './evidenceMetadata'

/** Lodge — re-run Agent 1 from Run tab after pipeline moved on. */
export const AGENT1_ADMIN_RERUN_PRODUCT_ID = AGENT1_LODGE_PRODUCT_ID

/** Archived formulation product — excluded from pipeline UIs (migration 0019). */
export const BRANCH_BASICS_PRODUCT_ID = 'a0c72167-f0f6-491e-90f7-bbb622fa5123'

/** Lodge + HexClad + T-Fal — materials-science validation trio (V2.3.4). */
export const AGENT1_VALIDATION_RERUN_PRODUCT_IDS: readonly string[] = [
  AGENT1_ADMIN_RERUN_PRODUCT_ID, // Lodge cast iron skillet
  'fd05c5fb-19c2-4bc0-9882-ce73a7644ef5', // HexClad frying pan
  AGENT1_TFAL_PRODUCT_ID, // T-Fal fry pan set
] as const

export function isAgent1ValidationRerunProduct(productId: string): boolean {
  return (AGENT1_VALIDATION_RERUN_PRODUCT_IDS as readonly string[]).includes(productId)
}

/** Statuses where validation trio may re-run from Run tab when not on Awaiting review. */
export const AGENT1_VALIDATION_RERUN_STATUSES = new Set([
  'evidence_approved',
  'normalization_rejected',
  'normalization_in_progress',
  'normalization_approved',
  'normalization_awaiting_review',
  'scoring_review_pending',
  'scoring_approved',
])

/**
 * Lodge + 4 May-15 batch products (cookware, bottle, dish soap, concentrate) — prompt-cache test batch.
 */
export const CACHE_TEST_AGENT1_BATCH_PRODUCT_IDS: readonly string[] = [
  AGENT1_ADMIN_RERUN_PRODUCT_ID, // Lodge cast iron
  'c645ae86-0b82-429d-8f46-78b8007041b5', // All-Clad G5 skillet
  '86c204f4-3af4-4b5b-936d-4c6b7bf27928', // Hydro Flask bottle
  '1c010355-10d7-44d8-a81c-2c562d70e34c', // Dawn dish soap
] as const

export function isCacheTestAgent1BatchProduct(productId: string): boolean {
  return CACHE_TEST_AGENT1_BATCH_PRODUCT_IDS.includes(productId)
}

/** Next 10 catalog products by name (after cache-test 5): Bentgo → Joseph Joseph. */
export const ALPHABET_NEXT_AGENT1_BATCH_PRODUCT_IDS: readonly string[] = [
  '5df5a5a1-9dc7-4a8f-948c-c4a9971fa510', // Bentgo Glass Containers
  '656eb9ab-ea52-4eca-bd44-4903d6b2d00e', // Berglander utensil set
  '6ea5a0ad-8ab5-46bd-9d54-c1fab8f7f207', // BlenderBottle Strada
  '62221395-e857-4bd7-915d-338a130ff242', // Blueland dish soap
  '0b519209-5a17-41fc-846c-321ad46753f0', // CamelBak Chute Mag
  'e451b158-6094-44f9-9628-a2a25974482e', // Caraway frying pan
  '9f60346a-5120-4f22-89fc-8ed125126bbe', // Glasslock containers
  '860b2128-015b-4d8d-8710-7ad7751ec7c5', // GreenPan skillet
  'fd05c5fb-19c2-4bc0-9882-ce73a7644ef5', // HexClad frying pan
  'b761e653-7e63-4d5c-848d-e736698aa038', // Joseph Joseph utensils
] as const

export function isAlphabetNextAgent1BatchProduct(productId: string): boolean {
  return ALPHABET_NEXT_AGENT1_BATCH_PRODUCT_IDS.includes(productId)
}

/** May 15 Agent 1 batch (27 products) — same re-run rules as Lodge on the Run tab. */
export const FRIDAY_AGENT1_BATCH_PRODUCT_IDS: readonly string[] = [
  '86c204f4-3af4-4b5b-936d-4c6b7bf27928',
  'e451b158-6094-44f9-9628-a2a25974482e',
  'c645ae86-0b82-429d-8f46-78b8007041b5',
  '1c010355-10d7-44d8-a81c-2c562d70e34c',
  '5df5a5a1-9dc7-4a8f-948c-c4a9971fa510',
  '656eb9ab-ea52-4eca-bd44-4903d6b2d00e',
  'a0c72167-f0f6-491e-90f7-bbb622fa5123',
  '9f60346a-5120-4f22-89fc-8ed125126bbe',
  '860b2128-015b-4d8d-8710-7ad7751ec7c5',
  'b761e653-7e63-4d5c-848d-e736698aa038',
  '185a8eb5-b49a-45c6-a44e-349c0a22cc0c',
  '6278069c-e1af-4385-9fd8-4c8fbd01492f',
  'da4138bd-ca79-4f8e-8a43-0f4b7a9a9295',
  'b97fc347-fb49-47fa-992b-9c4aaa1ec55b',
  '927bfa87-fc97-4142-a3a9-d1c095d484ca',
  '8ffa989c-697f-4378-89c0-e2dc512ca582',
  '31e65e8e-38f6-4a7a-9eff-63a11eb09700',
  '0b519209-5a17-41fc-846c-321ad46753f0',
  '6ea5a0ad-8ab5-46bd-9d54-c1fab8f7f207',
  '6121b5f4-d5d0-46a5-93b2-397ac0e74963',
  'b0ec75a3-686e-4f90-9577-4d0a325b88ef',
  'abd6e6c1-d6d7-4bcb-a61e-46255e8a0f12',
  '988d44f7-2bf3-4c3e-a82f-62f75f07a7d0',
  '4f96929a-d8b5-4d74-b069-66d3d2de3cd8',
  '7a457a86-ab62-4cbf-90b9-ccaeafe06896',
  'fb0e8291-7324-4ebd-84b9-87b6079f74b2',
  '62221395-e857-4bd7-915d-338a130ff242',
] as const

export function isFridayAgent1BatchProduct(productId: string): boolean {
  return FRIDAY_AGENT1_BATCH_PRODUCT_IDS.includes(productId)
}

export function canAdminRerunAgent1(productId: string): boolean {
  return (
    productId === AGENT1_ADMIN_RERUN_PRODUCT_ID ||
    isFridayAgent1BatchProduct(productId) ||
    isAlphabetNextAgent1BatchProduct(productId)
  )
}

/**
 * Agent 1 tab routing (do not special-case products):
 * - Successful Agent 1 run → Awaiting review (all products, including T-Fal).
 */
export function isAgent1OnAwaitingReviewTab(status: string): boolean {
  return status === 'evidence_awaiting_review'
}

/** All active catalog on Run except evidence awaiting review / in progress. */
export function canRunAgent1(status: string, _productId?: string): boolean {
  return canRunAgent1FromPipelineStart(status)
}

/** Statuses on Run Agent 1 — new runs and failed runs (not awaiting review; reset there first). */
export const AGENT1_RUN_TAB_STATUSES = new Set([
  'unscored',
  'evidence_pending',
  'evidence_in_progress',
  'evidence_rejected',
])

/** Pill label on Run tab — failed queue rows read as unscored. */
export function agent1RunTabDisplayStatus(agentStatus: string): string {
  if (
    agentStatus === 'evidence_pending' ||
    agentStatus === 'evidence_in_progress' ||
    agentStatus === 'evidence_rejected'
  ) {
    return 'unscored'
  }
  return agentStatus
}

/** Run Agent 1 tab — new runs, failed runs, and Gate 1 re-runs (clears prior evidence first). */
export function canShowOnAgent1RunTab(product: {
  agent_status: string
  product_id: string
}): boolean {
  if (
    isAgent1ValidationRerunProduct(product.product_id) &&
    product.agent_status === 'evidence_awaiting_review'
  ) {
    return true
  }
  if (
    isAgent1ValidationRerunProduct(product.product_id) &&
    AGENT1_VALIDATION_RERUN_STATUSES.has(product.agent_status)
  ) {
    return true
  }
  return AGENT1_RUN_TAB_STATUSES.has(product.agent_status)
}

/**
 * Re-run from Gate 1 review card. Validation trio (Lodge / HexClad / T-Fal) use the same
 * awaiting-review re-run path — they were previously blocked with no Run-tab escape hatch.
 */
export function canRerunAgent1FromReviewCard(status: string, productId: string): boolean {
  return canRerunAgent1FromReviewSequential(status)
}

/** Run Agent 1 tab only (includes validation trio while awaiting review). */
export function canRerunAgent1ForProduct(status: string, productId: string): boolean {
  return canShowOnAgent1RunTab({ agent_status: status, product_id: productId })
}

export function isAgent1Rerun(status: string): boolean {
  return status !== 'unscored'
}
