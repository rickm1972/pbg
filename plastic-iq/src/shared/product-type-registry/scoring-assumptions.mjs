/**
 * V2.3.5 scoring assumption contracts — registry configs must reference one of these.
 */

/** Plastic / nylon utensil primary-contact materials (v2.3.5 doc role-split). */
export const UTENSILS_PLASTIC_NYLON_MATERIAL_IDS = new Set([
  'nylon_food_contact',
  'bpa_free_plastic_unspecified',
])

/** Stainless / wood utensil primary-contact materials (v2.3.5 doc role-split). */
export const UTENSILS_STAINLESS_WOOD_MATERIAL_IDS = new Set([
  'stainless_steel_304',
  'stainless_steel_316',
  'stainless_steel_unspecified',
  'teak_wood',
  'bamboo_natural',
])

/** @type {Record<string, {
 *   id: string
 *   algorithm_version: '2.3.5'
 *   scoring_category: string
 *   category_modifier_key?: string
 *   exposure_defaults_key: string
 *   use_conditions_key: string
 * }>} */
export const SCORING_ASSUMPTIONS_V235 = {
  'v2.3.5.cookware': {
    id: 'v2.3.5.cookware',
    algorithm_version: '2.3.5',
    scoring_category: 'cookware',
    category_modifier_key: 'cookware',
    exposure_defaults_key: 'cookware',
    use_conditions_key: 'cookware',
  },
  'v2.3.5.drinkware': {
    id: 'v2.3.5.drinkware',
    algorithm_version: '2.3.5',
    scoring_category: 'drinkware',
    category_modifier_key: 'drinkware',
    exposure_defaults_key: 'drinkware',
    use_conditions_key: 'drinkware',
  },
  'v2.3.5.water_bottles': {
    id: 'v2.3.5.water_bottles',
    algorithm_version: '2.3.5',
    scoring_category: 'water-bottles',
    category_modifier_key: 'water_bottles',
    exposure_defaults_key: 'water_bottles',
    use_conditions_key: 'water_bottles',
  },
  'v2.3.5.food_storage': {
    id: 'v2.3.5.food_storage',
    algorithm_version: '2.3.5',
    scoring_category: 'food-storage',
    category_modifier_key: 'food_storage',
    exposure_defaults_key: 'food_storage',
    use_conditions_key: 'food_storage',
  },
  'v2.3.5.utensils': {
    id: 'v2.3.5.utensils',
    algorithm_version: '2.3.5',
    scoring_category: 'utensils',
    category_modifier_key: 'utensils',
    exposure_defaults_key: 'utensils',
    use_conditions_key: 'utensils',
  },
  'v2.3.5.textiles': {
    id: 'v2.3.5.textiles',
    algorithm_version: '2.3.5',
    scoring_category: 'textiles',
    category_modifier_key: 'textiles',
    exposure_defaults_key: 'textiles',
    use_conditions_key: 'textiles',
  },
  'v2.3.5.infant_oral': {
    id: 'v2.3.5.infant_oral',
    algorithm_version: '2.3.5',
    scoring_category: 'childrens',
    category_modifier_key: 'oral_contact_toy',
    exposure_defaults_key: 'infant_oral',
    use_conditions_key: 'infant_oral',
  },
  'v2.3.5.rinse_off': {
    id: 'v2.3.5.rinse_off',
    algorithm_version: '2.3.5',
    scoring_category: 'rinse-off',
    category_modifier_key: 'rinse_off',
    exposure_defaults_key: 'rinse_off',
    use_conditions_key: 'rinse_off',
  },
}

/** @deprecated Use SCORING_ASSUMPTIONS_V235 */
export const SCORING_ASSUMPTIONS_V234 = SCORING_ASSUMPTIONS_V235

export const VALID_SCORING_ASSUMPTION_REFS = Object.keys(SCORING_ASSUMPTIONS_V235)

export function getScoringAssumption(ref) {
  return SCORING_ASSUMPTIONS_V235[ref] ?? null
}

