import type { Product } from '../types'

/** Legacy lumped subcategory label on existing catalog rows. */
export const LEGACY_LUMPED_DRINKWARE_SUBCATEGORY = 'Water Bottles and Drinkware'

export const MANAGED_KITCHEN_SUBCATEGORY_ORDER = [
  'Food Storage',
  'Cookware',
  'Cooking Utensils',
  'Water Bottles',
  'Drinkware',
  LEGACY_LUMPED_DRINKWARE_SUBCATEGORY,
] as const

export function productMatchesPublicSubcategory(
  product: Pick<Product, 'subcategory'>,
  subcategoryFilter: string,
): boolean {
  const s = (product.subcategory ?? '').trim()
  const filter = subcategoryFilter.trim()
  if (!filter) return true
  if (filter === 'Water Bottles') {
    return s === 'Water Bottles' || s === LEGACY_LUMPED_DRINKWARE_SUBCATEGORY
  }
  return s === filter
}

export function sortPublicSubcategoryLabels(labels: string[], categoryName: string): string[] {
  const unique = [...new Set(labels.filter((l) => l.trim().length > 0))]
  if (categoryName !== 'Kitchen') return unique.sort((a, b) => a.localeCompare(b))
  return unique.sort((a, b) => {
    const ia = MANAGED_KITCHEN_SUBCATEGORY_ORDER.indexOf(
      a as (typeof MANAGED_KITCHEN_SUBCATEGORY_ORDER)[number],
    )
    const ib = MANAGED_KITCHEN_SUBCATEGORY_ORDER.indexOf(
      b as (typeof MANAGED_KITCHEN_SUBCATEGORY_ORDER)[number],
    )
    if (ia !== -1 || ib !== -1) {
      if (ia === -1) return 1
      if (ib === -1) return -1
      return ia - ib
    }
    return a.localeCompare(b)
  })
}
