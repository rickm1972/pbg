import { consumerComponentLabel, consumerPrimaryMaterialLabel } from './explanation-labels.mjs'
import {
  buildConcernHighRiskExplanation,
  isConcernOrHighRiskTier,
} from './explanation-risk-context.mjs'
import { deriveTransparencyBadgeAndCI } from './confidence-interval.mjs'

export const ALGORITHM_VERSION = '2.3.4'

export function tierForScore(score) {
  if (score >= 90) return 'Excellent'
  if (score >= 75) return 'Good'
  if (score >= 55) return 'Caution'
  if (score >= 30) return 'Concern'
  return 'High Risk'
}

const INERT_MIGRATION_THRESHOLD = 0.05
const INERT_EXPOSURE_MULTIPLIER = 0.2
const NPR_SCALE = 1000
const LAYER_4A_CAP = 5
const HARD_CAP_UNKNOWN_COATING = 72
const SCORE_MAX = 99

const ESCALATORS = [
  { id: 'escalator_4', multiplier: 1.5, field: 'escalator_4_triggers' },
  { id: 'escalator_2', multiplier: 1.4, field: 'escalator_2_triggers' },
  { id: 'escalator_3', multiplier: 1.3, field: 'escalator_3_triggers' },
  { id: 'escalator_1', multiplier: 1.25, field: 'escalator_1_triggers' },
]

function num(v, fallback = 0) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n))
}

function roundNearest(n) {
  return Math.round(n)
}

function normalizeModifierKey(raw) {
  if (!raw) return null
  const s = String(raw).toLowerCase().replace(/\s+/g, '_')
  if (s.includes('infant')) return 'infant'
  if (s.includes('children') || s.includes('child')) return 'children'
  if (s.includes('oral')) return 'oral_contact_toy'
  if (s.includes('athletic')) return 'athletic'
  if (s.includes('rinse')) return 'rinse_off'
  return s
}

function inferModifierFromCategory(categoryDefault) {
  if (!categoryDefault) return null
  const s = String(categoryDefault).toLowerCase()
  if (s.includes('infant')) return 'infant'
  if (s.includes('children') || s.includes('toy')) return 'children'
  if (s.includes('oral')) return 'oral_contact_toy'
  if (s.includes('athletic')) return 'athletic'
  if (s.includes('rinse')) return 'rinse_off'
  return null
}

function applyInertExposure(severity, duration, baseMigration) {
  if (baseMigration > INERT_MIGRATION_THRESHOLD) {
    return { severity, duration, inertApplied: false }
  }
  return {
    severity: severity * INERT_EXPOSURE_MULTIPLIER,
    duration: duration * INERT_EXPOSURE_MULTIPLIER,
    inertApplied: true,
  }
}

function computeBaseNpr(component, severity, duration, contactIntimacy) {
  const hazard = num(component.material_hazard)
  const migration = num(component.adjusted_migration_potential)
  const ci = num(contactIntimacy)
  return hazard * migration * ci * severity * duration * NPR_SCALE
}

function pickEscalator(component) {
  for (const esc of ESCALATORS) {
    if (component[esc.field]) {
      return esc
    }
  }
  return null
}

function applyCategoryModifiers({
  component,
  severity,
  duration,
  contactIntimacy,
  productCategoryDefault,
  isFormulation,
}) {
  let adjustedSeverity = severity
  let adjustedDuration = duration
  let adjustedCi = contactIntimacy
  const modifiers = []

  const key =
    normalizeModifierKey(component.category_modifier_applied) ??
    inferModifierFromCategory(productCategoryDefault)
  const modifierValue = num(component.category_modifier_value, 1)

  if (key === 'athletic' || String(component.category_modifier_applied ?? '').toLowerCase().includes('athletic')) {
    adjustedSeverity *= 1.15
    modifiers.push({ type: 'athletic', severity_multiplier: 1.15 })
  }

  if (key === 'oral_contact_toy') {
    adjustedCi = 1.0
    modifiers.push({ type: 'oral_contact_toy', ci: 1.0 })
  }

  if (isFormulation && (key === 'rinse_off' || String(productCategoryDefault ?? '').includes('rinse'))) {
    adjustedDuration *= 0.3
    modifiers.push({ type: 'rinse_off', duration_multiplier: 0.3 })
  }

  let adjustedNpr = computeBaseNpr(component, adjustedSeverity, adjustedDuration, adjustedCi)

  if (key === 'oral_contact_toy') {
    adjustedNpr *= 1.25
    modifiers.push({ type: 'oral_contact_toy_npr', multiplier: 1.25 })
  }

  if (key === 'children' || modifierValue === 1.2) {
    adjustedNpr *= 1.2
    modifiers.push({ type: 'children', multiplier: 1.2 })
  } else if (key === 'infant' || modifierValue === 1.35) {
    adjustedNpr *= 1.35
    modifiers.push({ type: 'infant', multiplier: 1.35 })
  } else if (modifierValue !== 1 && key !== 'oral_contact_toy') {
    adjustedNpr *= modifierValue
    modifiers.push({ type: 'custom', multiplier: modifierValue })
  }

  return {
    npr: adjustedNpr,
    severity: adjustedSeverity,
    duration: adjustedDuration,
    contactIntimacy: adjustedCi,
    modifiers,
  }
}

