export type SubcategoryDefaultsStatus = 'complete' | 'unset' | 'role_split'

export type ProductCategoryRow = {
  category_id: string
  name: string
  slug: string
  display_order: number | null
  is_archived: boolean
  archived_at: string | null
  archive_reason: string | null
  created_at: string
  updated_at: string
  /** Populated by admin list queries when available. */
  product_count?: number
}

export type ProductSubcategoryRow = {
  subcategory_id: string
  category_id: string
  name: string
  slug: string
  display_order: number | null
  default_severity: number | null
  default_duration: number | null
  defaults_status: SubcategoryDefaultsStatus
  defaults_source: string | null
  registry_key: string | null
  matrix_key: string | null
  scoring_assumption_ref: string | null
  is_archived: boolean
  archived_at: string | null
  archive_reason: string | null
  created_at: string
  updated_at: string
  /** Populated by admin list queries when available. */
  product_count?: number
}

export type TaxonomySelection = {
  category_id: string | null
  subcategory_id: string | null
  category_name: string | null
  subcategory_name: string | null
  subcategory?: ProductSubcategoryRow | null
}
