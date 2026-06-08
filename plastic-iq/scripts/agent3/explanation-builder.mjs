/**
 * Why This Score — principle-based explanation (materials + pathway only).
 * 3–5 sentences, second person, concrete language. Scores unchanged.
 */

import { consumerComponentLabel, consumerPrimaryMaterialLabel } from './explanation-labels.mjs'
import { pickDominantConcernComponent, pickDominantSafeComponent } from './explanation-dominant.mjs'
import {
  detectExposurePathway,
  extractEvidenceContext,
  PATHWAYS,
} from './explanation-pathway.mjs'
import { describeScoreChangeYou, describeUnknownYou } from './explanation-uncertainty.mjs'

const EXCELLENT_THRESHOLD = 90
const GOOD_THRESHOLD = 75
const CONCERN_SCORE_MAX = 54

function componentText(component) {
  return `${component?.component_name ?? ''} ${component?.material ?? ''}`.toLowerCase()
}

function joinSentences(sentences) {
  const trimmed = sentences.map((s) => String(s ?? '').trim()).filter(Boolean)
  return trimmed.slice(0, 5).join(' ')
}

/** Concrete noun phrase for the part or material driving the score. */
function concreteDriverPhrase(component, inputs, pathway) {
  if (!component) return 'the main contact surface'

  const text = componentText(component)
  const label = consumerComponentLabel(component, inputs, pathway).replace(/^the /i, '')

  if (/cast iron/i.test(text)) return 'cast iron'
  if (/terrabond/i.test(text)) return 'TerraBond nonstick coating'
  if (/thermolon/i.test(text)) return 'Thermolon ceramic coating'
  if (/ptfe|teflon/i.test(text) && !/ptfe-free|pfas-free/i.test(text)) {
    return 'PTFE (Teflon-type) nonstick coating'
  }
  if (/proprietary ceramic|ceramic nonstick|ceramic non-stick/i.test(text) && /undisclosed|unverified|proprietary/i.test(text)) {
    return 'proprietary ceramic nonstick coating'
  }
  if (
    /saponified|decyl glucoside|coco-glucoside|plant.and.mineral|pathway\s*2|soap formula|cleaning formulation|concentrate/i.test(
      text,
    )
  ) {
    return consumerPrimaryMaterialLabel(component, inputs, pathway)
  }
  if (/stainless/i.test(text)) return 'stainless steel'
  if (/glass|borosilicate/i.test(text)) return 'glass'
  if (/tritan|copolyester/i.test(text)) return 'Tritan plastic'
  if (/silicone/i.test(text)) return 'silicone'
  if (/nylon/i.test(text)) return 'nylon'

  const clause = (component.material ?? '').split(/[;,]/)[0].trim()
  if (clause && !/unknown|undisclosed|unspecified|proprietary/i.test(clause)) {
    return clause.length > 60 ? clause.slice(0, 57).trim() + '…' : clause
  }

  return label
}

/** How the product reaches the user — for "Your ___" clauses. */
/** Second sentence: name the material and how you encounter it. */
function driverSentence(pathway, material) {
  switch (pathway) {
    case PATHWAYS.ORAL_DIRECT:
      return `Your drinks flow through ${material}.`
    case PATHWAYS.RINSE_OFF:
      return `When you wash dishes, ${material} is what touches your plates and hands.`
    case PATHWAYS.SKIN_LEAVE_ON:
      return `${material} stays on your skin during use.`
    case PATHWAYS.DERMAL_FABRIC:
      return `Your skin meets ${material} through the fabric when you wear it.`
    case PATHWAYS.INHALATION:
      return `Your air at home picks up chemicals from ${material}.`
    case PATHWAYS.HAND_ONLY:
      return `Your hands touch ${material} when you use it.`
    default:
      return `You cook on ${material}.`
  }
}