function computeWeightedNpr(componentResults) {
  const sumCi = componentResults.reduce((acc, c) => acc + c.contact_intimacy, 0)
  if (sumCi <= 0) return 0
  const weighted = componentResults.reduce(
    (acc, c) => acc + c.final_npr * c.contact_intimacy,
    0,
  )
  return weighted / sumCi
}

function computeRawScore(weightedNpr) {
  return 100 - Math.sqrt(Math.max(0, weightedNpr)) * 5
}

function clampLayer4a(net) {
  return clamp(num(net), -LAYER_4A_CAP, LAYER_4A_CAP)
}

function computeIngredientTransparencyScore(inputs) {
  const pathway = inputs.formulation_pathway
  if (!inputs.is_formulation_product || !pathway?.applicable) return null
  const hazard = num(pathway.pathway_2_hazard)
  const migration = num(pathway.pathway_2_migration)
  const raw = 100 - hazard * migration * 100
  return clamp(roundNearest(raw), 0, SCORE_MAX)
}

const EXPLANATION_EXCELLENT_THRESHOLD = 90
const EXPLANATION_GOOD_THRESHOLD = 75

function componentRiskContribution(c) {
  return c.final_npr * c.contact_intimacy
}

function pickHighestRiskComponent(componentResults) {
  return componentResults.reduce((best, c) => {
    const contribution = componentRiskContribution(c)
    if (!best || contribution > best.contribution) {
      return { ...c, contribution }
    }
    return best
  }, null)
}

/** Lowest hazard material with highest food-contact weight — not highest NPR. */
function pickDominantSafeComponent(componentResults) {
  if (!componentResults.length) return null
  return componentResults.reduce((best, c) => {
    if (!best) return c
    if (c.material_hazard < best.material_hazard) return c
    if (c.material_hazard > best.material_hazard) return best
    if (c.contact_intimacy > best.contact_intimacy) return c
    if (c.contact_intimacy < best.contact_intimacy) return best
    return c.final_npr < best.final_npr ? c : best
  }, null)
}

