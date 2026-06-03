import { COOKWARE_MATRIX } from './cookware.mjs'
import { FOOD_STORAGE_MATRIX } from './food-storage.mjs'
import { WATER_BOTTLES_DRINKWARE_MATRIX } from './water-bottles-drinkware.mjs'
import { COOKING_UTENSILS_MATRIX } from './cooking-utensils.mjs'
import { CUTTING_BOARDS_MATRIX } from './cutting-boards.mjs'

/** @type {Record<string, import('../types.mjs').SubcategoryMatrix>} */
export const SUBCATEGORY_MATRICES = {
  cookware: COOKWARE_MATRIX,
  food_storage: FOOD_STORAGE_MATRIX,
  water_bottles_drinkware: WATER_BOTTLES_DRINKWARE_MATRIX,
  cooking_utensils: COOKING_UTENSILS_MATRIX,
  cutting_boards: CUTTING_BOARDS_MATRIX,
}

/**
 * @param {string} subcategoryKey
 */
export function getMatrixForSubcategory(subcategoryKey) {
  return SUBCATEGORY_MATRICES[subcategoryKey] ?? COOKWARE_MATRIX
}
