/**
 * Step 7 — deterministic product description (3 sentences).
 * Word limits and blocking policy: src/shared/agent2/output-contract.mjs
 */

import { BADGES } from '../../agent3/confidence-interval.mjs'
import { NONE } from '../why-this-score-vocabulary.mjs'
import { whyThisScoreLabelForComponent } from '../why-this-score-labels.mjs'
import { factValue } from './evidence-facts.mjs'
import { formatDescriptionPhrase } from './description-text.mjs'
import { getSafetyClaims, getStructuredEvidence } from './schema-input.mjs'
import { isFoodContactCoatingPrimaryMaterial } from './material-taxonomy.mjs'
import { getMaterial, requireCategoryForDescription } from './material-taxonomy.mjs'
import {
  formatUseConditionsForPublicSentence,
  isNonPacInertFoodContactMaterial,
  nonPacInertMaterialClause,
  nonPacInertScoreContextSentence,
} from '../../lib/non-pac-inert-material.mjs'
import {
  AGENT2_OUTPUT_CONTRACT,
  cosmeticProductDescriptionWarningMessage,
  countProductDescriptionWords,
  getProductDescriptionWordLimits,
  validateProductDescriptionWordCount,
} from '../../../src/shared/agent2/output-contract.mjs'
import {
  extractManufacturerPublishedLabTesting,
  hasManufacturerPublishedLabTesting,
} from '../../../src/shared/agent2/manufacturer-lab-testing-evidence.mjs'

export const PRODUCT_DESCRIPTION_GENERATOR_VERSION = '2026-06-03-output-contract'

const PRIMARY_ROLES = new Set(['primary_food_contact', 'formulation'])
const MARKETING_LANGUAGE_REASON = 'marketing language only, no verifiable claims'
const RETRY_STRATEGIES = AGENT2_OUTPUT_CONTRACT.product_description.retry_strategies

/**
 * @param {object} params
 * @param {object} params.product
 * @param {object} params.evidence
 * @param {object} params.inputs
 * @param {object} params.whyThisScore
 */
export function runProductDescriptionStep({ product, evidence, inputs, whyThisScore }) {
  const missing = collectMissingFields({ product, inputs, whyThisScore })
  if (missing.length) {
    const flagged = missing.map((f) => `product_description:${f}`)
    return cosmeticDescriptionResult({
      product_description: null,
      product_description_status: AGENT2_OUTPUT_CONTRACT.product_description.statuses.validation_warning,
      flagged_missing_fields: flagged,
      product_description_warnings: [cosmeticProductDescriptionWarningMessage(flagged)],
      description_word_count: null,
    })
  }

  const primaryComponent = findPrimaryComponent(inputs.components)
  const primaryLabels = primaryMaterialLabelsForDescription(inputs, whyThisScore)
  const useConditions = useConditionLabels(whyThisScore)
  const badge = String(inputs.layer_4b?.transparency_badge ?? '').trim()
  const hazard = primaryComponentHazard(primaryComponent)
  const materialName = String(getMaterial(primaryComponent.material_id)?.name ?? '').trim()
  const category = requireCategoryForDescription(primaryComponent.material_id)

  const ctx = {
    product,
    evidence,
    inputs,
    whyThisScore,
    primaryComponent,
    primaryLabels,
    useConditions,
    badge,
    hazard,
    materialName,
    category,
  }

  let bestDescription = null
  let bestWordCount = 0
  let bestValidation = validateProductDescriptionWordCount(0)

  for (const strategy of RETRY_STRATEGIES) {
    const description = buildDescription(ctx, strategy)
    const wordCount = countProductDescriptionWords(description)
    const validation = validateProductDescriptionWordCount(wordCount)
    if (validation.withinRange) {
      return cosmeticDescriptionResult({
        product_description: description,
        product_description_status: AGENT2_OUTPUT_CONTRACT.product_description.statuses.ok,
        flagged_missing_fields: [],
        product_description_warnings: [],
        description_word_count: wordCount,
      })
    }
    if (!bestDescription || Math.abs(wordCount - getTargetWordCount()) < Math.abs(bestWordCount - getTargetWordCount())) {
      bestDescription = description
      bestWordCount = wordCount
      bestValidation = validation
    }
  }

  const flagged = [`word_count_out_of_range:${bestWordCount}`]
  const warnings = [cosmeticProductDescriptionWarningMessage(flagged)]
  const limits = getProductDescriptionWordLimits()

  return cosmeticDescriptionResult({
    product_description: bestDescription,
    product_description_status: AGENT2_OUTPUT_CONTRACT.product_description.statuses.validation_warning,
    flagged_missing_fields: flagged,
    product_description_warnings: warnings,
    description_word_count: bestWordCount,
    human_review_reason: `Product description word count ${bestWordCount} is outside ${limits.min_words}–${limits.max_words}.`,
  })
}

