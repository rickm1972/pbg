import { supabase } from './supabaseClient'
import type { CertificationVerifiedRow, EvidenceSource } from '../types/agent'

export type ProductPageSource = {
  source_type: string
  url: string
  title: string | null
  fetched_at?: string
}

export type VerifiedCertification = {
  cert_name: string
  source_url: string
}

/** Verified certs from approved Agent 1 evidence (bridged from structured_evidence.verified_certifications). */
export async function fetchVerifiedCertifications(
  productId: string,
): Promise<VerifiedCertification[]> {
  const { data, error } = await supabase.rpc('get_verified_certifications', {
    p_product_id: productId,
  })

  if (error) throw error

  const rows = (data ?? []) as CertificationVerifiedRow[]
  if (!Array.isArray(rows)) return []

  return rows
    .filter((row) => row.found_in_page_content === true)
    .filter((row) => typeof row.source_url === 'string' && row.source_url.trim().length > 0)
    .map((row) => ({
      cert_name: row.certification_name.trim(),
      source_url: row.source_url!.trim(),
    }))
    .filter((row) => row.cert_name.length > 0)
}

/** Sources from approved Agent 1 evidence packet (`product_evidence.sources`). */
export async function fetchProductSources(productId: string): Promise<ProductPageSource[]> {
  const { data, error } = await supabase.rpc('get_product_sources', {
    p_product_id: productId,
  })

  if (error) throw error

  const rows = (data ?? []) as EvidenceSource[]
  if (!Array.isArray(rows)) return []

  return rows
    .filter((row) => typeof row.url === 'string' && row.url.trim().length > 0)
    .map((row) => ({
      source_type: String(row.source_type ?? 'other').trim() || 'other',
      url: row.url.trim(),
      title: typeof row.title === 'string' && row.title.trim().length > 0 ? row.title.trim() : null,
      fetched_at: row.fetched_at,
    }))
}
