export const ALGORITHM_VERSION = '2.3.3'

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

function materialLabelForExplanation(component) {
  if (!component) return 'its primary materials'
  const material = component.material?.trim()
  if (material) {
    const primary = material.split(/\s*[,(]/)[0].trim()
    if (primary) return primary
  }
  return component.component_name ?? 'its primary materials'
}

function componentExplanationLabel(component) {
  if (!component) return 'the primary contact component'
  const name = component.component_name?.trim()
  if (name) return name
  return materialLabelForExplanation(component)
}

function highestNprNote(highest, highestNpr) {
  if (!highest || !highestNpr) {
    return 'The single highest-NPR component contributes minimally to overall exposure.'
  }
  const npr = Number(highest.final_npr)
  if (npr < 0.25) {
    return `The single highest-NPR component is ${componentExplanationLabel(highest)} (NPR ${highestNpr}), which contributes minimal plastic-associated risk.`
  }
  if (highest.contact_intimacy < 0.5) {
    return `The single highest-NPR component is ${componentExplanationLabel(highest)} (NPR ${highestNpr}), but it has limited direct food contact.`
  }
  return `The single highest-NPR component is ${componentExplanationLabel(highest)} (NPR ${highestNpr}); safer materials still dominate direct food contact.`
}

function buildExplanationDraft({
  pacScore,
  tier,
  confidenceInterval,
  displayedRange,
  componentResults,
  brand,
}) {
  const [low, high] = displayedRange
  const rangeText = low === high ? `${low}` : `${low}–${high}`
  const brandLabel = brand?.trim() || 'This product'
  const highest = pickHighestRiskComponent(componentResults)
  const highestLabel = componentExplanationLabel(highest)
  const highestNpr =
    highest?.final_npr != null ? Number(highest.final_npr).toFixed(3) : null
  const narrowNote =
    confidenceInterval <= 6
      ? ' More complete material disclosure or independent testing would narrow this range.'
      : ' Confirming undisclosed materials or obtaining third-party verification would narrow this range.'

  if (pacScore >= EXPLANATION_EXCELLENT_THRESHOLD) {
    const safeMaterial = materialLabelForExplanation(pickDominantSafeComponent(componentResults))
    return (
      `This product scores ${pacScore} ${tier} because its materials are exceptionally safe for food contact — primarily ${safeMaterial}. ` +
      `${highestNprNote(highest, highestNpr)} ` +
      `The confidence range of ${rangeText} reflects some unverified material details; the true score likely sits at the top of that range. ` +
      `${brandLabel} could narrow the range further with third-party lab certification.`
    )
  }

  if (pacScore >= EXPLANATION_GOOD_THRESHOLD) {
    return (
      `This product scores ${pacScore} ${tier}. ` +
      `What holds the score back is ${highestLabel}${highestNpr ? ` (NPR ${highestNpr}, the highest among all contact parts)` : ', the highest-NPR contact part'}. ` +
      `The confidence range of ${rangeText} means the published score could fall anywhere in that window until more material detail is confirmed.`
    )
  }

  return (
    `This product scores ${pacScore} ${tier}. ` +
    `The primary risk driver is ${highestLabel}${highestNpr ? ` (NPR ${highestNpr})` : ''}, the single highest-NPR component. ` +
    `The confidence range of ${rangeText} reflects limited certainty about materials; the true score could fall anywhere in that window.${narrowNote}`
  )
}

/**
 * Run V2.3.3 PAC Safety Scoring Algorithm on an approved normalization packet.
 */
export function scoreNormalization(inputs, options = {}) {
  const steps = []
  const components = inputs.components ?? []
  const isFormulation = Boolean(inputs.is_formulation_product)
  const layer4a = inputs.layer_4a ?? {}
  const layer4b = inputs.layer_4b ?? {}

  const componentResults = []

  for (const component of components) {
    const baseMigration = num(
      component.base_migration_potential ?? component.adjusted_migration_potential,
    )
    let severity = num(component.exposure_severity)
    let duration = num(component.exposure_duration)
    let contactIntimacy = num(component.contact_intimacy)

    const inert = applyInertExposure(severity, duration, baseMigration)
    severity = inert.severity
    duration = inert.duration

    const afterCategory = applyCategoryModifiers({
      component,
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

    const escalator = pickEscalator(component)
    let finalNpr = npr
    if (escalator) {
      finalNpr *= escalator.multiplier
    }

    componentResults.push({
      component_name: component.component_name,
      material: component.material,
      material_hazard: num(component.material_hazard),
      adjusted_migration_potential: num(component.adjusted_migration_potential),
      base_migration_potential: baseMigration,
      contact_intimacy: contactIntimacy,
      exposure_severity: severity,
      exposure_duration: duration,
      inert_protection_applied: inert.inertApplied,
      base_npr: computeBaseNpr(
        component,
        inert.inertApplied ? num(component.exposure_severity) * INERT_EXPOSURE_MULTIPLIER : num(component.exposure_severity),
        inert.inertApplied ? num(component.exposure_duration) * INERT_EXPOSURE_MULTIPLIER : num(component.exposure_duration),
        num(component.contact_intimacy),
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
  const transparencyBadge = layer4b.transparency_badge ?? 'Partial Disclosure'
  const confidenceInterval = num(layer4b.confidence_interval, 12)
  const lower = Math.max(0, pacSafetyScore - confidenceInterval)
  const upper = Math.min(SCORE_MAX, pacSafetyScore + confidenceInterval)
  const displayedConfidenceRange = `${lower}–${upper}`

  const escalatorsUsed = [
    ...new Set(componentResults.map((c) => c.escalator_applied).filter(Boolean)),
  ]
  const ingredientTransparencyScore = computeIngredientTransparencyScore(inputs)

  const explanationDraft = buildExplanationDraft({
    pacScore: pacSafetyScore,
    tier,
    confidenceInterval,
    displayedRange: [lower, upper],
    componentResults,
    brand: options.brand,
  })

  const calculation = {
    weighted_npr: weightedNpr,
    raw_score: rawScore,
    layer_4a_net: layer4aNet,
    score_after_4a: scoreAfter4a,
    pac_safety_score: pacSafetyScore,
    component_results: componentResults,
  }

  if (options.debug) {
    steps.push(calculation)
  }

  return {
    pac_safety_score: pacSafetyScore,
    tier,
    displayed_confidence_range: displayedConfidenceRange,
    transparency_badge: transparencyBadge,
    weighted_npr: Number(weightedNpr.toFixed(4)),
    component_nprs: {
      components: componentResults,
      weighted_npr: Number(weightedNpr.toFixed(4)),
    },
    escalator_applied: escalatorsUsed.length ? escalatorsUsed.join(', ') : null,
    layer_4a_net: layer4aNet,
    ingredient_transparency_score: ingredientTransparencyScore,
    explanation_draft: explanationDraft,
    algorithm_version: ALGORITHM_VERSION,
    calculation,
  }
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