function capitalizeSentence(text) {
  if (!text?.trim()) return text
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** Plain-language note about the part that most affects the score (no NPR or algorithm terms). */
function limitingPartNote(highest) {
  if (!highest) {
    return 'Other parts of the product add very little to overall exposure concern.'
  }
  const label = consumerComponentLabel(highest)
  const lowConcern = Number(highest.final_npr) < 0.25
  const limitedContact = Number(highest.contact_intimacy) < 0.5

  if (lowConcern) {
    return `${label} adds very little to overall exposure concern for typical use.`
  }
  if (limitedContact) {
    return `${label} is worth noting, but it has limited direct contact with food or drink.`
  }
  return `${label} is the main part to be aware of; most food contact still involves safer materials.`
}

function buildExplanationDraft({
  pacScore,
  tier,
  confidenceInterval,
  displayedRange,
  componentResults,
  inputs,
  brand,
}) {
  const [low, high] = displayedRange
  const rangeText = low === high ? `${low}` : `${low}–${high}`
  const showRange = confidenceInterval > 0
  const brandLabel = brand?.trim() || 'This product'
  const highest = pickHighestRiskComponent(componentResults)
  const highestLabel = consumerComponentLabel(highest)

  if (pacScore >= EXPLANATION_EXCELLENT_THRESHOLD) {
    const safeMaterial = consumerPrimaryMaterialLabel(pickDominantSafeComponent(componentResults))
    const rangeClause = showRange
      ? `The score could fall anywhere from ${rangeText} until every material detail is confirmed; it likely sits near the top of that range. `
      : 'All major materials are fully disclosed by the manufacturer. '
    const labClause = showRange
      ? `${brandLabel} could narrow the range further with independent lab testing.`
      : ''
    return (
      `This product scores ${pacScore} (${tier}) because its materials are exceptionally safe for food contact — primarily ${safeMaterial}. ` +
      `${capitalizeSentence(limitingPartNote(highest))} ` +
      rangeClause +
      labClause
    ).trim()
  }

  if (pacScore >= EXPLANATION_GOOD_THRESHOLD) {
    const rangeClause = showRange
      ? `The published score could fall anywhere from ${rangeText} until more material detail is confirmed.`
      : ''
    return (
      `This product scores ${pacScore} (${tier}). ` +
      `What holds the score back is ${highestLabel} — the part with the most exposure-related concern in normal use. ` +
      rangeClause
    ).trim()
  }

  if (isConcernOrHighRiskTier(tier, pacScore) && inputs) {
    return buildConcernHighRiskExplanation({
      pacScore,
      tier,
      displayedRange,
      componentResults,
      inputs,
      brand,
    })
  }

  const narrowNote = showRange
    ? confidenceInterval <= 6
      ? ' More complete material disclosure or independent testing could narrow this range.'
      : ' Confirming undisclosed materials or third-party verification could narrow this range.'
    : ''

  const rangeClause = showRange
    ? `The published score could fall anywhere from ${rangeText} because material disclosure is limited or unverified.${narrowNote}`
    : `Material disclosure is limited or unverified.${narrowNote}`

  return (
    `This product scores ${pacScore} (${tier}). ` +
    `The main concern is ${highestLabel}, which has the most direct food or drink contact among the materials in this product. ` +
    rangeClause
  )
}

/**
 * Core PAC score from normalization inputs; optional per-component hazard overrides for CI bands.
 * @param {object} inputs
 * @param {Record<string, number>} [hazardOverrides] — component_name → material_hazard
 */
export function scorePacCore(inputs, hazardOverrides = null) {
  const components = inputs.components ?? []
  const isFormulation = Boolean(inputs.is_formulation_product)
  const layer4a = inputs.layer_4a ?? {}
  const componentResults = []

  for (const component of components) {
    const overrideHazard = hazardOverrides?.[component.component_name]
    const effectiveComponent =
      overrideHazard != null && Number.isFinite(Number(overrideHazard))
        ? { ...component, material_hazard: Number(overrideHazard) }
        : component

    const baseMigration = num(
      effectiveComponent.base_migration_potential ??
        effectiveComponent.adjusted_migration_potential,
    )
    let severity = num(effectiveComponent.exposure_severity)
    let duration = num(effectiveComponent.exposure_duration)
    let contactIntimacy = num(effectiveComponent.contact_intimacy)

    const inert = applyInertExposure(severity, duration, baseMigration)
    severity = inert.severity
    duration = inert.duration

    const afterCategory = applyCategoryModifiers({
      component: effectiveComponent,
      severity,
      duration,
      contactIntimacy,
      productCategoryDefault: inputs.product_category_default,
      isFormulation,
    })
    let npr = afterCategory.npr
    severity = afterCategory.severity
    duration = afterCategory.duration
    contactIntimacy = afterCategory.contactIntimacy

    const escalator = pickEscalator(effectiveComponent)
    let finalNpr = npr
    if (escalator) {
      finalNpr *= escalator.multiplier
    }

    const materialHazard = num(effectiveComponent.material_hazard)

    componentResults.push({
      component_name: effectiveComponent.component_name,
      material: effectiveComponent.material,
      material_hazard: materialHazard,
      adjusted_migration_potential: num(component.adjusted_migration_potential),
      base_migration_potential: baseMigration,
      contact_intimacy: contactIntimacy,
      exposure_severity: severity,
      exposure_duration: duration,
      inert_protection_applied: inert.inertApplied,
      base_npr: computeBaseNpr(
        effectiveComponent,
        inert.inertApplied
          ? num(effectiveComponent.exposure_severity) * INERT_EXPOSURE_MULTIPLIER
          : num(effectiveComponent.exposure_severity),
        inert.inertApplied
          ? num(effectiveComponent.exposure_duration) * INERT_EXPOSURE_MULTIPLIER
          : num(effectiveComponent.exposure_duration),
        num(effectiveComponent.contact_intimacy),
      ),
      npr_after_category: afterCategory.npr,
      category_modifiers: afterCategory.modifiers,
      escalator_applied: escalator?.id ?? null,
      escalator_multiplier: escalator?.multiplier ?? 1,
      final_npr: finalNpr,
    })
  }

  const weightedNpr = computeWeightedNpr(componentResults)
  const rawScore = computeRawScore(weightedNpr)
  const layer4aNet = clampLayer4a(layer4a.net_adjustment ?? 0)
  let scoreAfter4a = rawScore + layer4aNet

  if (layer4a.unknown_coating_cap_applies) {
    scoreAfter4a = Math.min(scoreAfter4a, HARD_CAP_UNKNOWN_COATING)
  }

  const pacSafetyScore = clamp(roundNearest(scoreAfter4a), 0, SCORE_MAX)
  const tier = tierForScore(pacSafetyScore)

  return {
    pac_safety_score: pacSafetyScore,
    tier,
    weighted_npr: weightedNpr,
    raw_score: rawScore,
    layer_4a_net: layer4aNet,
    score_after_4a: scoreAfter4a,
    component_results: componentResults,
  }
}

/**
 * Run V2.3.4 PAC Safety Scoring Algorithm on an approved normalization packet.
 */
export function scoreNormalization(inputs, options = {}) {
  const steps = []
  const core = scorePacCore(inputs)
  const pacSafetyScore = core.pac_safety_score
  const tier = core.tier
  const componentResults = core.component_results
  const layer4bDerived = deriveTransparencyBadgeAndCI(inputs, pacSafetyScore)
  const confidenceInterval = layer4bDerived.confidence_interval
  const displayedConfidenceRange = layer4bDerived.displayed_confidence_range
  const transparencyBadge = layer4bDerived.transparency_badge
  const displayedRange = displayedConfidenceRange
    ? parseDisplayedConfidenceRange(displayedConfidenceRange)
    : [pacSafetyScore, pacSafetyScore]

  const escalatorsUsed = [
    ...new Set(componentResults.map((c) => c.escalator_applied).filter(Boolean)),
  ]
  const ingredientTransparencyScore = computeIngredientTransparencyScore(inputs)

  const explanationDraft = buildExplanationDraft({
    pacScore: pacSafetyScore,
    tier,
    confidenceInterval,
    displayedRange,
    componentResults,
    inputs,
    brand: options.brand,
  })

  const calculation = {
    weighted_npr: core.weighted_npr,
    raw_score: core.raw_score,
    layer_4a_net: core.layer_4a_net,
    score_after_4a: core.score_after_4a,
    pac_safety_score: pacSafetyScore,
    component_results: componentResults,
    layer_4b: layer4bDerived,
  }

  if (options.debug) {
    steps.push(calculation)
  }

  return {
    pac_safety_score: pacSafetyScore,
    tier,
    displayed_confidence_range: displayedConfidenceRange,
    transparency_badge: transparencyBadge,
    confidence_interval: confidenceInterval,
    weighted_npr: Number(core.weighted_npr.toFixed(4)),
    component_nprs: {
      components: componentResults,
      weighted_npr: Number(core.weighted_npr.toFixed(4)),
    },
    escalator_applied: escalatorsUsed.length ? escalatorsUsed.join(', ') : null,
    layer_4a_net: core.layer_4a_net,
    ingredient_transparency_score: ingredientTransparencyScore,
    explanation_draft: explanationDraft,
    algorithm_version: ALGORITHM_VERSION,
    layer_4b: layer4bDerived,
    calculation,
  }
}

function parseDisplayedConfidenceRange(text) {
  if (!text?.trim()) return [0, SCORE_MAX]
  const m = String(text).match(/(\d+)\s*[–-]\s*(\d+)/)
  if (m) return [Number(m[1]), Number(m[2])]
  const n = Number.parseInt(String(text).trim(), 10)
  return Number.isFinite(n) ? [n, n] : [0, SCORE_MAX]
}

/**
 * Rebuild explanation_draft from approved score fields + scoring inputs (no NPR/score recalculation).
 */
export function regenerateExplanationDraft({
  inputs,
  componentResults,
  pacScore,
  tier,
  displayedConfidenceRange,
  brand,
}) {
  const displayedRange = parseDisplayedConfidenceRange(displayedConfidenceRange)
  const confidenceInterval = num(inputs?.layer_4b?.confidence_interval, 12)
  return buildExplanationDraft({
    pacScore,
    tier,
    confidenceInterval,
    displayedRange,
    componentResults: componentResults ?? [],
    inputs,
    brand,
  })
}

export function formatCalculationTrace(result) {
  const c = result.calculation
  const lines = [
    '=== Agent 3 calculation trace ===',
    '',
  ]
  for (const comp of c.component_results) {
    lines.push(`Component: ${comp.component_name}`)
    lines.push(
      `  hazard=${comp.material_hazard} migration=${comp.adjusted_migration_potential} CI=${comp.contact_intimacy}`,
    )
    lines.push(
      `  severity=${comp.exposure_severity} duration=${comp.exposure_duration} inert=${comp.inert_protection_applied}`,
    )
    lines.push(`  final_npr=${comp.final_npr} escalator=${comp.escalator_applied ?? 'none'}`)
    lines.push('')
  }
  lines.push(`Weighted NPR: ${c.weighted_npr}`)
  lines.push(`Raw score: 100 - sqrt(${c.weighted_npr}) * 5 = ${c.raw_score}`)
  lines.push(`Layer 4A net: ${c.layer_4a_net}`)
  lines.push(`PAC Safety Score: ${c.pac_safety_score}`)
  lines.push(`Tier: ${result.tier}`)
  return lines.join('\n')
}
