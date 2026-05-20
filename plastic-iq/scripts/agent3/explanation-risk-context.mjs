/**
 * Data-driven risk drivers for Concern / High Risk explanation copy (V2.3.3 scoring inputs).
 */

import { consumerComponentLabel } from './explanation-labels.mjs'

const CONCERN_SCORE_MAX = 54
const HIGH_RISK_SCORE_MAX = 29

function componentText(component) {
  return `${component?.component_name ?? ''} ${component?.material ?? ''}`.toLowerCase()
}

function hasPtfe(text) {
  if (/ptfe-free|pfas-free|without ptfe|no ptfe|non-ptfe|pfoa-free/i.test(text)) return false
  return (
    /\bptfe\b|conventional ptfe|ptfe\/teflon|titanium-reinforced ptfe|teflon-type|pro metal pro/.test(
      text,
    ) || (/\bteflon\b/.test(text) && !/teflon-free/.test(text))
  )
}

function hasUndisclosedCoating(text) {
  if (/subtype.*undisclosed|pa6.*undisclosed|grade unspecified|food-grade.*not confirmed/.test(text)) {
    return false
  }
  return (
    /unknown proprietary|composition undisclosed|chemistry undisclosed|exact composition undisclosed|unknown proprietary food-contact|proprietary (nonstick|ceramic).*undisclosed|coating.*(undisclosed|unverified)/.test(
      text,
    )
  )
}

function hasNylonFoodContact(text, contactIntimacy) {
  return contactIntimacy >= 0.7 && /\bnylon\b|polyamide|pa6|pa66/.test(text)
}

function hasTritanPlastic(text) {
  return /tritan|copolyester/.test(text)
}

function hasCeramicNonstickUnverified(text) {
  return (
    /ceramic nonstick|thermolon|terra\s*bond|terrabond|proprietary ceramic|nonstick coating valleys|nonstick coating/.test(
      text,
    ) && /undisclosed|unverified|proprietary|ptfe-free|pfas-free|not.*independently|composition/.test(text)
  )
}

function hasClassActionContext(inputs) {
  const blob = [
    inputs.normalization_notes,
    inputs.human_review_reason,
    JSON.stringify(inputs.layer_4a?.negative_adjustments ?? []),
    JSON.stringify(inputs.layer_4a_positive_reasoning ?? []),
  ]
    .filter(Boolean)
    .join('\n')
    .toLowerCase()
  return /class action|lawsuit|legal scrutiny|misleading claims|settlement|litigation over/.test(blob)
}

function materialDriverSentence(component) {
  if (!component) return null
  const text = componentText(component)
  const ci = Number(component.contact_intimacy) || 0

  if (hasPtfe(text)) {
    return 'The food-contact surface uses a PTFE (Teflon-type) fluoropolymer nonstick coating, which is a significant concern under normal cooking heat.'
  }
  if (hasCeramicNonstickUnverified(text)) {
    return 'The nonstick cooking surface relies on a proprietary ceramic coating marketed as PFAS-free, but its full composition has not been independently verified.'
  }
  if (hasUndisclosedCoating(text) && ci >= 0.5) {
    return 'A coating or surface that touches food uses undisclosed proprietary chemistry that has not been independently verified.'
  }
  if (hasNylonFoodContact(text, ci)) {
    return 'The parts that touch food are made of nylon plastic, which carries higher chemical exposure concern than wood, stainless steel, or silicone alternatives.'
  }
  if (hasTritanPlastic(text) && ci >= 0.7) {
    return 'Liquids contact a Tritan plastic bottle interior; the resin chemistry and long-term leaching profile are not as well established as glass or stainless steel.'
  }
  if (/silicone.*unverified|food-grade status unverified|grade not confirmed/.test(text) && ci >= 0.3) {
    return 'Silicone parts are described by the brand but lack confirmed food-grade verification in the evidence we reviewed.'
  }
  if (/^unknown\b|material not specified|not specified in any/.test(component.material?.toLowerCase() ?? '')) {
    return 'A food-contact part is made from a material that is not clearly identified in available product information.'
  }
  return null
}

function layer4aDriverSentences(layer4a) {
  const sentences = []
  const negatives = layer4a?.negative_adjustments ?? []

  for (const adj of negatives) {
    const reason = String(adj.reason ?? '').toLowerCase()
    if (/unknown proprietary food-contact coating/.test(reason)) {
      if (!layer4a?.unknown_coating_cap_applies) {
        sentences.push(
          'A food-contact coating uses proprietary chemistry that is not disclosed or independently verified.',
        )
      }
    } else if (/marketing language only/.test(reason)) {
      sentences.push(
        'Important safety claims appear in marketing materials but are not backed by independent third-party verification in the evidence we reviewed.',
      )
    } else if (/bpa-free claim only/.test(reason)) {
      sentences.push(
        'The brand emphasizes BPA-free plastic, but independent testing for related chemicals (such as BPS or BPF) is not documented.',
      )
    } else if (/undisclosed dye chemistry/.test(reason)) {
      sentences.push('Textile dye chemistry is not fully disclosed.')
    }
  }

  return [...new Set(sentences)]
}

/**
 * Collect ordered consumer-facing risk driver sentences from scoring inputs + component results.
 * @param {object} params
 * @param {object} params.inputs — approved scoring_inputs.inputs
 * @param {object[]} params.componentResults — from scoreNormalization calculation
 * @param {object} [params.calculation]
 */