export function getScoringAssumptionByScoringCategory(scoringCategory) {
  const needle = String(scoringCategory ?? '').trim().toLowerCase()
  return (
    Object.values(SCORING_ASSUMPTIONS_V235).find(
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

/**
 * v2.3.5 utensils role-split: plastic/nylon severity 1.0; stainless/wood 0.96; duration 0.50.
 * @param {string | null | undefined} materialId
 * @returns {{ severity: number, duration: number, path: string } | null}
 */
export function resolveUtensilsPrimaryDefaults(materialId) {
  const id = String(materialId ?? '').trim()
  if (!id) return null
  if (UTENSILS_PLASTIC_NYLON_MATERIAL_IDS.has(id)) {
    return { severity: 1.0, duration: 0.5, path: 'plastic_nylon' }
  }
  if (UTENSILS_STAINLESS_WOOD_MATERIAL_IDS.has(id)) {
    return { severity: 0.96, duration: 0.5, path: 'stainless_wood' }
  }
  return null
}

/**
 * Resolve numeric severity/duration for a role + category (+ material for utensils split).
 * @param {string} role
 * @param {string} scoringCategory
 * @param {string | null | undefined} [materialId]
 * @returns {{ severity: number | null, duration: number | null, contactIntimacy: number | null, utensilsPath?: string }}
 */
export function resolveExposureDefaultsForRole(role, scoringCategory, materialId = null) {
  const exposure = getExposureDefaultsForScoringCategory(scoringCategory)
  const fromCategory = exposure?.roles?.[role]
  const spec = fromCategory ?? UNIVERSAL_ROLE_DEFAULTS[role] ?? UNIVERSAL_ROLE_DEFAULTS.default
  const contactIntimacy = spec.contact_intimacy ?? 0.5

  if (
    scoringCategory === 'utensils' &&
    role === 'primary_food_contact' &&
    spec?.material_split
  ) {
    const split = resolveUtensilsPrimaryDefaults(materialId)
    if (!split) {
      return { severity: null, duration: null, contactIntimacy, utensilsPath: null }
    }
    return {
      severity: split.severity,
      duration: split.duration,
      contactIntimacy,
      utensilsPath: split.path,
    }
  }

  const sevSpec = spec.severity
  let severity
  if (typeof sevSpec === 'object' && sevSpec != null) {
    severity = Math.min(
      1,
      Number(sevSpec.severity_base ?? 0) +
        (sevSpec.additions ?? []).reduce((s, a) => s + Number(a.value ?? 0), 0),
    )
  } else {
    severity = Number(sevSpec ?? 0.5)
  }

  const durSpec = spec.duration ?? { duration: 0.3, modifier: 1 }
  const duration = Number(durSpec.duration ?? 0.3) * Number(durSpec.modifier ?? 1)

  return { severity, duration, contactIntimacy }
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
      primary_food_contact: {
        severity: 0.6,
        duration: { duration: 0.8, modifier: 1 },
        contact_intimacy: 1,
      },
    },
  },
  water_bottles: {
    roles: {
      primary_food_contact: {
        severity: 0.6,
        duration: { duration: 0.8, modifier: 1 },
        contact_intimacy: 1,
      },
    },
  },
  food_storage: {
    roles: {
      primary_food_contact: {
        severity: 0.83,
        duration: { duration: 0.75, modifier: 1 },
        contact_intimacy: 0.8,
      },
      lid: { severity: 0.3, duration: { duration: 0.3, modifier: 1 }, contact_intimacy: 0.3 },
    },
  },
  utensils: {
    roles: {
      primary_food_contact: {
        material_split: true,
        duration: { duration: 0.5, modifier: 1 },
        contact_intimacy: 1,
      },
      handle: { severity: 0.5, duration: { duration: 0.5, modifier: 1 }, contact_intimacy: 0.5 },
    },
  },
  textiles: {
    roles: {
      primary_food_contact: {
        severity: 0.2,
        duration: { duration: 1.0, modifier: 1 },
        contact_intimacy: 0.7,
      },
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
  water_bottles: [{ label: 'Direct oral contact during drinking (all-day daily)' }],
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
  Object.values(SCORING_ASSUMPTIONS_V235).map((a) => [a.id, a.scoring_category]),
)
