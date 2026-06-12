import type { Product } from '../types'

export type AdminProductSavePayloadMode = 'full' | 'no_other' | 'no_retailer_urls'

/** Pipeline / Gate-owned — shown read-only; never written by admin save. */
export const ADMIN_PIPELINE_READONLY_FIELD_KEYS = [
  'pac_safety_score',
  'tier',
  'score_basis',
  'primary_material',
  'secondary_material',
] as const

export type AdminPipelineReadonlyFieldKey = (typeof ADMIN_PIPELINE_READONLY_FIELD_KEYS)[number]

export const ADMIN_PIPELINE_READONLY_FIELDS: ReadonlyArray<{
  key: AdminPipelineReadonlyFieldKey
  label: string
  hint: string
}> = [
  {
    key: 'pac_safety_score',
    label: 'PAC Safety Score',
    hint: 'Gate 3 approved score truth. Rerun and approve Agent 3 to change — not editable here.',
  },
  {
    key: 'tier',
    label: 'Tier',
    hint: 'Gate 3 approved tier. Rerun and approve Agent 3 to change — not editable here.',
  },
  {
    key: 'score_basis',
    label: 'Score basis',
    hint: 'Legacy pipeline field still used for category browse filters. Set by the scoring pipeline — not editable here.',
  },
  {
    key: 'primary_material',
    label: 'Primary material',
    hint: 'Legacy products-row reference. Public detail pages use Gate 2 / APR display truth instead.',
  },
  {
    key: 'secondary_material',
    label: 'Secondary material',
    hint: 'Legacy products-row reference. Public detail pages use Gate 2 / APR display truth instead.',
  },
]

export const ADMIN_EDITABLE_PRODUCT_FIELD_KEYS = [
  'product_name',
  'brand',
  'category',
  'subcategory',
  'description',
  'bpa_free',
  'phthalate_free_claim',
  'amazon_url',
  'affiliate_link',
  'manufacturer_product_url',
  'image_url',
  'active',
] as const

function formatReadOnlyScalar(value: unknown): string {
  if (value == null || value === '') return '—'
  return String(value)
}

export function formatAdminReadOnlyFieldValue(
  key: AdminPipelineReadonlyFieldKey,
  product: Product,
): string {
  const value = product[key]
  if (key === 'pac_safety_score') {
    return typeof value === 'number' && Number.isFinite(value) ? String(value) : '—'
  }
  return formatReadOnlyScalar(value)
}

/** Admin save payload — excludes pipeline-owned fields locked in Part B. */
export function buildAdminProductSavePayload(
  p: Product,
  mode: AdminProductSavePayloadMode,
): Record<string, unknown> {
  const core = {
    product_name: p.product_name,
    brand: p.brand,
    category: p.category,
    subcategory: p.subcategory,
    description: p.description,
    bpa_free: p.bpa_free,
    phthalate_free_claim: p.phthalate_free_claim,
    amazon_url: p.amazon_url,
    affiliate_link: p.affiliate_link,
    manufacturer_product_url: p.manufacturer_product_url,
    image_url: p.image_url,
    active: p.active,
  }
  const out: Record<string, unknown> = { ...core }
  if (mode !== 'no_retailer_urls') {
    out.target_url = p.target_url
    out.walmart_url = p.walmart_url
  }
  if (mode === 'full') {
    out.other_retailer_label = p.other_retailer_label
    out.other_retailer_url = p.other_retailer_url
  }
  return out
}

export function assertAdminSavePayloadExcludesPipelineFields(
  payload: Record<string, unknown>,
): void {
  for (const key of ADMIN_PIPELINE_READONLY_FIELD_KEYS) {
    if (key in payload) {
      throw new Error(`Admin save payload must not include pipeline-owned field: ${key}`)
    }
  }
}
