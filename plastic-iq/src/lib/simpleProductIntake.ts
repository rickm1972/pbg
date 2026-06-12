import type { Product } from '../types'

/** User-facing product intake before Agent 1 — exactly three fields. */
export const SIMPLE_PRODUCT_INTAKE_FIELDS = [
  {
    key: 'product_name' as const,
    label: 'Product title',
    column: 'products.product_name',
    helper: null,
  },
  {
    key: 'amazon_url' as const,
    label: 'Amazon or primary retailer URL',
    column: 'products.amazon_url',
    helper:
      'Use Amazon when available. If no Amazon page exists, use the main retailer product page.',
  },
  {
    key: 'manufacturer_product_url' as const,
    label: 'Manufacturer product URL',
    column: 'products.manufacturer_product_url',
    helper: 'Use the exact product page, not the brand homepage or collection page.',
  },
] as const

/** Legacy columns kept in DB but not shown in the simple intake workflow. */
export const HIDDEN_LEGACY_INTAKE_KEYS = [
  'primary_retailer_evidence_url',
  'manufacturer_lab_results_url',
  'manufacturer_materials_faq_url',
  'agent1_source_notes',
] as const

export type SimpleProductIntakeKey = (typeof SIMPLE_PRODUCT_INTAKE_FIELDS)[number]['key']

/** Values Agent 1 reads from the saved product row for provided primary sources. */
export function buildAgent1ProvidedInput(product: Pick<Product, SimpleProductIntakeKey>) {
  return {
    product_title: product.product_name?.trim() ?? '',
    primary_retailer_url: product.amazon_url?.trim() || null,
    manufacturer_product_url: product.manufacturer_product_url?.trim() || null,
  }
}
