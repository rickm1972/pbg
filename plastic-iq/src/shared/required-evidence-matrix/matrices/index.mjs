import { COOKWARE_MATRIX } from './cookware.mjs'
import { FOOD_STORAGE_MATRIX } from './food-storage.mjs'
import { WATER_BOTTLES_DRINKWARE_MATRIX } from './water-bottles-drinkware.mjs'
import { COOKING_UTENSILS_MATRIX } from './cooking-utensils.mjs'
import { CUTTING_BOARDS_MATRIX } from './cutting-boards.mjs'
import { TEXTILES_MATRIX } from './textiles.mjs'
import { INFANT_ORAL_MATRIX } from './infant-oral.mjs'
import { RINSE_OFF_MATRIX } from './rinse-off.mjs'

/** @type {Record<string, import('../types.mjs').SubcategoryMatrix>} */
const WATER_BOTTLES_MATRIX = {
  ...WATER_BOTTLES_DRINKWARE_MATRIX,
  subcategory_key: 'water_bottles',
  display_label: 'Water bottles',
}

const DRINKWARE_MATRIX = {
  ...WATER_BOTTLES_DRINKWARE_MATRIX,
  subcategory_key: 'drinkware',
  display_label: 'Drinkware',
}

export const SUBCATEGORY_MATRICES = {
  cookware: COOKWARE_MATRIX,
  food_storage: FOOD_STORAGE_MATRIX,
  water_bottles: WATER_BOTTLES_MATRIX,
  drinkware: DRINKWARE_MATRIX,
  water_bottles_drinkware: WATER_BOTTLES_DRINKWARE_MATRIX,
  cooking_utensils: COOKING_UTENSILS_MATRIX,
  cutting_boards: CUTTING_BOARDS_MATRIX,
  textiles: TEXTILES_MATRIX,
  infant_oral: INFANT_ORAL_MATRIX,
  rinse_off: RINSE_OFF_MATRIX,
}

/**
 * @param {string | null | undefined} subcategoryKey
 */
export function getMatrixForSubcategory(subcategoryKey) {
  if (!subcategoryKey || !SUBCATEGORY_MATRICES[subcategoryKey]) {
    throw new Error(
      `category config required: no required-evidence matrix for subcategory_key="${subcategoryKey ?? ''}"`,
    )
  }
  return SUBCATEGORY_MATRICES[subcategoryKey]
}