function getTargetWordCount() {
  const { min_words, max_words } = getProductDescriptionWordLimits()
  return Math.round((min_words + max_words) / 2)
}

/**
 * @param {object} result
 */
function cosmeticDescriptionResult(result) {
  return {
    ...result,
    description_generator_version: PRODUCT_DESCRIPTION_GENERATOR_VERSION,
  }
}

/**
 * @param {object} ctx
 * @param {string} strategy
 */
function buildDescription(ctx, strategy) {
  const sentence1 = buildSentence1(ctx.product, ctx.primaryLabels, ctx)
  const sentence2 = buildSentence2({ ...ctx, copyStrategy: strategy })
  const sentence3 = buildSentence3({ ...ctx, copyStrategy: strategy })
  return [sentence1, sentence2, sentence3].join(' ')
}

/**
 * Proprietary coating with manufacturer-published lab testing — dedicated copy path.
 * @param {object} ctx
 */
function usesOpaqueLabDescriptionPath(ctx) {
  const lab = ctx.inputs?.testing_evidence ?? extractManufacturerPublishedLabTesting(ctx.evidence)
  const hasLab =
    Boolean(lab?.testing_evidence_present) || hasManufacturerPublishedLabTesting(ctx.evidence)
  if (!hasLab) return false
  if (String(ctx.badge ?? '').trim() === BADGES.OPAQUE) return true
  return Boolean(ctx.inputs?.layer_4a?.proprietary_ceramic_formula_undisclosed)
}

/**
 * @param {string[]} analytes
 */
function formatAnalytesForDescription(analytes) {
  const list = (analytes ?? []).slice(0, 4).filter(Boolean)
  if (!list.length) return 'PFAS, PTFE, PFOA, and related'
  if (list.length === 1) return list[0]
  if (list.length === 2) return `${list[0]} and ${list[1]}`
  return `${list.slice(0, -1).join(', ')}, and ${list[list.length - 1]}`
}

/**
 * @param {object} ctx
 */
function collectMissingFields({ product, inputs, whyThisScore }) {
  const missing = []
  if (!String(product?.brand ?? '').trim()) missing.push('product.brand')
  const primaryLabels = primaryMaterialLabelsForDescription(inputs, whyThisScore)
  if (!primaryLabels.length) missing.push('why_this_score.primary_material')
  const primary = findPrimaryComponent(inputs?.components ?? [])
  if (!primary) missing.push('primary_food_contact_component')
  else if (!getCategoryForDescription(primary.material_id)) {
    missing.push(`category_for_description:${primary.material_id}`)
  }
  const useLabels = useConditionLabels(whyThisScore)
  if (!useLabels.length) missing.push('why_this_score.use_conditions')
  if (!inputs?.layer_4b?.transparency_badge) missing.push('layer_4b.transparency_badge')
  return missing
}

function getCategoryForDescription(materialId) {
  try {
    return requireCategoryForDescription(materialId)
  } catch {
    return null
  }
}

/**
 * @param {object} whyThisScore
 */
function primaryMaterialOptions(whyThisScore) {
  return (whyThisScore?.primary_material_options ?? [])
    .map((o) => String(o ?? '').trim())
    .filter((o) => o && o !== NONE)
}

/**
 * @param {object} whyThisScore
 */
