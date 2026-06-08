/**
 * Universal composable product-type registry — Layers 1–3 resolver.
 * Single owner for category / product-type rules (not APR).
 */

import { STARTER_PRODUCT_TYPE_CONFIGS } from './configs/starter-configs.mjs'
import {
  buildRegistryKey,
  normalizeLookupText,
  validateProductTypeConfig,
} from './schema.mjs'
import {
  EXPOSURE_DEFAULTS_BY_KEY,
  getScoringAssumption,
  getScoringAssumptionByScoringCategory,
  getExposureDefaultsForScoringCategory,
  getUseConditionTemplatesForScoringCategory,
  USE_CONDITION_TEMPLATES_BY_KEY,
} from './scoring-assumptions.mjs'

/** @type {Map<string, import('./schema.mjs').ProductTypeRegistryConfig>} */
const CONFIG_BY_REGISTRY_KEY = new Map()

/** @type {Map<string, import('./schema.mjs').ProductTypeRegistryConfig>} */
const CONFIG_BY_ALIAS = new Map()

/** @type {Map<string, import('./schema.mjs').ProductTypeRegistryConfig>} */
const CONFIG_BY_MATRIX_KEY = new Map()

/** @type {import('./schema.mjs').ProductTypeRegistryConfig[]} */
const ALL_CONFIGS = []

function registerConfig(config) {
  const validation = validateProductTypeConfig(config)
  if (!validation.valid) {
    throw new Error(
      `Invalid product-type registry config ${config?.registry_key ?? '(unknown)'}: ${validation.errors.join('; ')}`,
    )
  }
  ALL_CONFIGS.push(config)
  CONFIG_BY_REGISTRY_KEY.set(config.registry_key, config)
  CONFIG_BY_MATRIX_KEY.set(config.matrix_key, config)
  for (const alias of config.subcategory_aliases ?? []) {
    CONFIG_BY_ALIAS.set(normalizeLookupText(alias), config)
  }
  CONFIG_BY_ALIAS.set(normalizeLookupText(config.product_type), config)
}

for (const config of STARTER_PRODUCT_TYPE_CONFIGS) {
  registerConfig(config)
}

/**
 * @param {import('./schema.mjs').ProductTypeRegistryConfig} config
 */
export function registerProductTypeConfigForTest(config) {
  registerConfig(config)
  return config
}

export function getAllProductTypeConfigs() {
  return [...ALL_CONFIGS]
}

export function getProductTypeConfigByRegistryKey(registryKey) {
  return CONFIG_BY_REGISTRY_KEY.get(registryKey) ?? null
}

export function getProductTypeConfigByMatrixKey(matrixKey) {
  return CONFIG_BY_MATRIX_KEY.get(matrixKey) ?? null
}

/**
 * Product-type-first resolution.
 * When product_type is present, exact triple + product_type alias only — no broad subcategory alias fallback.
 *
 * @param {{ category?: string | null, subcategory?: string | null, product_type?: string | null }} ctx
 */
export function resolveProductTypeConfig(ctx = {}) {
  const cat = normalizeLookupText(ctx.category)
  const sub = normalizeLookupText(ctx.subcategory)
  const productTypeRaw = String(ctx.product_type ?? '').trim()
  const pt = normalizeLookupText(ctx.product_type)
  const hasProductType = Boolean(productTypeRaw)

  if (cat && sub && pt) {
    const exact = CONFIG_BY_REGISTRY_KEY.get(
      buildRegistryKey(ctx.category, ctx.subcategory, ctx.product_type),
    )
    if (exact) return exact
  }

  if (hasProductType) {
    const byProductTypeAlias = CONFIG_BY_ALIAS.get(pt)
    if (byProductTypeAlias && (!cat || normalizeLookupText(byProductTypeAlias.category) === cat)) {
      return byProductTypeAlias
    }
    for (const config of ALL_CONFIGS) {
      if (cat && normalizeLookupText(config.category) !== cat) continue
      if (normalizeLookupText(config.product_type) === pt) return config
    }
    return null
  }

  if (sub) {
    const byAlias = CONFIG_BY_ALIAS.get(sub)
    if (byAlias && (!cat || normalizeLookupText(byAlias.category) === cat)) return byAlias
  }

  if (pt) {
    const byProductType = CONFIG_BY_ALIAS.get(pt)
    if (byProductType && (!cat || normalizeLookupText(byProductType.category) === cat)) {
      return byProductType
    }
  }

  for (const config of ALL_CONFIGS) {
    const configCat = normalizeLookupText(config.category)
    const configSub = normalizeLookupText(config.subcategory)
    if (cat && configCat !== cat) continue
    if (sub && (sub === configSub || (config.subcategory_aliases ?? []).map(normalizeLookupText).includes(sub))) {
      return config
    }
  }

  return null
}

/**
 * @param {{ product?: object, evidence?: object }} ctx
 */
export function resolveProductTypeConfigFromContext(ctx = {}) {
  const { product, evidence } = ctx
  const structured = evidence?.agent_metadata?.structured_evidence ?? evidence?.structured_evidence
  const identity = structured?.product_identity
  return resolveProductTypeConfig({
    category: identity?.category ?? product?.category,
    subcategory: identity?.subcategory ?? product?.subcategory,
    product_type: identity?.product_type ?? product?.product_type,
  })
}

/**
 * Agent 1 matrix key — no fallback when unconfigured.
 * @param {string | null | undefined} subcategory
 * @param {{ category?: string | null, product_type?: string | null }} [ctx]
 */
export function resolveMatrixKeyFromRegistry(subcategory, ctx = {}) {
  const config = resolveProductTypeConfig({
    category: ctx.category,
    subcategory,
    product_type: ctx.product_type,
  })
  return config?.matrix_key ?? null
}

/**
 * @param {import('./schema.mjs').ProductTypeRegistryConfig} config
 */
export function getExposureDefaultsForConfig(config) {
  const assumption = getScoringAssumption(config.scoring_assumption_ref)
  if (!assumption) return null
  return EXPOSURE_DEFAULTS_BY_KEY[assumption.exposure_defaults_key] ?? null
}

export {
  buildRegistryKey,
  normalizeLookupText,
  validateProductTypeConfig,
  getScoringAssumption,
  getScoringAssumptionByScoringCategory,
  getExposureDefaultsForScoringCategory,
  getUseConditionTemplatesForScoringCategory,
  EXPOSURE_DEFAULTS_BY_KEY,
  USE_CONDITION_TEMPLATES_BY_KEY,
}
