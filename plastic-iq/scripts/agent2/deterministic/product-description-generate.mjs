/**
 * Step 7 — deterministic product description (3 sentences, 50–100 words).
 * Reads pipeline outputs + Why This Score options only; no LLM.
 */

import { BADGES } from '../../agent3/confidence-interval.mjs'
import { NONE } from '../why-this-score-vocabulary.mjs'
import { whyThisScoreLabelForComponent } from '../why-this-score-labels.mjs'
import { factValue } from './evidence-facts.mjs'
import { formatDescriptionPhrase } from './description-text.mjs'
import { getSafetyClaims } from './schema-input.mjs'
import { getMaterial, requireCategoryForDescription } from './material-taxonomy.mjs'

export const PRODUCT_DESCRIPTION_GENERATOR_VERSION = '2026-06-01-hazard-sort-acronym'

const PRIMARY_ROLES = new Set(['primary_food_contact', 'formulation'])
const MARKETING_LANGUAGE_REASON = 'marketing language only, no verifiable claims'

/**
 * @param {object} params
 * @param {object} params.product
 * @param {object} params.evidence
 * @param {object} params.inputs
 * @param {object} params.whyThisScore
 */
export function runProductDescriptionStep({ product, evidence, inputs, whyThisScore }) {
  const missing = collectMissingFields({ product, evidence, inputs, whyThisScore })
  if (missing.length) {
    return {
      ok: false,
      status: 'description_generation_failed',
      flagged_missing_fields: missing,
      product_description: null,
      human_review_required: true,
      human_review_reason:
        `Product description generation failed — missing: ${missing.join(', ')}.`,
    }
  }

  const primaryComponent = findPrimaryComponent(inputs.components)
  const primaryLabels = primaryMaterialLabelsForDescription(inputs, whyThisScore)
  const useConditions = useConditionLabels(whyThisScore)
  const badge = String(inputs.layer_4b?.transparency_badge ?? '').trim()
  const hazard = primaryComponentHazard(primaryComponent)
  const materialName = String(getMaterial(primaryComponent.material_id)?.name ?? '').trim()
  const category = requireCategoryForDescription(primaryComponent.material_id)

  const sentence1 = buildSentence1(product, primaryLabels)
  const sentence2 = buildSentence2({
    product,
    badge,
    hazard,
    materialName,
    category,
    inputs,
    evidence,
    whyThisScore,
  })
  const sentence3 = buildSentence3({
    badge,
    hazard,
    category,
    useConditions,
    materialName,
  })

  const description = [sentence1, sentence2, sentence3].join(' ')
  const wordCount = countWords(description)
  if (wordCount < 50 || wordCount > 100) {
    return {
      ok: false,
      status: 'description_generation_failed',
      flagged_missing_fields: [`word_count_out_of_range:${wordCount}`],
      product_description: null,
      human_review_required: true,
      human_review_reason: `Product description word count ${wordCount} is outside 50–100.`,
    }
  }

  return {
    ok: true,
    product_description: description,
    description_word_count: wordCount,
    description_generator_version: PRODUCT_DESCRIPTION_GENERATOR_VERSION,
  }
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
 * Never uses why_this_score.primary_material_options array order (that follows extraction order).
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
function buildSentence1(product, primaryLabels) {
  const brand = String(product.brand ?? '').trim()
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
  const { product, badge, hazard, materialName, category, inputs, evidence, whyThisScore } =
    ctx
  const namePhrase = formatDescriptionPhrase(materialName)
  const brand = String(product?.brand ?? 'The brand').trim()

  if (
    badge === BADGES.DOCUMENTATION_INCOMPLETE &&
    layer4aHasMarketingLanguageOnly(inputs.layer_4a)
  ) {
    const claim = resolveSafetyClaimPhrase(evidence)
    const coating = coatingPhrase(whyThisScore)
    return `${brand} markets this product as ${claim}, but manufacturer disclosures list ${coating} in the food-contact layer, which contradicts that marketing claim.`
  }

  if (badge === BADGES.OPAQUE) {
    return 'The coating chemistry is not disclosed by the manufacturer, so we cannot verify the safety of the materials in direct food contact.'
  }

  if (badge === BADGES.MATERIAL_UNCERTAIN) {
    return 'Some materials are disclosed but key components — particularly the food-contact coating — are not fully characterized.'
  }

  if (badge === BADGES.FULL_DISCLOSED && hazard < 0.1) {
    return 'The disclosed food-contact material is inert under typical kitchen use and does not transfer plastic-associated chemicals into food.'
  }

  if (badge === BADGES.FULL_DISCLOSED && hazard >= 0.5) {
    return `${namePhrase} is a ${category} and can release plastic-associated chemicals into food, particularly under high heat, scratching, or as the coating wears with use.`
  }

  const band = hazardBandLabel(hazard)
  return `${namePhrase} has ${band} potential to release plastic-associated chemicals under typical use.`
}

/**
 * @param {object} ctx
 */
function buildSentence3(ctx) {
  const { badge, hazard, category, useConditions, materialName } = ctx
  const useText = formatUseConditionsList(useConditions)
  const namePhrase = formatDescriptionPhrase(materialName)

  if (hazard < 0.1) {
    return `It's used for ${useText}; because ${namePhrase} is an inert material, routine heat and use conditions do not increase plastic-associated chemical migration.`
  }

  if (badge === BADGES.OPAQUE || badge === BADGES.MATERIAL_UNCERTAIN) {
    return `It's used for ${useText}, conditions that would accelerate chemical migration from coatings — but we can't quantify the risk without disclosed chemistry.`
  }

  if (hazard >= 0.5) {
    return `It's used for ${useText}, conditions that accelerate chemical release from ${category}.`
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

/**
 * @param {string} text
 */
function countWords(text) {
  return String(text ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length
}
