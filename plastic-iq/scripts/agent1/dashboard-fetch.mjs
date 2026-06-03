import { createServiceClient } from './supabase.mjs'
import { assembleAgent1Dashboard } from '../lib/agent1-dashboard-assemble.mjs'

function onlyActivePipelineProducts(query) {
  return query.eq('active', true)
}

const PRODUCT_PIPELINE_SELECT =
  'product_id, product_name, brand, category, subcategory, agent_status'

/**
 * Service role: all pending_review evidence rows (bypasses RLS).
 */
export async function fetchPendingEvidenceRowsService() {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('product_evidence')
    .select('*')
    .eq('review_status', 'pending_review')
    .order('bundle_version', { ascending: false })

  if (error) throw error
  return data ?? []
}

/**
 * Service role: latest pending_review bundle for one product.
 */
export async function fetchPendingEvidenceForProductService(productId) {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('product_evidence')
    .select('*')
    .eq('product_id', productId)
    .eq('review_status', 'pending_review')
    .order('bundle_version', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data
}

/**
 * Admin dashboard payload (service role — bypasses RLS on product_evidence).
 * @returns {Promise<import('../../src/types/agent.ts').Agent1DashboardData>}
 */
export async function fetchAgent1DashboardData() {
  const supabase = createServiceClient()

  const { data: products, error: productsError } = await onlyActivePipelineProducts(
    supabase.from('products').select(PRODUCT_PIPELINE_SELECT),
  ).order('product_name', { ascending: true })

  if (productsError) throw productsError

  const { data: evidenceRows, error: evidenceError } = await supabase
    .from('product_evidence')
    .select('*')
    .in('review_status', ['pending_review', 'draft'])
    .order('bundle_version', { ascending: false })

  if (evidenceError) throw evidenceError

  return assembleAgent1Dashboard(products ?? [], evidenceRows ?? [])
}
