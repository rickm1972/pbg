/**
 * Dominant component selection by consumer exposure relevance (not highest NPR).
 */

import { PATHWAYS } from './explanation-pathway.mjs'

function componentText(component) {
  return `${component?.component_name ?? ''} ${component?.material ?? ''}`.toLowerCase()
}

function num(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function isFormulationComponent(c, inputs) {
  const t = componentText(c)
  return (
    Boolean(inputs?.is_formulation_product) &&
    /formulation|concentrate|pathway\s*2|soap formula|cleaning formula|liquid formulation/i.test(t)
  )
}

function isPackagingOnly(c) {
  const t = componentText(c)
  return /packaging|refill bottle|refill pouch|pouch only|container\)/i.test(t) && num(c.contact_intimacy) < 0.25
}

/** @returns {number} 0–100 consumer relevance weight */
export function consumerRelevanceScore(component, pathway, inputs) {
  const t = componentText(component)
  const ci = num(component.contact_intimacy)

  if (isPackagingOnly(component)) return 5

  switch (pathway) {
    case PATHWAYS.RINSE_OFF:
      if (isFormulationComponent(component, inputs)) return 100
      if (/bottle|container|packaging/i.test(t)) return 8
      return 20

    case PATHWAYS.ORAL_DIRECT:
      if (/straw|spout|mouthpiece|freesip|chug|sip/i.test(t)) return 100
      if (/lid.*straw|lid and straw|drinking/i.test(t)) return 95
      if (/bottle interior|interior.*liquid|beverage contact|vessel wall/i.test(t)) return 85
      if (/\blid\b/i.test(t) && !/gasket only/i.test(t)) return 65
      if (/gasket|seal/i.test(t)) return 45
      if (/handle|carry loop/i.test(t)) return 20
      return 40 + ci * 15

    case PATHWAYS.FOOD_CONTACT:
      if (/cooking surface|nonstick|coating.*valley|thermolon|terrabond|hexagonal peak/i.test(t)) return 100
      if (/food storage|container interior|meal prep|storage container/i.test(t)) return 92
      if (/\blid\b/i.test(t) && /gasket|seal|food storage/i.test(t)) return 78
      if (/gasket|seal/i.test(t) && ci >= 0.25) return 55
      if (/handle/i.test(t)) return 25
      if (/pan body|exterior|tri.ply|aluminum core/i.test(t)) return 15
      return 35 + ci * 20

    case PATHWAYS.HAND_ONLY:
      if (/handle|grip/i.test(t)) return 100
      return 30

    case PATHWAYS.DERMAL_FABRIC:
      if (/fabric|textile|fiber|yarn|garment body/i.test(t)) return 100
      if (/trim|thread|elastic|label/i.test(t)) return 40
      return 50

    case PATHWAYS.SKIN_LEAVE_ON:
      if (/formulation|active|ingredient|cream|lotion/i.test(t)) return 100
      return 40

    case PATHWAYS.INHALATION:
      if (/wax|fragrance|wick|scent|emission/i.test(t)) return 100
      return 40

    default:
      return 40 + ci * 30
  }
}

/**
 * Component consumers most directly contact in normal use.
 */
export function pickDominantConcernComponent(componentResults, pathway, inputs) {
  if (!componentResults?.length) return null

  let best = null
  let bestScore = -1

  for (const c of componentResults) {
    let score = consumerRelevanceScore(c, pathway, inputs)
    score += num(c.contact_intimacy) * 12
    if (/unknown|proprietary|undisclosed|unspecified|not disclosed/i.test(componentText(c))) {
      score += 8
    }
    if (/marketing|self.claim/i.test(c.material ?? '')) score += 3

    if (score > bestScore) {
      bestScore = score
      best = c
    }
  }

  return best
}

/** Lowest-hazard component with highest pathway relevance (excellent-tier lead). */
export function pickDominantSafeComponent(componentResults, pathway, inputs) {
  if (!componentResults?.length) return null

  const ranked = componentResults
    .map((c) => ({
      c,
      rel: consumerRelevanceScore(c, pathway, inputs),
      haz: num(c.material_hazard),
    }))
    .filter((x) => x.rel >= 40)
    .sort((a, b) => {
      if (a.haz !== b.haz) return a.haz - b.haz
      return b.rel - a.rel
    })

  if (ranked.length) return ranked[0].c

  return componentResults.reduce((best, c) => {
    if (!best || num(c.material_hazard) < num(best.material_hazard)) return c
    return best
  }, null)
}