/** One sentence: what this material means for you. */
function materialMeaningYou(component, pathway, scoreBand) {
  const text = componentText(component)
  const isLow = scoreBand === 'low'

  if (/cast iron/i.test(text)) {
    return isLow
      ? 'Cast iron can rust or carry old seasoning chemistry if abused, but it does not rely on a synthetic nonstick coating.'
      : 'At stove and oven heat, seasoned cast iron does not depend on a polymer coating, so you are not betting on mystery coating chemicals leaching into your meals.'
  }

  if (/terrabond/i.test(text) || (/proprietary ceramic/i.test(text) && isLow)) {
    return 'Your food sits on that coating every time you cook, so an unverified recipe matters more than undisclosed metal on the handle.'
  }

  if (/ptfe|teflon/i.test(text) && !/free/i.test(text)) {
    return 'PTFE coatings can break down with high heat and scratched use, which is why many families are cautious about cooking on them daily.'
  }

  if (/thermolon|sol.gel|ceramic nonstick/i.test(text) && isLow) {
    return 'Ceramic marketing often says PFAS-free, but without a verified ingredient list you still do not know what could leach at heat.'
  }

  if (pathway === PATHWAYS.RINSE_OFF) {
    return isLow
      ? 'Because the product rinses off quickly, the listed surfactants, preservatives, and fragrance matter more than the bottle plastic.'
      : 'You rinse this off within seconds, so what is in the formula matters more than leaching from the packaging plastic.'
  }

  if (/stainless/i.test(text) && !isLow) {
    return 'Stainless at the cooking surface resists rust and does not use a nonstick polymer layer, which keeps everyday leaching low.'
  }

  if (/glass/i.test(text) && !isLow) {
    return 'Glass does not need a nonstick coating, so you avoid the usual coating chemistry questions at the food contact point.'
  }

  if (/tritan|plastic/i.test(text) && pathway === PATHWAYS.ORAL_DIRECT) {
    return isLow
      ? 'Hot drinks and repeated washing can increase what may leach from plastic parts you sip through.'
      : 'For cold or room-temperature drinks, well-made BPA-free Tritan is a relatively stable choice versus older plastics.'
  }

  if (/unknown|undisclosed|proprietary|unspecified/i.test(text)) {
    return 'When the part that touches your food or drink is not fully named, you are left guessing what could leach in real kitchen use.'
  }

  return isLow
    ? 'That part sees enough contact that any undisclosed chemistry is worth taking seriously.'
    : 'That material is well understood for how you actually use it, which keeps everyday exposure low.'
}

/** One sentence: what makes a high-scoring product specifically clean. */
function whatMakesItCleanYou(component, inputs, pathway, confidenceInterval, layer4b, brandLabel) {
  const text = componentText(component)
  const brand = brandLabel?.trim() || 'The brand'

  if (
    confidenceInterval <= 0 &&
    (/^full(y)?\s+disclosed$/i.test(String(layer4b?.transparency_badge ?? '')) ||
      !layer4b?.transparency_badge)
  ) {
    if (/cast iron/i.test(text)) {
      return `${brand} names the cast iron and seasoning approach openly, and there is no hidden nonstick layer between your food and the pan.`
    }
    if (pathway === PATHWAYS.RINSE_OFF) {
      return 'The brand lists the full concentrate formula, so you can read every surfactant and preservative before it touches your dishes.'
    }
    return 'Every part and ingredient that touches your food or drink is on the label, so you are not guessing about hidden liners or coatings.'
  }

  if (/cast iron/i.test(text)) {
    return 'There is no synthetic nonstick coating to worry about — just iron and a seasoning layer you control.'
  }

  if (/glass/i.test(text)) {
    return 'Your food sits on glass without a polymer nonstick coating in the way.'
  }

  if (/stainless/i.test(text) && pathway === PATHWAYS.FOOD_CONTACT) {
    return 'You are cooking on bare stainless rather than an undisclosed polymer nonstick layer.'
  }

  if (pathway === PATHWAYS.RINSE_OFF) {
    return 'Brief rinse-off contact plus a fully listed formula is why the materials score stays high even when ingredient choices vary.'
  }

  return 'The disclosed materials match how your family actually uses this product, without mystery coatings at the contact point.'
}

function capHoldbackYou(layer4a) {
  if (!layer4a?.unknown_coating_cap_applies) return null
  return 'Your score is capped until that coating chemistry is verified — that rule is a big part of why you land here, not just the metal underneath.'
}

function minorPartYou(dominantConcern, pathway, inputs) {
  if (!dominantConcern) return null
  const low = Number(dominantConcern.final_npr) < 0.25
  const limited = Number(dominantConcern.contact_intimacy) < 0.5
  if (!low && !limited) return null

  const part = consumerComponentLabel(dominantConcern, inputs, pathway).replace(/^the /i, '')
  return `${part} barely touches your food, so it does not move your score much.`
}

