import { factValue } from './evidence-facts.mjs'
import {
  getProductUseCase,
  hasStructuredEvidence,
} from './schema-input.mjs'
import {
  getScoringAssumption,
  resolveProductTypeConfigFromContext,
} from '../../../src/shared/product-type-registry/index.mjs'
import { getExposureDefaultsForScoringCategory } from '../../../src/shared/product-type-registry/scoring-assumptions.mjs'

/** @param {object} evidence @param {object} product */
export function deriveProductCategory(evidence, product) {
  const config = resolveProductTypeConfigFromContext({ product, evidence })
  if (!config) return null
  const assumption = getScoringAssumption(config.scoring_assumption_ref)
  return assumption?.scoring_category ?? null
}

export function deriveIntendedUse(evidence) {
  if (hasStructuredEvidence(evidence)) {
    return getProductUseCase(evidence) || 'General household product use'
  }
  return factValue(evidence, 'product_use_case') || 'General household product use'
}

export function deriveForeseeableUse(evidence, category) {
  const use = factValue(evidence, 'product_use_case')
  const exposure = getExposureDefaultsForScoringCategory(category)
  const suffix = exposure?.foreseeable_use_suffix ?? null
  return [use, suffix].filter(Boolean).join(' ')
}

/** @deprecated internal — retained for tests importing registry exposure defaults */
export function getForeseeableUseSuffixForCategory(category) {
  const exposure = getExposureDefaultsForScoringCategory(category)
  return exposure?.foreseeable_use_suffix ?? null
}
