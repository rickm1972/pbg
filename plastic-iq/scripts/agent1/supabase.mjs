import { createClient } from '@supabase/supabase-js'
import { loadEnv } from '../lib/env.mjs'
import { enrichProductRow } from './retailerLinks.mjs'

export function createServiceClient() {
  const env = loadEnv()
  const url = env.VITE_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      'Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in plastic-iq/.env',
    )
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

const PRODUCT_SELECT = `
  product_id,
  product_name,
  brand,
  category,
  subcategory,
  amazon_url,
  affiliate_link,
  target_url,
  walmart_url,
  other_retailer_label,
  other_retailer_url,
  primary_retailer_evidence_url,
  manufacturer_product_url,
  manufacturer_lab_results_url,
  manufacturer_materials_faq_url,
  agent1_source_notes,
  image_url,
  agent_status,
  score_details ( data_sources )
`

function normalizeProductRow(row) {
  return enrichProductRow(row)
}

export async function fetchProductById(supabase, productId) {
  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_SELECT)
    .eq('product_id', productId)
    .maybeSingle()

  if (error) throw new Error(`Failed to load product: ${error.message}`)
  if (!data) throw new Error(`Product not found: ${productId}`)
  return normalizeProductRow(data)
}

export async function fetchProductByName(supabase, namePattern) {
  const needle = namePattern
    .replace(/%/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .join('%')
  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_SELECT)
    .ilike('product_name', `%${needle}%`)
    .limit(5)

  if (error) throw new Error(`Failed to search products: ${error.message}`)
  if (!data?.length) throw new Error(`No product matching: ${namePattern}`)
  if (data.length > 1) {
    const names = data.map((p) => p.product_name).join('; ')
    throw new Error(`Multiple products match "${namePattern}": ${names}`)
  }
  return normalizeProductRow(data[0])
}

export async function updateAgentStatus(supabase, productId, agentStatus) {
  const { error } = await supabase
    .from('products')
    .update({ agent_status: agentStatus })
    .eq('product_id', productId)

  if (error) throw new Error(`Failed to update agent_status: ${error.message}`)
}

export async function nextBundleVersion(supabase, productId) {
  const { data, error } = await supabase
    .from('product_evidence')
    .select('bundle_version')
    .eq('product_id', productId)
    .order('bundle_version', { ascending: false })
    .limit(1)

  if (error) throw new Error(`Failed to read bundle versions: ${error.message}`)
  const current = data?.[0]?.bundle_version ?? 0
  return current + 1
}

export async function insertEvidence(supabase, row) {
  const { data, error } = await supabase
    .from('product_evidence')
    .insert(row)
    .select()
    .single()

  if (error) throw new Error(`Failed to insert product_evidence: ${error.message}`)
  return data
}
