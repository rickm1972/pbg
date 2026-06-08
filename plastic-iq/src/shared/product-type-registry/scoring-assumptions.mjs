/**
 * V2.3.4 scoring assumption contracts — registry configs must reference one of these.
 */

/** @type {Record<string, {
 *   id: string
 *   algorithm_version: '2.3.4'
 *   scoring_category: string
 *   category_modifier_key?: string
 *   exposure_defaults_key: string
 *   use_conditions_key: string
 * }>} */
export const SCORING_ASSUMPTIONS_V234 = {
  'v2.3.4.cookware': {
    id: 'v2.3.4.cookware',
    algorithm_version: '2.3.4',
    scoring_category: 'cookware',
    category_modifier_key: 'cookware',
    exposure_defaults_key: 'cookware',
    use_conditions_key: 'cookware',
  },
  'v2.3.4.drinkware': {
    id: 'v2.3.4.drinkware',
    algorithm_version: '2.3.4',
    scoring_category: 'drinkware',
    category_modifier_key: 'drinkware',
    exposure_defaults_key: 'drinkware',
    use_conditions_key: 'drinkware',
  },
  'v2.3.4.food_storage': {
    id: 'v2.3.4.food_storage',
    algorithm_version: '2.3.4',
    scoring_category: 'food-storage',
    category_modifier_key: 'food_storage',
    exposure_defaults_key: 'food_storage',
    use_conditions_key: 'food_storage',
  },
  'v2.3.4.utensils': {
    id: 'v2.3.4.utensils',
    algorithm_version: '2.3.4',
    scoring_category: 'utensils',
    category_modifier_key: 'utensils',
    exposure_defaults_key: 'utensils',
    use_conditions_key: 'utensils',
  },
  'v2.3.4.textiles': {
    id: 'v2.3.4.textiles',
    algorithm_version: '2.3.4',
    scoring_category: 'textiles',
    category_modifier_key: 'textiles',
    exposure_defaults_key: 'textiles',
    use_conditions_key: 'textiles',
  },
  'v2.3.4.infant_oral': {
    id: 'v2.3.4.infant_oral',
    algorithm_version: '2.3.4',
    scoring_category: 'childrens',
    category_modifier_key: 'oral_contact_toy',
    exposure_defaults_key: 'infant_oral',
    use_conditions_key: 'infant_oral',
  },
  'v2.3.4.rinse_off': {
    id: 'v2.3.4.rinse_off',
    algorithm_version: '2.3.4',
    scoring_category: 'rinse-off',
    category_modifier_key: 'rinse_off',
    exposure_defaults_key: 'rinse_off',
    use_conditions_key: 'rinse_off',
  },
}

export const VALID_SCORING_ASSUMPTION_REFS = Object.keys(SCORING_ASSUMPTIONS_V234)

export function getScoringAssumption(ref) {
  return SCORING_ASSUMPTIONS_V234[ref] ?? null
}

export function getScoringAssumptionByScoringCategory(scoringCategory) {
  const needle = String(scoringCategory ?? '').trim().toLowerCase()
  return (
    Object.values(SCORING_ASSUMPTIONS_V234).find(
      (a) => a.scoring_category.toLowerCase() === needle,
    ) ?? null
  )
}

export function getExposureDefaultsForScoringCategory(scoringCategory) {
  const assumption = getScoringAssumptionByScoringCategory(scoringCategory)
  if (!assumption) return null
  return EXPOSURE_DEFAULTS_BY_KEY[assumption.exposure_defaults_key] ?? null
}

export function getUseConditionTemplatesForScoringCategory(scoringCategory) {
  const assumption = getScoringAssumptionByScoringCategory(scoringCategory)
  if (!assumption) return []
  return USE_CONDITION_TEMPLATES_BY_KEY[assumption.use_conditions_key] ?? []
}

/** Universal secondary-role defaults shared across product types (Layer 1 registry). */
export const UNIVERSAL_ROLE_DEFAULTS = {
  handle: { contact_intimacy: 0.5, severity: 0.5, duration: { duration: 0.5, modifier: 1 } },
  rivet: { contact_intimacy: 0.5, severity: 0.5, duration: { duration: 0.5, modifier: 1 } },
  lid: { contact_intimacy: 0.3, severity: 0.3, duration: { duration: 0.3, modifier: 1 } },
  gasket: { contact_intimacy: 0.3, severity: 0.3, duration: { duration: 0.3, modifier: 1 } },
  packaging: {
    contact_intimacy: 0.3,
    severity: 0.3,
    duration: { duration: 0.2, modifier: 1 },
  },
  structural: { contact_intimacy: 0.1, severity: 0.3, duration: { duration: 0.3, modifier: 1 } },
  default: { contact_intimacy: 0.3, severity: 0.5, duration: { duration: 0.3, modifier: 1 } },
}