function unknownAndChangeYou({
  pacScore,
  tier,
  displayedRange,
  unknown,
  layer4a,
  confidenceInterval,
}) {
  if (!unknown) return null

  const change = describeScoreChangeYou({
    pacScore,
    tier,
    displayedRange,
    unknownPhrase: unknown,
    layer4a,
    confidenceInterval,
  })

  if (layer4a?.unknown_coating_cap_applies) {
    const tail = change ? ` ${change}` : ''
    return `Your score stays capped because we still do not know ${unknown}.${tail}`
  }

  if (change) {
    return `We still do not know ${unknown}. ${change}`
  }

  return `We still do not know ${unknown}.`
}

function flaggedIngredientNote(inputs) {
  const blob = [
    inputs?.formulation_pathway?.ingredient_notes,
    JSON.stringify(inputs?.formulation_pathway?.flagged_ingredients ?? []),
    JSON.stringify(inputs?.layer_4a?.negative_adjustments ?? ''),
  ]
    .join(' ')
    .toLowerCase()

  if (/fragrance|parfum|synthetic scent/i.test(blob)) {
    return 'Synthetic fragrance and related additives in the formula are what pull Ingredient Safety down — not the plastic bottle.'
  }
  if (/preservative|methylisothiazolinone|\bmit\b|cmit/i.test(blob)) {
    return 'Preservatives and surfactant choices in the listed formula are what matter for Ingredient Safety.'
  }
  return 'Read the listed ingredients if fragrance, preservatives, or scent are important for your family.'
}

function buildDualFormulationExplanation({
  brandLabel,
  pacScore,
  tier,
  its,
  pathway,
  inputs,
  componentResults,
  confidenceInterval,
  displayedRange,
}) {
  const driver = pickDominantConcernComponent(componentResults, pathway, inputs)
  const material = concreteDriverPhrase(driver, inputs, pathway)
  const sentences = [
    `${brandLabel} scores ${pacScore} on Materials Safety and ${its} on Ingredient Safety.`,
    driverSentence(pathway, material),
    materialMeaningYou(driver, pathway, its < pacScore - 5 ? 'low' : 'high'),
  ]

  if (its < pacScore - 5) {
    sentences.push(flaggedIngredientNote(inputs))
  } else {
    sentences.push(
      whatMakesItCleanYou(
        pickDominantSafeComponent(componentResults, pathway, inputs) ?? driver,
        inputs,
        pathway,
        confidenceInterval,
        inputs?.layer_4b,
        brandLabel,
      ),
    )
  }

  if (confidenceInterval > 0) {
    const unknown = describeUnknownYou({
      inputs,
      componentResults,
      dominantComponent: driver,
      layer4b: inputs?.layer_4b,
    })
    const block = unknownAndChangeYou({
      pacScore,
      tier,
      displayedRange,
      unknown,
      layer4a: inputs?.layer_4a,
      confidenceInterval,
    })
    if (block) sentences.push(block)
  }

  return joinSentences(sentences)
}

function buildLowScoreExplanation({
  brandLabel,
  pacScore,
  tier,
  pathway,
  inputs,
  componentResults,
  confidenceInterval,
  displayedRange,
  layer4a,
}) {
  const driver = pickDominantConcernComponent(componentResults, pathway, inputs)
  const material = concreteDriverPhrase(driver, inputs, pathway)
  const sentences = [
    `${brandLabel} scores ${pacScore}.`,
    `${driverSentence(pathway, material).replace(/\.$/, '')} — that is what drives your score down.`,
    materialMeaningYou(driver, pathway, 'low'),
  ]

  const unknown = describeUnknownYou({
    inputs,
    componentResults,
    dominantComponent: driver,
    layer4b: inputs?.layer_4b,
  })
  const block = unknownAndChangeYou({
    pacScore,
    tier,
    displayedRange,
    unknown,
    layer4a,
    confidenceInterval,
  })
  if (block) sentences.push(block)
  else if (capHoldbackYou(layer4a)) sentences.push(capHoldbackYou(layer4a))

  return joinSentences(sentences)
}

