import { supabase } from './supabaseClient'
import {
  normalizeProductRow,
  PRODUCT_SELECT_WITH_SCORE,
  type ProductRowWithScoreDetails,
} from './retailerLinksSidecar'
import type { CategoryRow, Product } from '../types'

export async function fetchFeaturedProducts(limit = 8): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_SELECT_WITH_SCORE)
    .eq('active', true)
    .order('pac_safety_score', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data as ProductRowWithScoreDetails[]).map(normalizeProductRow)
}

export async function fetchProductsByCategory(params: {
  category: string
  tier?: string
  scoreBasis?: string
  subcategory?: string
  minScore?: number
  maxScore?: number
}): Promise<Product[]> {
  let q = supabase
    .from('products')
    .select(PRODUCT_SELECT_WITH_SCORE)
    .eq('active', true)
    .eq('category', params.category)
    .order('pac_safety_score', { ascending: false })

  if (params.tier) q = q.eq('tier', params.tier)
  if (params.scoreBasis) q = q.eq('score_basis', params.scoreBasis)
  if (params.subcategory) q = q.eq('subcategory', params.subcategory)
  if (typeof params.minScore === 'number') q = q.gte('pac_safety_score', params.minScore)
  if (typeof params.maxScore === 'number') q = q.lte('pac_safety_score', params.maxScore)

  // Explicitly set a high limit to avoid any implicit pagination surprises.
  const { data, error } = await q.limit(2000)
  if (error) throw error
  return (data as ProductRowWithScoreDetails[]).map(normalizeProductRow)
}

export async function fetchAllProducts(limit = 2000): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_SELECT_WITH_SCORE)
    .eq('active', true)
    .order('pac_safety_score', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data as ProductRowWithScoreDetails[]).map(normalizeProductRow)
}

export async function fetchProduct(productId: string): Promise<Product | null> {
  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_SELECT_WITH_SCORE)
    .eq('product_id', productId)
    .eq('active', true)
    .maybeSingle()
  if (error) throw error
  const row = (data as ProductRowWithScoreDetails | null) ?? null
  return row ? normalizeProductRow(row) : null
}

export async function searchProducts(query: string, limit = 20): Promise<Product[]> {
  const q = query.trim()
  if (!q) return []

  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_SELECT_WITH_SCORE)
    .eq('active', true)
    .or(`product_name.ilike.%${q}%,brand.ilike.%${q}%`)
    .order('pac_safety_score', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data as ProductRowWithScoreDetails[]).map(normalizeProductRow)
}

export async function fetchCategories(): Promise<CategoryRow[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('display_order', { ascending: true })
  if (error) throw error
  return data as CategoryRow[]
}

