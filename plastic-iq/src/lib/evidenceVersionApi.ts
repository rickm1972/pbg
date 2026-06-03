import { agent1ApiBase, agent1Secret } from './agent1Review'
import { supabase } from './supabaseClient'
import type { ProductEvidence } from '../types/agent'

export type ProductReviewIdentity = {
  product_id: string
  product_name: string
  brand: string | null
  category: string | null
  subcategory: string | null
  amazon_asin: string | null
  image_url: string | null
  active_evidence_id: string | null
}

export async function fetchProductReviewIdentity(
  productId: string,
): Promise<ProductReviewIdentity | null> {
  const { data, error } = await supabase
    .from('products')
    .select(
      'product_id, product_name, brand, category, subcategory, amazon_asin, image_url, active_evidence_id',
    )
    .eq('product_id', productId)
    .maybeSingle()

  if (error) throw error
  return (data as ProductReviewIdentity | null) ?? null
}

export async function fetchEvidenceVersionsForProduct(
  productId: string,
): Promise<ProductEvidence[]> {
  const { data, error } = await supabase
    .from('product_evidence')
    .select('*')
    .eq('product_id', productId)
    .order('bundle_version', { ascending: false })

  if (error) throw error
  return (data ?? []) as ProductEvidence[]
}

export async function fetchEvidenceById(evidenceId: string): Promise<ProductEvidence | null> {
  const { data, error } = await supabase
    .from('product_evidence')
    .select('*')
    .eq('evidence_id', evidenceId)
    .maybeSingle()

  if (error) throw error
  return (data as ProductEvidence | null) ?? null
}

export async function fetchActiveApprovedEvidence(
  productId: string,
  activeEvidenceId?: string | null,
): Promise<ProductEvidence | null> {
  let resolvedActiveId = activeEvidenceId
  if (!resolvedActiveId) {
    const product = await fetchProductReviewIdentity(productId)
    resolvedActiveId = product?.active_evidence_id ?? null
  }
  if (resolvedActiveId) {
    const row = await fetchEvidenceById(resolvedActiveId)
    if (row?.product_id === productId) return row
  }

  const { data, error } = await supabase
    .from('product_evidence')
    .select('*')
    .eq('product_id', productId)
    .eq('review_status', 'approved')
    .order('bundle_version', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return (data as ProductEvidence | null) ?? null
}

export type SaveEvidenceDraftPayload = {
  evidence_id: string
  structured_evidence: Record<string, unknown>
  field_edit_audit?: Array<{
    path: string
    prior_value: string | null
    new_value: string
    edited_by: string
    edited_at: string
  }>
  edited_by?: string | null
}

export async function saveEvidenceDraftRemote(
  payload: SaveEvidenceDraftPayload,
): Promise<ProductEvidence> {
  const secret = agent1Secret()
  if (!secret) {
    throw new Error('VITE_ADMIN_PASSWORD is not set (required to save evidence draft).')
  }

  const res = await fetch(`${agent1ApiBase()}/save-evidence-draft`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Agent-Secret': secret,
    },
    body: JSON.stringify(payload),
  })

  const body = (await res.json().catch(() => ({}))) as {
    error?: string
    evidence?: ProductEvidence
  }

  if (!res.ok) {
    throw new Error(body.error || `Save draft failed (${res.status})`)
  }

  if (!body.evidence) throw new Error('Save draft returned no evidence row')
  return body.evidence
}
