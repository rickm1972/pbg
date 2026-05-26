/**
 * Specific unknowns and score-change language (second person, concrete).
 */

function componentText(component) {
  return `${component?.component_name ?? ''} ${component?.material ?? ''}`.toLowerCase()
}

function specificCoatingName(component) {
  const t = componentText(component)
  if (/terrabond/i.test(t)) return 'TerraBond coating'
  if (/thermolon/i.test(t)) return 'Thermolon ceramic coating'
  if (/thermo.spot/i.test(t)) return 'Thermo-Spot indicator coating'
  if (/sol.gel/i.test(t)) return 'sol-gel ceramic coating'
  return 'the proprietary food-contact coating'
}

/**
 * What is specifically unknown — short phrase for embedding in a sentence.
 * @returns {string|null}
 */
export function describeUnknownYou({ inputs, componentResults, dominantComponent, layer4b }) {
  const layer4a = inputs?.layer_4a ?? {}
  const t = dominantComponent ? componentText(dominantComponent) : ''

  if (layer4a.unknown_coating_cap_applies) {
    const coating = (componentResults ?? []).find((c) =>
      /terrabond|thermo.spot|thermolon|terra\s*bond|unknown proprietary|proprietary.*coating/i.test(
        componentText(c),
      ),
    )
    const name = coating ? specificCoatingName(coating) : 'the proprietary food-contact coating'
    return `the full ingredient list for ${name}`
  }

  if (/terrabond/i.test(t)) return 'the full TerraBond coating recipe beyond marketing claims'
  if (/thermo.spot|heat indicator/i.test(t) && /undisclosed|unknown|proprietary/i.test(t)) {
    return 'what the Thermo-Spot heat-indicator coating is made of'
  }
  if (/sol.gel|caraway/i.test(t) && /proprietary|undisclosed|silicon dioxide/i.test(t)) {
    return 'the full sol-gel ceramic coating chemistry beyond the silicon dioxide base'
  }
  if (/kikcoin|finishing|oil|beeswax|oiled/i.test(t) && /unknown|unspecified|not disclosed/i.test(t)) {
    return 'which finishing oil or wax was used (all likely options are low risk)'
  }
  if (/bristle|brush head/i.test(t) && /unknown|unspecified|could be|nylon|natural fiber/i.test(t)) {
    return 'whether the basting brush bristles are nylon, silicone, or natural fiber'
  }
  if (/resin unspecified|pcr|post.consumer|recycled plastic unspecified/i.test(t)) {
    return 'which recycled plastic resin is in the packaging'
  }
  if (/silicone.*unverified|food.grade.*not|grade unspecified/i.test(t)) {
    return 'whether the silicone is confirmed food-grade'
  }
  if (/tritan|copolyester/i.test(t) && /unspecified|unverified/i.test(t)) {
    return 'independent leach testing on the Tritan plastic'
  }
  if (/handle/i.test(t) && /not disclosed|undisclosed|unspecified/i.test(t)) {
    return 'exactly what metal or coating is on the handle'
  }
  if (/grade unspecified|304 or 316|18\/8 inferred/i.test(t) && /stainless/i.test(t)) {
    return 'whether the stainless steel is 304 or 316 grade'
  }
  if (dominantComponent && /unknown|proprietary|undisclosed|unspecified/i.test(t)) {
    const part = dominantComponent.component_name?.trim() || 'a main contact part'
    return `what ${part} is actually made of`
  }

  const badge = layer4b?.transparency_badge ?? ''
  if (badge === 'Material Uncertain') {
    return 'verified material IDs on the parts your family touches most'
  }
  if (badge === 'Documentation Incomplete') {
    return 'minor details like resin grade on non-contact parts'
  }

  return null
}

/**
 * What would move the score — one second-person sentence.
 */
export function describeScoreChangeYou({
  pacScore,
  tier,
  displayedRange,
  unknownPhrase,
  layer4a,
  confidenceInterval,
}) {
  if (!unknownPhrase) return null

  const [low, high] = displayedRange ?? [pacScore, pacScore]
  const rangeNote =
    confidenceInterval > 0 && low !== high ? ` Your score could land anywhere from ${low} to ${high} until then.` : ''

  if (layer4a?.unknown_coating_cap_applies) {
    return `Publishing and independently verifying that coating chemistry is the main step that could raise your score${rangeNote}.`
  }

  if (pacScore <= 29) {
    return `Confirming ${unknownPhrase} would be the first step before your score could move meaningfully higher${rangeNote}.`
  }

  if (pacScore <= 54 || tier === 'Concern') {
    return `If ${unknownPhrase} were confirmed and checked out, your score could move higher${rangeNote}.`
  }

  if (confidenceInterval > 0) {
    return `Clear answers on ${unknownPhrase} would narrow where your score lands${rangeNote}.`
  }

  return `Clear answers on ${unknownPhrase} could shift your score${rangeNote}.`
}

/** @deprecated — regulatory tone; not used by principle-based builder */
export function describeSpecificUncertainty(params) {
  const u = describeUnknownYou(params)
  if (!u) return null
  return `The range reflects ${u}.`
}

export function fullDisclosureClause() {
  return 'Every material that touches your food is listed on the label.'
}
