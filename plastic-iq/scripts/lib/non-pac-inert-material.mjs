/**
 * Non-PAC inert food-contact materials — shared Agent 2 description logic.
 */

/**
 * @param {string} materialName
 * @param {string | null | undefined} materialId
 * @param {{ categoryHint?: string }} [options]
 */
export function isNonPacInertFoodContactMaterial(materialName, materialId, options = {}) {
  const name = String(materialName ?? '').toLowerCase()
  const cat = String(options.categoryHint ?? '').toLowerCase()
  if (
    /ptfe|pfas|pfoa|nonstick coating|sol.gel|proprietary ceramic|plastic|silicone|polymer/.test(
      `${name} ${cat}`,
    )
  ) {
    return false
  }
  const id = String(materialId ?? '').toLowerCase()
  if (
    /cast_iron|stainless_steel|carbon_steel|glass|borosilicate|enameled_cast|tempered_glass/.test(
      id,
    )
  ) {
    return true
  }
  return /cast iron|stainless steel|carbon steel|borosilicate|\bglass\b|enameled cast/.test(name)
}

/**
 * @param {string} labels
 */
export function formatUseConditionsForPublicSentence(labels) {
  if (!labels?.length) return 'typical household use'
  const lower = labels.map((l) => l.toLowerCase().trim())
  const hasFat = lower.some((l) => /fat exposure/i.test(l))
  const coreLabels = lower.filter((l) => !/fat exposure/i.test(l))
  const hasOven = coreLabels.some((l) => /oven/i.test(l))
  const hasStovetop = coreLabels.some((l) => /stovetop/i.test(l))
  if (hasOven && hasStovetop) {
    return hasFat ? 'oven and stovetop heat, including fat exposure' : 'oven and stovetop heat'
  }
  let core
  if (!coreLabels.length) core = 'typical household use'
  else if (coreLabels.length === 1) core = coreLabels[0]
  else if (coreLabels.length === 2) core = `${coreLabels[0]} and ${coreLabels[1]}`
  else {
    const last = coreLabels[coreLabels.length - 1]
    const rest = coreLabels.slice(0, -1).join(', ')
    core = `${rest}, and ${last}`
  }
  return hasFat ? `${core}, including fat exposure` : core
}

/**
 * @param {string} materialPhrase
 * @param {string} useSentence
 */
export function nonPacInertMaterialClause(materialPhrase, useSentence) {
  return `${materialPhrase} is not a plastic- or PFAS-based food-contact material, so PAC exposure concern remains minimal even with ${useSentence}.`
}

export function nonPacInertScoreContextSentence() {
  return 'The PAC Safety Score reflects disclosed materials and typical cookware use conditions.'
}
