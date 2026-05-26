import { factValue } from './evidence-facts.mjs'
import {
  getProductUseCase,
  getStructuredSubcategory,
  hasStructuredEvidence,
} from './schema-input.mjs'

/**
 * Structured subcategory → Agent 2 category default (authoritative before use-case regex).
 * Keys are normalized: lowercase, spaces/hyphens → underscores (e.g. "Dish Soap" → dish_soap).
 */
const SUBCATEGORY_CATEGORY = {
  dish_soap: 'rinse-off',
  hand_soap: 'rinse-off',
  body_wash: 'rinse-off',
  shampoo: 'rinse-off',
  laundry_detergent: 'rinse-off',
  cleaning_concentrate: 'rinse-off',
  all_purpose_cleaner: 'rinse-off',
  cookware: 'cookware',
  frying_pan: 'cookware',
  skillet: 'cookware',
  saute_pan: 'cookware',
  wok: 'cookware',
  drinkware: 'drinkware',
  water_bottle: 'drinkware',
  food_storage: 'food-storage',
  glass_containers: 'food-storage',
  utensils: 'utensils',
  kitchen_utensils: 'utensils',
  textiles: 'textiles',
  baby_products: 'childrens',
  cosmetics: 'cosmetics',
}

function categoryFromSubcategory(subcategoryKey) {
  if (!subcategoryKey) return null
  if (SUBCATEGORY_CATEGORY[subcategoryKey]) return SUBCATEGORY_CATEGORY[subcategoryKey]
  if (/dish/.test(subcategoryKey) && /soap|wash|detergent|clean/.test(subcategoryKey)) {
    return 'rinse-off'
  }
  if (/cookware|skillet|frying|saute|wok|grill/.test(subcategoryKey)) return 'cookware'
  if (/bottle|drinkware|mug|tumbler/.test(subcategoryKey)) return 'drinkware'
  return null
}

/** @param {object} evidence @param {object} product */
export function deriveProductCategory(evidence, product) {
  const subKey = hasStructuredEvidence(evidence)
    ? getStructuredSubcategory(evidence, product)
    : String(product?.subcategory ?? '')
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, '_')

  const fromSub = categoryFromSubcategory(subKey)
  if (fromSub) return fromSub

  const use = (hasStructuredEvidence(evidence)
    ? getProductUseCase(evidence)
    : factValue(evidence, 'product_use_case')
  ).toLowerCase()
  const cat = String(product?.category ?? '').toLowerCase()

  if (
    /rinse.off|dish soap|dishwashing|handwash|hand wash|hand dish|shampoo|laundry detergent|cleaning concentrate|dilutable concentrate/.test(
      use,
    )
  ) {
    return 'rinse-off'
  }
  if (/cookware|frying pan|skillet|sauté|saute|stovetop|wok|grill pan/.test(use)) {
    return 'cookware'
  }
  if (/water bottle|travel mug|drinkware|beverage|sippy/.test(use)) {
    return 'drinkware'
  }
  if (/food storage|meal prep container|glass container/.test(use)) {
    return 'food-storage'
  }
  if (/utensil set|kitchen utensil|spatula|ladle|tongs/.test(use)) {
    return 'utensils'
  }
  if (/textile|fabric|apparel|clothing|bedding/.test(use) || /textile|fabric/.test(subKey)) {
    return 'textiles'
  }
  if (/baby|infant|children/.test(use) || /baby|infant/.test(subKey)) {
    return 'childrens'
  }
  if (/cosmetic|skincare|lotion|moisturizer/.test(use)) {
    return 'cosmetics'
  }
  if (subKey.includes('cookware') || cat.includes('kitchen')) return 'cookware'
  return 'general'
}

export function deriveIntendedUse(evidence) {
  if (hasStructuredEvidence(evidence)) {
    return getProductUseCase(evidence) || 'General household product use'
  }
  return factValue(evidence, 'product_use_case') || 'General household product use'
}

export function deriveForeseeableUse(evidence, category) {
  const use = factValue(evidence, 'product_use_case')
  if (category === 'cookware') {
    return [use, 'Common foreseeable use includes high-heat stovetop cooking with fatty foods and oven use.'].filter(Boolean).join(' ')
  }
  if (category === 'rinse-off') {
    return [use, 'Product is diluted and rinsed off after brief contact with dishes, surfaces, and skin.'].filter(Boolean).join(' ')
  }
  return use
}
