/**
 * Exposure pathway detection from evidence use-case facts (not category lookup).
 *
 * Priority:
 * 1. product_use_case + primary_contact_surface (authoritative use-case facts)
 * 2. Full evidence + normalization blob (secondary — word-boundary drinkware only)
 */

export const PATHWAYS = {
  ORAL_DIRECT: 'oral_direct',
  FOOD_CONTACT: 'food_contact_direct',
  SKIN_LEAVE_ON: 'skin_leave_on',
  RINSE_OFF: 'rinse_off',
  DERMAL_FABRIC: 'dermal_fabric',
  INHALATION: 'inhalation',
  HAND_ONLY: 'hand_only',
}

const RINSE_OFF_RE =
  /rinse.off|rinse off|dish soap|dishwashing|hand dish|laundry detergent|shampoo|body wash|surface cleaner|all.purpose cleaner|cleaning concentrate|diluted for/i

const INHALATION_RE =
  /air freshener|reed diffuser|room spray|scented candle|inhalation|fragrance release|aroma/i

const SKIN_LEAVE_ON_RE =
  /leave.on|lotion|moisturizer|serum|skincare|facial cream|body cream|applied to skin/i

const DERMAL_FABRIC_RE =
  /bedding|sleepwear|underwear|clothing|apparel|textile worn|fabric against skin|sheets|pillowcase|garment/i

/** Cookware, food storage, and direct food-prep contact (checked before drinkware). */
const FOOD_CONTACT_RE =
  /cookware|food contact|cooking surface|food storage|meal prep|container interior|direct food|seal point|stovetop|frying pan|skillet|bakeware|food container|grill|oven|campfire|cast iron.*cook|sauté|saute/i

/** Drinkware and direct oral contact — word boundaries so "cookware" / "not for drinking" do not false-match. */
const ORAL_DIRECT_RE =
  /\b(drink|drinks|drinking|beverage|beverages|sip|sips|sipping|straw|spout|mouthpiece|sippy)\b|water bottle|travel mug|coffee mug|every sip|liquid you drink|bottle interior|vessel interior.*\bliquid\b/i

const HAND_ONLY_RE = /utensil handle|tool handle|hand contact only|grip only/i

const DRINKWARE_FALLBACK_RE = /\b(bottle|mug|tumbler)\b/i
const COOKWARE_FALLBACK_RE = /\b(pan|pot|skillet)\b|cookware|\bcook\b/i

function matches(re, text) {
  return re.test(String(text ?? '').toLowerCase())
}

/**
 * @param {object|null} evidence — approved product_evidence row
 * @param {object} inputs — scoring_inputs.inputs
 */
