import { formatSupabaseUnknownError, supabase } from '../supabaseClient'
import type { ProductCategoryRow, ProductSubcategoryRow } from './types'

export type LoadTaxonomyOptions = {
  includeArchived?: boolean
}

export async function loadManagedCategories(
  options: LoadTaxonomyOptions = {},
): Promise<ProductCategoryRow[]> {
  let q = supabase
    .from('product_categories')
    .select('*')
    .order('display_order', { ascending: true })
    .order('name', { ascending: true })

  if (!options.includeArchived) {
    q = q.eq('is_archived', false)
  }

  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as ProductCategoryRow[]
}

export async function loadManagedSubcategories(
  options: LoadTaxonomyOptions & { categoryId?: string } = {},
): Promise<ProductSubcategoryRow[]> {
  let q = supabase
    .from('product_subcategories')
    .select('*')
    .order('display_order', { ascending: true })
    .order('name', { ascending: true })

  if (!options.includeArchived) {
    q = q.eq('is_archived', false)
  }
  if (options.categoryId) {
    q = q.eq('category_id', options.categoryId)
  }

  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as ProductSubcategoryRow[]
}

export async function loadTaxonomyWithCounts(
  options: LoadTaxonomyOptions = {},
): Promise<{
  categories: ProductCategoryRow[]
  subcategories: ProductSubcategoryRow[]
}> {
  const [categories, subcategories, productRows] = await Promise.all([
    loadManagedCategories(options),
    loadManagedSubcategories(options),
    supabase.from('products').select('category_id, subcategory_id'),
  ])

  if (productRows.error) throw productRows.error

  const categoryCounts = new Map<string, number>()
  const subcategoryCounts = new Map<string, number>()
  for (const row of productRows.data ?? []) {
    const cid = row.category_id as string | null
    const sid = row.subcategory_id as string | null
    if (cid) categoryCounts.set(cid, (categoryCounts.get(cid) ?? 0) + 1)
    if (sid) subcategoryCounts.set(sid, (subcategoryCounts.get(sid) ?? 0) + 1)
  }

  return {
    categories: categories.map((c) => ({
      ...c,
      product_count: categoryCounts.get(c.category_id) ?? 0,
    })),
    subcategories: subcategories.map((s) => ({
      ...s,
      product_count: subcategoryCounts.get(s.subcategory_id) ?? 0,
    })),
  }
}

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export async function createManagedCategory(name: string, displayOrder: number | null = null) {
  const payload = {
    name: name.trim(),
    slug: slugify(name),
    display_order: displayOrder,
    is_archived: false,
  }
  const { data, error } = await supabase
    .from('product_categories')
    .insert(payload)
    .select('*')
    .single()
  if (error) throw error
  return data as ProductCategoryRow
}

export async function updateManagedCategory(
  categoryId: string,
  patch: Partial<Pick<ProductCategoryRow, 'name' | 'display_order'>>,
) {
  const payload: Record<string, unknown> = { ...patch }
  if (patch.name) payload.slug = slugify(patch.name)
  const { data, error } = await supabase
    .from('product_categories')
    .update(payload)
    .eq('category_id', categoryId)
    .select('*')
    .single()
  if (error) throw error
  return data as ProductCategoryRow
}

export async function archiveManagedCategory(categoryId: string, reason: string | null = null) {
  const { data, error } = await supabase
    .from('product_categories')
    .update({
      is_archived: true,
      archived_at: new Date().toISOString(),
      archive_reason: reason,
    })
    .eq('category_id', categoryId)
    .select('*')
    .single()
  if (error) throw error
  return data as ProductCategoryRow
}

export async function createManagedSubcategory(input: {
  category_id: string
  name: string
  display_order?: number | null
  default_severity?: number | null
  default_duration?: number | null
  defaults_status: ProductSubcategoryRow['defaults_status']
  defaults_source?: string | null
  registry_key?: string | null
  matrix_key?: string | null
  scoring_assumption_ref?: string | null
}) {
  const payload = {
    ...input,
    name: input.name.trim(),
    slug: slugify(input.name),
    display_order: input.display_order ?? null,
    is_archived: false,
  }
  const { data, error } = await supabase
    .from('product_subcategories')
    .insert(payload)
    .select('*')
    .single()
  if (error) throw error
  return data as ProductSubcategoryRow
}

export async function updateManagedSubcategory(
  subcategoryId: string,
  patch: Partial<
    Pick<
      ProductSubcategoryRow,
      | 'name'
      | 'display_order'
      | 'default_severity'
      | 'default_duration'
      | 'defaults_status'
      | 'defaults_source'
      | 'registry_key'
      | 'matrix_key'
      | 'scoring_assumption_ref'
    >
  >,
) {
  const payload: Record<string, unknown> = { ...patch }
  if (patch.name) payload.slug = slugify(patch.name)
  const { data, error } = await supabase
    .from('product_subcategories')
    .update(payload)
    .eq('subcategory_id', subcategoryId)
    .select('*')
    .single()
  if (error) throw error
  return data as ProductSubcategoryRow
}

export async function archiveManagedSubcategory(
  subcategoryId: string,
  reason: string | null = null,
) {
  const { data, error } = await supabase
    .from('product_subcategories')
    .update({
      is_archived: true,
      archived_at: new Date().toISOString(),
      archive_reason: reason,
    })
    .eq('subcategory_id', subcategoryId)
    .select('*')
    .single()
  if (error) throw error
  return data as ProductSubcategoryRow
}

export function taxonomyStoreErrorMessage(error: unknown, fallback: string): string {
  return formatSupabaseUnknownError(error, fallback)
}