function buildHighScoreExplanation({
  brandLabel,
  pacScore,
  pathway,
  inputs,
  componentResults,
  confidenceInterval,
  displayedRange,
  tier,
}) {
  const driver = pickDominantSafeComponent(componentResults, pathway, inputs)
  const concern = pickDominantConcernComponent(componentResults, pathway, inputs)
  const material = concreteDriverPhrase(driver ?? concern, inputs, pathway)
  const layer4b = inputs?.layer_4b ?? {}
  const layer4a = inputs?.layer_4a ?? {}

  const sentences = [
    `${brandLabel} scores ${pacScore}.`,
    driverSentence(pathway, material),
    materialMeaningYou(driver ?? concern, pathway, 'high'),
    whatMakesItCleanYou(driver ?? concern, inputs, pathway, confidenceInterval, layer4b, brandLabel),
  ]

  const unknown = describeUnknownYou({
    inputs,
    componentResults,
    dominantComponent: concern,
    layer4b,
  })
  if (confidenceInterval > 0 && unknown) {
    const block = unknownAndChangeYou({
      pacScore,
      tier,
      displayedRange,
      unknown,
      layer4a,
      confidenceInterval,
    })
    if (block) sentences.push(block)
  } else {
    const minor = minorPartYou(concern, pathway, inputs)
    if (minor) sentences.push(minor)
  }

  return joinSentences(sentences)
}

function buildMidScoreExplanation({
  brandLabel,
  pacScore,
  tier,
  pathway,
  inputs,
  componentResults,
  confidenceInterval,
  displayedRange,
}) {
  const driver = pickDominantConcernComponent(componentResults, pathway, inputs)
  const material = concreteDriverPhrase(driver, inputs, pathway)
  const layer4a = inputs?.layer_4a ?? {}

  const sentences = [
    `${brandLabel} scores ${pacScore}.`,
    `${driverSentence(pathway, material).replace(/\.$/, '')} — that is the main reason you are not in the 90s.`,
    materialMeaningYou(driver, pathway, 'mid'),
  ]

  const unknown = describeUnknownYou({
    inputs,
    componentResults,
    dominantComponent: driver,
    layer4b: inputs?.layer_4b,
  })
  const block = unknownAndChangeYou({
    pacScore,
    tier,
    displayedRange,
    unknown,
    layer4a,
    confidenceInterval,
  })
  if (block) sentences.push(block)

  return joinSentences(sentences)
}

/**
 * @param {object} params
 */
export function buildExplanationDraft({
  pacScore,
  tier,
  confidenceInterval,
  displayedRange,
  componentResults,
  inputs,
  brand,
  evidence = null,
  ingredientTransparencyScore = null,
}) {
  const ctx = extractEvidenceContext(evidence, inputs)
  const pathway = detectExposurePathway(ctx)
  const brandLabel = brand?.trim() || 'This product'
  const layer4a = inputs?.layer_4a ?? {}

  const its =
    ingredientTransparencyScore ?? inputs?.formulation_pathway?.ingredient_transparency_score ?? null
  const dualFormulation =
    Boolean(inputs?.is_formulation_product) && its != null && Number.isFinite(Number(its))

  if (dualFormulation) {
    return buildDualFormulationExplanation({
      brandLabel,
      pacScore,
      tier,
      its: Number(its),
      pathway,
      inputs,
      componentResults,
      confidenceInterval,
      displayedRange,
    })
  }

  const isLow =
    tier === 'High Risk' || tier === 'Concern' || pacScore <= CONCERN_SCORE_MAX || layer4a.unknown_coating_cap_applies

  if (isLow) {
    return buildLowScoreExplanation({
      brandLabel,
      pacScore,
      tier,
      pathway,
      inputs,
      componentResults,
      confidenceInterval,
      displayedRange,
      layer4a,
    })
  }

  if (pacScore >= EXCELLENT_THRESHOLD) {
    return buildHighScoreExplanation({
      brandLabel,
      pacScore,
      pathway,
      inputs,
      componentResults,
      confidenceInterval,
      displayedRange,
      tier,
    })
  }

  if (pacScore >= GOOD_THRESHOLD) {
    return buildMidScoreExplanation({
      brandLabel,
      pacScore,
      tier,
      pathway,
      inputs,
      componentResults,
      confidenceInterval,
      displayedRange,
    })
  }

  return buildLowScoreExplanation({
    brandLabel,
    pacScore,
    tier,
    pathway,
    inputs,
    componentResults,
    confidenceInterval,
    displayedRange,
    layer4a,
  })
}

export function isConcernOrHighRiskTier(tier, pacScore) {
  return tier === 'High Risk' || tier === 'Concern' || pacScore <= CONCERN_SCORE_MAX
}