export function extractEvidenceContext(evidence, inputs) {
  const facts = Array.isArray(evidence?.facts) ? evidence.facts : []
  const factValue = (key) => {
    const row = facts.find((f) => f.fact_key === key)
    if (!row) return ''
    const v = row.fact_value
    return typeof v === 'string' ? v : v != null ? String(v) : ''
  }

  const productUseCase = factValue('product_use_case') || inputs?.normal_intended_use || ''
  const primaryContactSurface =
    factValue('primary_contact_surface') || inputs?.primary_contact_surface || ''

  const factBlob = facts
    .map((f) => `${f.fact_key} ${f.fact_value ?? ''} ${f.excerpt ?? ''}`)
    .join(' ')

  const blob = [
    productUseCase,
    primaryContactSurface,
    factBlob,
    inputs?.normal_intended_use,
    inputs?.common_foreseeable_use,
    inputs?.normalization_notes,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  return {
    productUseCase,
    primaryContactSurface,
    blob,
    isFormulation: Boolean(inputs?.is_formulation_product),
  }
}

/**
 * Classify pathway from authoritative use-case fields first, then full blob.
 *
 * @param {ReturnType<typeof extractEvidenceContext>} ctx
 * @returns {string} PATHWAYS value
 */
export function detectExposurePathway(ctx) {
  const pcs = String(ctx.primaryContactSurface).toLowerCase()
  const puc = String(ctx.productUseCase).toLowerCase()
  /** Authoritative: Agent 1/2 use-case facts only */
  const authoritative = `${puc} ${pcs}`.trim()
  const combined = `${authoritative} ${ctx.blob}`.trim()

  if (ctx.isFormulation || matches(RINSE_OFF_RE, authoritative) || matches(RINSE_OFF_RE, combined)) {
    return PATHWAYS.RINSE_OFF
  }

  if (matches(INHALATION_RE, authoritative) || matches(INHALATION_RE, combined)) {
    return PATHWAYS.INHALATION
  }

  if (matches(SKIN_LEAVE_ON_RE, authoritative) || matches(SKIN_LEAVE_ON_RE, combined)) {
    return PATHWAYS.SKIN_LEAVE_ON
  }

  if (matches(DERMAL_FABRIC_RE, authoritative) || matches(DERMAL_FABRIC_RE, combined)) {
    return PATHWAYS.DERMAL_FABRIC
  }

  // Food contact before oral — cookware use-case must not lose to stray "drink" in other facts
  if (matches(FOOD_CONTACT_RE, authoritative)) {
    return PATHWAYS.FOOD_CONTACT
  }

  if (matches(ORAL_DIRECT_RE, authoritative)) {
    return PATHWAYS.ORAL_DIRECT
  }

  if (matches(HAND_ONLY_RE, authoritative) || matches(HAND_ONLY_RE, combined)) {
    return PATHWAYS.HAND_ONLY
  }

  if (matches(FOOD_CONTACT_RE, combined)) {
    return PATHWAYS.FOOD_CONTACT
  }

  if (matches(ORAL_DIRECT_RE, combined)) {
    return PATHWAYS.ORAL_DIRECT
  }

  if (ctx.isFormulation) return PATHWAYS.RINSE_OFF
  if (matches(DRINKWARE_FALLBACK_RE, combined)) return PATHWAYS.ORAL_DIRECT
  if (matches(COOKWARE_FALLBACK_RE, combined)) return PATHWAYS.FOOD_CONTACT

  return PATHWAYS.FOOD_CONTACT
}

const PATHWAY_COPY = {
  [PATHWAYS.ORAL_DIRECT]: {
    name: 'direct oral contact',
    exposureVerb: 'contacts what you drink',
    primaryConcern: 'what you drink through',
    excellentLead: 'direct oral contact',
    goodHoldback: 'during normal drinking use',
    concernContact: 'the most direct oral contact',
    safeContext: 'drinking',
  },
  [PATHWAYS.FOOD_CONTACT]: {
    name: 'direct food contact',
    exposureVerb: 'contacts food during use',
    primaryConcern: 'food contact during use',
    excellentLead: 'direct food contact',
    goodHoldback: 'in normal kitchen use',
    concernContact: 'the most direct food contact',
    safeContext: 'food contact',
  },
  [PATHWAYS.RINSE_OFF]: {
    name: 'brief rinse-off contact',
    exposureVerb: 'contacts dishes and hands briefly during use',
    primaryConcern: 'contact during dishwashing',
    excellentLead: 'typical hand dishwashing with brief, rinse-off contact',
    goodHoldback: 'during dishwashing',
    concernContact: 'the most relevant contact during dishwashing',
    safeContext: 'dishwashing',
  },
  [PATHWAYS.SKIN_LEAVE_ON]: {
    name: 'direct skin contact',
    exposureVerb: 'stays on skin during use',
    primaryConcern: 'direct skin contact during use',
    excellentLead: 'leave-on skin contact',
    goodHoldback: 'with leave-on skin contact',
    concernContact: 'the most direct skin contact',
    safeContext: 'skin contact',
  },
  [PATHWAYS.DERMAL_FABRIC]: {
    name: 'dermal contact through fabric',
    exposureVerb: 'contacts skin through the fabric during wear',
    primaryConcern: 'skin contact during wear',
    excellentLead: 'dermal contact through the fabric',
    goodHoldback: 'during regular wear',
    concernContact: 'the closest skin contact during wear',
    safeContext: 'wear',
  },
  [PATHWAYS.INHALATION]: {
    name: 'inhalation exposure',
    exposureVerb: 'may be inhaled during use',
    primaryConcern: 'inhalation exposure during use',
    excellentLead: 'typical inhalation exposure',
    goodHoldback: 'with typical inhalation exposure',
    concernContact: 'the primary inhalation exposure pathway',
    safeContext: 'inhalation',
  },
  [PATHWAYS.HAND_ONLY]: {
    name: 'hand contact only',
    exposureVerb: 'contacts hands during use',
    primaryConcern: 'hand contact during use',
    excellentLead: 'brief hand contact',
    goodHoldback: 'during normal handling',
    concernContact: 'the main hand-contact part',
    safeContext: 'handling',
  },
}

export function pathwayCopy(pathway) {
  return PATHWAY_COPY[pathway] ?? PATHWAY_COPY[PATHWAYS.FOOD_CONTACT]
}
