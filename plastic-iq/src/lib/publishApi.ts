import { supabase } from './supabaseClient'
import type { PublishStatus } from '../types/agent'

export type PublishChainCheck = {
  canPublish: boolean
  missingGates: string[]
}

export type PublishProductRow = {
  product_id: string
  product_name: string
  brand: string | null
  publish_status: PublishStatus | string
  published_at: string | null
  active_evidence_id: string | null
}

export async function fetchPublishStatusCounts(): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('products')
    .select('publish_status')
    .eq('active', true)

  if (error) throw error
  const counts: Record<string, number> = {}
  for (const row of data ?? []) {
    const key = String(row.publish_status ?? 'draft')
    counts[key] = (counts[key] ?? 0) + 1
  }
  return counts
}

export async function fetchReadyToPublishProducts(): Promise<PublishProductRow[]> {
  const { data, error } = await supabase
    .from('products')
    .select('product_id, product_name, brand, publish_status, published_at, active_evidence_id')
    .eq('active', true)
    .eq('publish_status', 'ready_to_publish')
    .order('product_name', { ascending: true })

  if (error) throw error
  return (data ?? []) as PublishProductRow[]
}

export async function fetchProductPublishRow(productId: string): Promise<PublishProductRow | null> {
  const { data, error } = await supabase
    .from('products')
    .select('product_id, product_name, brand, publish_status, published_at, active_evidence_id')
    .eq('product_id', productId)
    .maybeSingle()

  if (error) throw error
  return (data as PublishProductRow | null) ?? null
}

/** Client-side publish chain check (mirrors validate_publish_chain). */
export async function checkPublishChain(productId: string): Promise<PublishChainCheck> {
  const missing: string[] = []

  const { data: product, error: productError } = await supabase
    .from('products')
    .select('active_evidence_id, publish_status')
    .eq('product_id', productId)
    .maybeSingle()

  if (productError) throw productError
  if (!product) {
    return { canPublish: false, missingGates: ['Product not found'] }
  }

  const activeEvidenceId = product.active_evidence_id as string | null
  if (!activeEvidenceId) {
    missing.push('Gate 1: approved evidence (active_evidence_id)')
  } else {
    const { data: evidence } = await supabase
      .from('product_evidence')
      .select('review_status')
      .eq('evidence_id', activeEvidenceId)
      .maybeSingle()
    if (!evidence || evidence.review_status !== 'approved') {
      missing.push('Gate 1: active evidence must be approved')
    }
  }

  const { data: approvedInput } = await supabase
    .from('scoring_inputs')
    .select('input_id, evidence_id')
    .eq('product_id', productId)
    .eq('review_status', 'approved')
    .order('run_timestamp', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!approvedInput) {
    missing.push('Gate 2: approved normalization (scoring_inputs)')
  } else if (
    activeEvidenceId &&
    approvedInput.evidence_id &&
    approvedInput.evidence_id !== activeEvidenceId
  ) {
    missing.push('Gate 2: approved normalization must reference active evidence')
  }

  const { data: approvedScore } = await supabase
    .from('product_scores')
    .select('score_id, input_id')
    .eq('product_id', productId)
    .eq('review_status', 'approved')
    .order('run_timestamp', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!approvedScore) {
    missing.push('Gate 3: approved score (product_scores)')
  } else if (
    approvedInput?.input_id &&
    approvedScore.input_id &&
    approvedScore.input_id !== approvedInput.input_id
  ) {
    missing.push('Gate 3: approved score must reference approved normalization')
  }

  return { canPublish: missing.length === 0, missingGates: missing }
}

function publishSnapshotApiBase(): string {
  return import.meta.env.VITE_PUBLISH_SNAPSHOT_API_URL || '/api/publish-with-snapshot'
}

function publishSnapshotAdminSecret(): string {
  const secret = import.meta.env.VITE_ADMIN_PASSWORD as string | undefined
  if (!secret) {
    throw new Error('VITE_ADMIN_PASSWORD is not set — restart npm run dev after updating .env')
  }
  return secret
}

/** Gate 4 publish — freezes display snapshot first; fails if snapshot creation fails. */
export async function publishProduct(productId: string): Promise<void> {
  const res = await fetch(publishSnapshotApiBase(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Agent-Secret': publishSnapshotAdminSecret(),
    },
    body: JSON.stringify({ product_id: productId }),
  })
  const body = (await res.json().catch(() => ({}))) as { error?: string }
  if (!res.ok) {
    throw new Error(body.error ?? `Publish failed (${res.status})`)
  }
}

export async function unpublishProduct(productId: string): Promise<void> {
  const { error } = await supabase.rpc('set_product_unpublished', {
    p_product_id: productId,
  })
  if (error) throw error
}

export type BatchPublishResult = {
  productId: string
  productName: string
  ok: boolean
  error?: string
}

export async function batchPublishProducts(
  products: Array<{ product_id: string; product_name: string }>,
): Promise<BatchPublishResult[]> {
  const results: BatchPublishResult[] = []
  for (const p of products) {
    try {
      await publishProduct(p.product_id)
      results.push({ productId: p.product_id, productName: p.product_name, ok: true })
    } catch (e: unknown) {
      results.push({
        productId: p.product_id,
        productName: p.product_name,
        ok: false,
        error: e instanceof Error ? e.message : 'Publish failed',
      })
    }
  }
  return results
}