function useConditionLabels(whyThisScore) {
  return (whyThisScore?.use_conditions_options ?? [])
    .map((o) => String(o ?? '').trim())
    .filter((o) => o && o !== NONE)
}

/**
 * @param {object[]} components
 */
function primaryContactComponents(components) {
  return (components ?? []).filter((c) => PRIMARY_ROLES.has(c.component_role ?? c.role))
}

/**
 * Hazard for sorting — uses post-inference component.material_hazard (not option list order).
 * @param {object | null | undefined} component
 */
function primaryComponentHazard(component) {
  if (!component) return 0
  const fromRow = Number(component.material_hazard)
  if (Number.isFinite(fromRow)) return fromRow
  return Number(getMaterial(component.material_id)?.hazard ?? 0)
}

/**
 * Sentence 1 labels: primary food-contact components sorted by material_hazard descending.
 * @param {object} inputs
 * @param {object} whyThisScore
 */
function primaryMaterialLabelsForDescription(inputs, whyThisScore) {
  const components = [...primaryContactComponents(inputs?.components)].sort(
    (a, b) => primaryComponentHazard(b) - primaryComponentHazard(a),
  )

  const labels = []
  for (const c of components) {
    const label = whyThisScoreLabelForComponent(
      c.material_id,
      c.component_role ?? c.role,
      'primary',
    )
    if (label && label !== NONE && !labels.includes(label)) labels.push(label)
  }
  if (labels.length) return labels

  const options = primaryMaterialOptions(whyThisScore)
  if (!options.length) return []

  const ranked = options.map((opt) => ({
    opt,
    hazard: maxComponentHazardForPrimaryOption(opt, inputs?.components ?? []),
  }))
  ranked.sort((a, b) => b.hazard - a.hazard)
  return ranked.map((r) => r.opt)
}

/**
 * @param {string} optionLabel
 * @param {object[]} components
 */
function maxComponentHazardForPrimaryOption(optionLabel, components) {
  let max = 0
  for (const c of primaryContactComponents(components)) {
    const label = whyThisScoreLabelForComponent(
      c.material_id,
      c.component_role ?? c.role,
      'primary',
    )
    if (label !== optionLabel) continue
    max = Math.max(max, primaryComponentHazard(c))
  }
  return max
}

/**
 * @param {object[]} components
 */
function findPrimaryComponent(components) {
  const rows = primaryContactComponents(components)
  if (!rows.length) return null
  return [...rows].sort((a, b) => primaryComponentHazard(b) - primaryComponentHazard(a))[0]
}

/**
 * @param {object} product
 * @param {string[]} primaryLabels
 */
function buildSentence1(product, primaryLabels, ctx = null) {
  const brand = String(product.brand ?? '').trim()
  if (ctx && usesOpaqueLabDescriptionPath(ctx)) {
    const coating =
      coatingPhrase(ctx.whyThisScore) ||
      primaryLabels.find(
        (l) => /proprietary|undisclosed|nonstick/i.test(l) && !/laser|etched|peak/i.test(l),
      )
    const laserLabel =
      primaryLabels.find((l) => /laser|etched|peak/i.test(l)) ||
      primaryMaterialOptions(ctx.whyThisScore).find((l) => /laser|etched|peak/i.test(l))
    if (coating && laserLabel) {
      const coatingText = formatDescriptionPhrase(coating).replace(/^proprietary\s+/i, '')
      return `${brand} uses a proprietary ${coatingText} in the cooking-surface valleys, with ${formatDescriptionPhrase(laserLabel)}.`
    }
  }
  const materials = primaryLabels.map((l) => formatDescriptionPhrase(l))
  if (materials.length <= 1) {
    return `${brand} uses ${materials[0] ?? 'undisclosed material'} as its food-contact surface.`
  }
  const primary = materials[0]
  const secondary = materials.slice(1).join(', ')
  return `${brand} uses ${primary} as its food-contact surface, with ${secondary}.`
}

/**
 * @param {object} ctx
 */
