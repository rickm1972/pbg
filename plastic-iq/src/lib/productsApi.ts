import { supabase } from './supabaseClient'
import {
  normalizeProductRow,
  PRODUCT_SELECT_WITH_SCORE,
  type ProductRowWithScoreDetails,
} from './retailerLinksSidecar'
import {
  applyApprovedPublicScores,
  type ProductRowWithPublicScores,
} from './publicProductScore'
import type { CategoryRow, Product } from '../types'

/** Public site: published only; embed approved scores for listing display (Phase 2A). */
export const PRODUCT_SELECT_PUBLIC =
  '*, score_details ( data_sources ), product_scores ( pac_safety_score, tier, review_status, run_timestamp )' as const

function normalizePublicProductRow(
  row: ProductRowWithScoreDetails & ProductRowWithPublicScores,
): Product {
  return applyApprovedPublicScores(normalizeProductRow(row))
}

function publicProductsQuery() {
  return supabase
    .from('products')
    .select(PRODUCT_SELECT_PUBLIC)
    .eq('active', true)
    .eq('publish_status', 'published')
}

export async function fetchFeaturedProducts(limit = 8): Promise<Product[]> {
  const { data, error } = await publicProductsQuery()
    .order('pac_safety_score', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data as (ProductRowWithScoreDetails & ProductRowWithPublicScores)[]).map(
    normalizePublicProductRow,
  )
}

export async function fetchProductsByCategory(params: {
  category: string
  tier?: string
  scoreBasis?: string
  subcategory?: string
  minScore?: number
  maxScore?: number
}): Promise<Product[]> {
  let q = publicProductsQuery().eq('category', params.category).order('pac_safety_score', {
    ascending: false,
  })

  if (params.tier) q = q.eq('tier', params.tier)
  if (params.scoreBasis) q = q.eq('score_basis', params.scoreBasis)
  if (params.subcategory) q = q.eq('subcategory', params.subcategory)
  if (typeof params.minScore === 'number') q = q.gte('pac_safety_score', params.minScore)
  if (typeof params.maxScore === 'number') q = q.lte('pac_safety_score', params.maxScore)

  // Explicitly set a high limit to avoid any implicit pagination surprises.
  const { data, error } = await q.limit(2000)
  if (error) throw error
  return (data as (ProductRowWithScoreDetails & ProductRowWithPublicScores)[]).map(
    normalizePublicProductRow,
  )
}

export async function fetchAllProducts(limit = 2000): Promise<Product[]> {
  const { data, error } = await publicProductsQuery()
    .order('pac_safety_score', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data as (ProductRowWithScoreDetails & ProductRowWithPublicScores)[]).map(
    normalizePublicProductRow,
  )
}

export async function fetchProduct(productId: string): Promise<Product | null> {
  const { data, error } = await publicProductsQuery()
    .eq('product_id', productId)
    .maybeSingle()
  if (error) throw error
  const row = (data as (ProductRowWithScoreDetails & ProductRowWithPublicScores) | null) ?? null
  return row ? normalizePublicProductRow(row) : null
}

export async function searchProducts(query: string, limit = 20): Promise<Product[]> {
  const q = query.trim()
  if (!q) return []

  const { data, error } = await publicProductsQuery()
    .or(`product_name.ilike.%${q}%,brand.ilike.%${q}%`)
    .order('pac_safety_score', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data as (ProductRowWithScoreDetails & ProductRowWithPublicScores)[]).map(
    normalizePublicProductRow,
  )
}

export async function fetchCategories(): Promise<CategoryRow[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('display_order', { ascending: true })
  if (error) throw error
  return data as CategoryRow[]
}

