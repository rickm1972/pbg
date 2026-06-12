/**
 * Route granular cookware subcategories to the existing Cookware required-evidence matrix.
 * Display subcategory may remain specific (e.g. "Frying Pan / Skillet"); matrix_key stays cookware.
 */

/** Granular cookware subtypes that inherit kitchen.cookware.fry_pan matrix config. */
export const COOKWARE_GRANULAR_SUBCATEGORY_ALIASES = [
  'Frying Pan / Skillet',
  'Frying Pan',
  'Fry Pan',
  'Skillet',
  'Nonstick Skillet',
  'Ceramic Nonstick Skillet',
  'Ceramic Nonstick Frying Pan',
  'Nonstick Frying Pan',
  'Saucepan',
  'Sauté Pan',
  'Saute Pan',
  'Stockpot',
  'Dutch Oven',
  'Wok',
  'Griddle',
  'Grill Pan',
  'Cookware Set',
  'Cookware',
  'Pan',
]

const COOKWARE_CATEGORY_CONTEXT_RE = /^(kitchen|cookware)?$/i

const COOKWARE_SUBTYPE_PATTERNS = [
  /^cookware(?:\s+set)?$/,
  /^(?:nonstick\s+)?(?:ceramic\s+)?(?:nonstick\s+)?fry(?:ing)?\s+pan(?:\s*\/\s*skillet)?$/,
  /^fry\s+pan$/,
  /^(?:ceramic\s+)?nonstick\s+(?:fry(?:ing)?\s+pan|skillet)$/,
  /^skillet$/,
  /^sauce\s*pan$/,
  /^saut[eé]\s+pan$/,
  /^stock\s*pot$/,
  /^dutch\s+oven$/,
  /^wok$/,
  /^griddle$/,
  /^grill\s+pan$/,
  /^pan$/,
]

/**
 * @param {string | null | undefined} value
 */
export function normalizeCookwareSubcategoryText(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[/_]+/g, ' ')
    .replace(/[\s-]+/g, ' ')
    .trim()
}

/**
 * @param {string | null | undefined} category
 */
export function isCookwareCategoryContext(category) {
  const cat = String(category ?? '').trim()
  if (!cat) return true
  return COOKWARE_CATEGORY_CONTEXT_RE.test(cat)
}

/**
 * @param {string | null | undefined} subcategory
 * @param {string | null | undefined} [category]
 */
export function matchesCookwareGranularSubcategory(subcategory, category = '') {
  const norm = normalizeCookwareSubcategoryText(subcategory)
  if (!norm) return false
  if (!isCookwareCategoryContext(category)) return false

  for (const alias of COOKWARE_GRANULAR_SUBCATEGORY_ALIASES) {
    if (normalizeCookwareSubcategoryText(alias) === norm) return true
  }

  for (const re of COOKWARE_SUBTYPE_PATTERNS) {
    if (re.test(norm)) return true
  }

  return /\b(skillet|fry\s*pan|frying\s*pan|sauce\s*pan|saut[eé]\s*pan|stock\s*pot|wok|dutch\s+oven|griddle|grill\s+pan|cookware)\b/.test(
    norm,
  )
}