function buildSentence2(ctx) {
  const {
    product,
    badge,
    hazard,
    materialName,
    category,
    inputs,
    evidence,
    whyThisScore,
    useConditions,
    copyStrategy = 'default',
  } = ctx
  const namePhrase = formatDescriptionPhrase(materialName)
  const brand = String(product?.brand ?? 'The brand').trim()
  const useSentence = formatUseConditionsForPublicSentence(useConditions)
  const nonPacInert = isNonPacInertFoodContactMaterial(
    materialName,
    ctx.primaryComponent?.material_id,
    { categoryHint: category },
  )

  if (
    badge === BADGES.DOCUMENTATION_INCOMPLETE &&
    layer4aHasMarketingLanguageOnly(inputs.layer_4a)
  ) {
    const claim = resolveSafetyClaimPhrase(evidence)
    const coating = coatingPhrase(whyThisScore)
    return `${brand} markets this product as ${claim}, but manufacturer disclosures list ${coating} in the food-contact layer, which contradicts that marketing claim.`
  }

  if (badge === BADGES.OPAQUE || usesOpaqueLabDescriptionPath(ctx)) {
    const lab =
      inputs?.testing_evidence ?? extractManufacturerPublishedLabTesting(evidence)
    if (lab?.testing_evidence_present) {
      const labName = lab.testing_lab ? `${lab.testing_lab} ` : 'third-party '
      const analytes = formatAnalytesForDescription(lab.tested_analytes)
      return `The manufacturer displays ${labName}Non-Detect testing for ${analytes} compounds, but the complete coating formula is not disclosed.`
    }
    if (badge === BADGES.OPAQUE) {
      return 'The coating chemistry is not disclosed by the manufacturer, so we cannot verify the safety of the materials in direct food contact.'
    }
  }

  if (badge === BADGES.MATERIAL_UNCERTAIN) {
    return 'Some materials are disclosed but key components — particularly the food-contact coating — are not fully characterized.'
  }

  if (badge === BADGES.FULL_DISCLOSED && hazard < 0.1) {
    if (nonPacInert) {
      if (copyStrategy === 'expand_inert_clause') {
        return nonPacInertMaterialClause(namePhrase, useSentence)
      }
      if (copyStrategy === 'compact') {
        return `${namePhrase} is inert for PAC exposure purposes.`
      }
      return `${namePhrase} is not a plastic- or PFAS-based food-contact material, so PAC exposure concern remains minimal.`
    }
    return `${namePhrase} is inert for PAC exposure purposes and has minimal expected plastic-associated chemical migration under typical kitchen use.`
  }

  if (badge === BADGES.FULL_DISCLOSED && hazard >= 0.5) {
    if (copyStrategy === 'compact') {
      return `${namePhrase} is a ${category} and can release plastic-associated chemicals into food under heat and wear.`
    }
    return `${namePhrase} is a ${category} and can release plastic-associated chemicals into food, particularly under high heat, scratching, or as the coating wears with use.`
  }

  const band = hazardBandLabel(hazard)
  return `${namePhrase} has ${band} potential to release plastic-associated chemicals under typical use.`
}

/**
 * @param {object} ctx
 */