export function collectRiskDrivers({ inputs, componentResults, calculation }) {
  const layer4a = inputs?.layer_4a ?? {}
  const drivers = []
  const seen = new Set()

  const add = (sentence, priority = 50) => {
    const s = sentence?.trim()
    if (!s || seen.has(s)) return
    seen.add(s)
    drivers.push({ priority, sentence: s })
  }

  if (layer4a.unknown_coating_cap_applies) {
    add(
      'Because a food-contact coating’s chemistry is undisclosed and unverified, the score is capped until that material is independently confirmed.',
      5,
    )
  }

  const highContact = (componentResults ?? []).filter((c) => Number(c.contact_intimacy) >= 0.7)
  const hasPtfeSurface = highContact.some((c) => hasPtfe(componentText(c)))
  if (hasPtfeSurface) {
    add(
      'The cooking surface uses PTFE (Teflon-type) fluoropolymer, a plastic nonstick coating with well-known heat and wear concerns.',
      10,
    )
  }

  const topByRisk =
    componentResults?.length > 0
      ? componentResults.reduce((best, c) => {
          const contrib = Number(c.final_npr) * Number(c.contact_intimacy)
          const bestContrib = best ? Number(best.final_npr) * Number(best.contact_intimacy) : -1
          return contrib > bestContrib ? c : best
        }, null)
      : null

  const ptfeComponent = highContact.find((c) => hasPtfe(componentText(c)))
  const top = ptfeComponent ?? topByRisk

  const matSentence = materialDriverSentence(topByRisk)
  if (matSentence) {
    const lower = matSentence.toLowerCase()
    const skipDupPtfe = hasPtfeSurface && /ptfe|teflon|fluoropolymer/.test(lower)
    const skipDupCap =
      layer4a.unknown_coating_cap_applies &&
      /undisclosed proprietary chemistry|food-contact coating uses proprietary/.test(lower)
    if (!skipDupPtfe && !skipDupCap) add(matSentence, 15)
  }

  for (const s of layer4aDriverSentences(layer4a)) add(s, 25)

  if (hasClassActionContext(inputs)) {
    add(
      'This product has faced legal scrutiny over prior safety or materials claims, which further undermines confidence in manufacturer marketing.',
      30,
    )
  }

  const heatIndicator = (componentResults ?? []).find((c) =>
    /thermo.spot|heat indicator/.test(componentText(c)),
  )
  if (heatIndicator && hasUndisclosedCoating(componentText(heatIndicator))) {
    add(
      'A heat-indicator dot on the pan uses undisclosed chemistry that also touches the cooking surface.',
      18,
    )
  }

  if (Number(topByRisk?.material_hazard) >= 0.6 && Number(topByRisk?.contact_intimacy) >= 0.9) {
    add(
      'High heat, fat, and direct food contact increase the chance that chemicals from the primary contact material migrate into food.',
      40,
    )
  }

  if (drivers.length === 0) {
    add(
      'Material disclosure is incomplete or unverified for the parts that matter most for food and drink contact.',
      99,
    )
  }

  return drivers
    .sort((a, b) => a.priority - b.priority)
    .map((d) => d.sentence)
    .slice(0, 4)
}

/**
 * @param {object} params
 */
export function buildConcernHighRiskExplanation({
  pacScore,
  tier,
  displayedRange,
  componentResults,
  inputs,
  brand,
}) {
  const [low, high] = displayedRange
  const rangeText = low === high ? `${low}` : `${low}–${high}`
  const brandLabel = brand?.trim() || 'This product'
  const highContactForLead = (componentResults ?? []).filter(
    (c) => Number(c.contact_intimacy) >= 0.7,
  )
  const ptfeLead = highContactForLead.find((c) => hasPtfe(componentText(c)))
  const highestByRisk = componentResults?.length
    ? componentResults.reduce((best, c) => {
        const contrib = Number(c.final_npr) * Number(c.contact_intimacy)
        const bestContrib = best ? Number(best.final_npr) * Number(best.contact_intimacy) : -1
        return contrib > bestContrib ? c : best
      }, null)
    : null
  const focusComponent = ptfeLead ?? highestByRisk
  const highestLabel = consumerComponentLabel(focusComponent)
  const drivers = collectRiskDrivers({ inputs, componentResults })

  const opener =
    pacScore <= HIGH_RISK_SCORE_MAX
      ? `This product scores ${pacScore} (${tier}) — among the lowest in our database for its category.`
      : `This product scores ${pacScore} (${tier}), reflecting serious material and disclosure concerns.`

  const contactVerb = /\b(heads|utensils|parts|valleys|peaks|tools)\b/.test(highestLabel)
    ? 'have'
    : 'has'
  const concernLead = `The main concern is ${highestLabel}, which ${contactVerb} the most direct food or drink contact.`
  const driverBlock = drivers.length ? ` ${drivers.join(' ')}` : ''
  const rangeClose = ` The published score could fall anywhere from ${rangeText}.`

  return `${opener} ${concernLead}${driverBlock}${rangeClose}`
}

export function isConcernOrHighRiskTier(tier, pacScore) {
  return tier === 'High Risk' || tier === 'Concern' || pacScore <= CONCERN_SCORE_MAX
}
