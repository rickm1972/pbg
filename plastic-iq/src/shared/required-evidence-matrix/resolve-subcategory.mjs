/**
 * Map product_identity.subcategory (display) → matrix key.
 * @param {string | null | undefined} subcategory
 */
export function resolveSubcategoryKey(subcategory) {
  const s = String(subcategory ?? '').trim().toLowerCase()
  if (!s) return 'cookware'
  if (/cutting\s*board/.test(s)) return 'cutting_boards'
  if (/food\s*storage|food_storage/.test(s)) return 'food_storage'
  if (/water\s*bottle|drinkware|drink\s*ware/.test(s)) return 'water_bottles_drinkware'
  if (/cooking\s*utensil|utensil/.test(s) && !/cookware/.test(s)) return 'cooking_utensils'
  if (/cookware/.test(s)) return 'cookware'
  return 'cookware'
}

/** Active launch pipeline — formulation products archived (0019). */
export function isFormulationSubcategory(subcategory) {
  const s = String(subcategory ?? '').trim().toLowerCase()
  return /dish\s*soap|formulation|detergent|laundry|cleaning\s*liquid/.test(s)
}

export const MATRIX_SUBCATEGORY_KEYS = [
  'cookware',
  'food_storage',
  'water_bottles_drinkware',
  'cooking_utensils',
  'cutting_boards',
]
