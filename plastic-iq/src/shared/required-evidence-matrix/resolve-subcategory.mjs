/**
 * Map product identity → Agent 1 required-evidence matrix key via product-type registry.
 * No fallback defaults — unconfigured types return null (preflight blocks).
 */

import { resolveMatrixKeyFromRegistry } from '../product-type-registry/index.mjs'

/**
 * @param {string | null | undefined} subcategory
 * @param {{ category?: string | null, product_type?: string | null }} [ctx]
 */
export function resolveSubcategoryKey(subcategory, ctx = {}) {
  return resolveMatrixKeyFromRegistry(subcategory, ctx)
}

/** Active launch pipeline — formulation products archived (0019). */
export function isFormulationSubcategory(subcategory) {
  const s = String(subcategory ?? '').trim().toLowerCase()
  return /dish\s*soap|formulation|detergent|laundry|cleaning\s*liquid/.test(s)
}

export const MATRIX_SUBCATEGORY_KEYS = [
  'cookware',
  'food_storage',
  'water_bottles',
  'drinkware',
  'water_bottles_drinkware',
  'cooking_utensils',
  'textiles',
  'infant_oral',
  'rinse_off',
]