function buildSentence3(ctx) {
  const { badge, hazard, category, useConditions, materialName, copyStrategy = 'default', inputs, evidence } = ctx
  const useText = formatUseConditionsList(useConditions)
  const namePhrase = formatDescriptionPhrase(materialName)
  const nonPacInert = isNonPacInertFoodContactMaterial(
    materialName,
    ctx.primaryComponent?.material_id,
    { categoryHint: category },
  )

  if (hazard < 0.1) {
    if (nonPacInert) {
      if (copyStrategy === 'default' || copyStrategy === 'compact') {
        return nonPacInertScoreContextSentence()
      }
      return `It's used for ${useText}; because ${namePhrase} is an inert material, routine heat and use conditions do not increase plastic-associated chemical migration.`
    }
    return `It's used for ${useText}; because ${namePhrase} is an inert material, routine heat and use conditions do not increase plastic-associated chemical migration.`
  }

  if (usesOpaqueLabDescriptionPath(ctx)) {
    const useSentence = formatUseConditionsForPublicSentence(useConditions)
    return `The product is used under ${useSentence}, so the score reflects both the available lab evidence and remaining uncertainty from proprietary food-contact chemistry.`
  }

  if (badge === BADGES.OPAQUE || badge === BADGES.MATERIAL_UNCERTAIN || badge === BADGES.DOCUMENTATION_INCOMPLETE) {
    const useSentence = formatUseConditionsForPublicSentence(useConditions)
    if (/ceramic|sol.gel|nonstick coating/i.test(String(category))) {
      return `It is used with ${useSentence}. Because the exact coating formulation is not fully disclosed, that uncertainty is reflected in the score and transparency badge.`
    }
    return `It is used with ${useSentence}. Because key food-contact chemistry is not fully disclosed, that uncertainty is reflected in the score and transparency badge.`
  }

  if (hazard >= 0.5) {
    if (/pfas|ptfe|nonstick/i.test(String(category))) {
      return `It's used for ${useText}, conditions associated with greater release potential for PFAS-related nonstick coatings.`
    }
    return `It's used for ${useText}, conditions associated with greater release potential for ${category}.`
  }

  return `It's used for ${useText}, conditions that can increase chemical migration from ${category}.`
}

/**
 * @param {string[]} labels
 */
function formatUseConditionsList(labels) {
  if (!labels.length) return 'typical household use'
  if (labels.length === 1) return labels[0].toLowerCase()
  if (labels.length === 2) {
    return `${labels[0].toLowerCase()} and ${labels[1].toLowerCase()}`
  }
  const last = labels[labels.length - 1].toLowerCase()
  const rest = labels
    .slice(0, -1)
    .map((l) => l.toLowerCase())
    .join(', ')
  return `${rest}, and ${last}`
}

/**
 * @param {object} evidence
 */
function resolveSafetyClaimPhrase(evidence) {
  const safety = getSafetyClaims(evidence)
  if (safety?.pfas_free_claim?.claimed) return 'PFAS-free'
  if (safety?.non_toxic_claim?.claimed) return 'non-toxic'
  if (safety?.bpa_free_claim?.claimed) return 'BPA-free'
  const marketing = factValue(evidence, 'marketing_claims_found').toLowerCase()
  if (/pfas[- ]?free/.test(marketing)) return 'PFAS-free'
  if (/non[- ]?toxic|toxin[- ]?free/.test(marketing)) return 'non-toxic'
  if (/bpa[- ]?free/.test(marketing)) return 'BPA-free'
  return 'safer or non-toxic'
}

/**
 * @param {object} whyThisScore
 */
function coatingPhrase(whyThisScore) {
  const coatings = (whyThisScore?.coatings_finishes_options ?? [])
    .map((o) => String(o ?? '').trim())
    .filter((o) => o && o !== NONE)
  if (coatings.length) return coatings.map((c) => formatDescriptionPhrase(c)).join(' and ')
  const primary = primaryMaterialOptions(whyThisScore)
  return primary[0] ? formatDescriptionPhrase(primary[0]) : 'undisclosed coating materials'
}

/**
 * @param {object} layer4a
 */
function layer4aHasMarketingLanguageOnly(layer4a) {
  for (const adj of layer4a?.negative_adjustments ?? []) {
    const reason =
      typeof adj === 'string' ? adj : String(adj?.reason ?? adj?.label ?? '').trim()
    if (!/marketing language only/i.test(reason)) continue
    const value =
      typeof adj === 'object' && adj != null
        ? Number(adj.value ?? adj.points ?? 0)
        : Number.parseInt(String(adj).replace(/[^\d-]/g, ''), 10)
    if (/not applied|does not apply/i.test(reason)) continue
    if (Number.isFinite(value) && value < 0) return true
    if (reason.toLowerCase().includes(MARKETING_LANGUAGE_REASON.toLowerCase())) return true
  }
  return false
}

/**
 * @param {number} hazard
 */
function hazardBandLabel(hazard) {
  if (hazard < 0.1) return 'low'
  if (hazard < 0.5) return 'moderate'
  return 'high'
}