/**
 * Layer 1 exposure / use-condition defaults keyed by exposure_defaults_key / use_conditions_key.
 * Single owner for Agent 2 taxonomy-lookup + why-this-score use conditions.
 */
export const EXPOSURE_DEFAULTS_BY_KEY = {
  cookware: {
    foreseeable_use_suffix:
      'Common foreseeable use includes high-heat stovetop cooking with fatty foods and oven use.',
    roles: {
      primary_food_contact: {
        severity: { severity_base: 0.88, additions: [{ factor: 'fatty food (common foreseeable)', value: 0.08 }] },
        duration: { duration: 0.5, modifier: 1 },
        contact_intimacy: 1,
      },
      coating: {
        severity: { severity_base: 0.88, additions: [{ factor: 'fatty food (common foreseeable)', value: 0.08 }] },
        duration: { duration: 0.5, modifier: 1 },
        contact_intimacy: 1,
      },
      handle: { severity: 0.5, duration: { duration: 0.5, modifier: 1 }, contact_intimacy: 0.5 },
      structural: { severity: 0.3, duration: { duration: 0.3, modifier: 1 }, contact_intimacy: 0.1 },
    },
  },
  drinkware: {
    roles: {
      primary_food_contact: { severity: 0.7, duration: { duration: 0.5, modifier: 1 }, contact_intimacy: 1 },
    },
  },
  food_storage: {
    roles: {
      primary_food_contact: { severity: 0.6, duration: { duration: 0.4, modifier: 1 }, contact_intimacy: 0.8 },
      lid: { severity: 0.3, duration: { duration: 0.3, modifier: 1 }, contact_intimacy: 0.3 },
    },
  },
  utensils: {
    roles: {
      primary_food_contact: { severity: 0.75, duration: { duration: 0.4, modifier: 1 }, contact_intimacy: 1 },
      handle: { severity: 0.5, duration: { duration: 0.5, modifier: 1 }, contact_intimacy: 0.5 },
    },
  },
  textiles: {
    roles: {
      primary_food_contact: { severity: 0.4, duration: { duration: 0.6, modifier: 1 }, contact_intimacy: 0.7 },
    },
  },
  infant_oral: {
    roles: {
      primary_food_contact: { severity: 0.85, duration: { duration: 0.7, modifier: 1 }, contact_intimacy: 1 },
    },
  },
  rinse_off: {
    foreseeable_use_suffix:
      'Product is diluted and rinsed off after brief contact with dishes, surfaces, and skin.',
    roles: {
      formulation: {
        severity: 0.3,
        duration: { duration: 0.2, modifier: 0.3 },
        contact_intimacy: 0.25,
      },
    },
  },
}

export const USE_CONDITION_TEMPLATES_BY_KEY = {
  cookware: [
    { match: /oven|broil|bake|roast/, label: 'Oven heat with fat exposure' },
    { match: /acid|tomato|vinegar|citrus/, label: 'Stovetop heat with acid exposure' },
    { label: 'Stovetop heat with fat exposure' },
  ],
  drinkware: [{ label: 'Direct oral contact during drinking' }],
  food_storage: [
    {
      match: /hot|heated|microwave/,
      label: 'Hot food storage',
      else_label: 'Cold food storage',
    },
  ],
  utensils: [{ label: 'Direct food handling (utensils)' }],
  textiles: [{ label: 'Prolonged skin contact (textiles)' }],
  infant_oral: [{ label: 'Direct oral mouthing (infant)' }],
  rinse_off: [{ label: 'Brief rinse-off contact' }],
}

export const DISPLAY_USE_CONDITION_CLAUSE_BY_KEY = {
  cookware: 'It is used with oven and stovetop heat, including fat exposure',
}

export const SCORING_CATEGORY_FROM_ASSUMPTION = Object.fromEntries(
  Object.values(SCORING_ASSUMPTIONS_V234).map((a) => [a.id, a.scoring_category]),
)
