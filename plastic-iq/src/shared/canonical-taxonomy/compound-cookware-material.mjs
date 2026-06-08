/**
 * Decompose Agent 1 compound cookware material_identity strings into role-specific canonical IDs.
 * Never match the full compound string as a single taxonomy entry.
 */

/** @typedef {'5_ply' | '3_ply' | 'clad' | 'bonded'} ConstructionDescriptor */

/**
 * @typedef {Object} CompoundCookwareParse
 * @property {boolean} isCompound
 * @property {ConstructionDescriptor[]} constructionDescriptors
 * @property {string | null} primaryContactCanonicalId
 * @property {string | null} substrateCanonicalId
 * @property {string[]} secondaryCoreMaterialIds — aluminum_core, stainless_steel_body, etc.
 * @property {string} parseRuleId
 */

const KNOWN_MATERIAL_TOKEN_RE =
  /stainless|cast_iron|carbon_steel|graphite|aluminum|aluminium|ptfe|teflon|ceramic|glass|borosilicate|enameled|enamel/i

/**
 * @param {string} raw
 */
export function normalizeCompoundMaterialRaw(raw) {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
}

/**
 * @param {string} normalized
 */
export function isCompoundCookwareMaterialString(normalized) {
  if (!normalized) return false
  if (!KNOWN_MATERIAL_TOKEN_RE.test(normalized)) return false

  let hits = 0
  if (/stainless/.test(normalized)) hits++
  if (/graphite/.test(normalized)) hits++
  if (/aluminum|aluminium/.test(normalized)) hits++
  if (/cast_iron|carbon_steel/.test(normalized)) hits++
  if (/\bptfe\b|teflon|ceramic_nonstick|sol_gel/.test(normalized)) hits++

  if (hits >= 2) return true
  if (/stainless[_\s-]*steel[_\s-]*(interior|cooking|food)/.test(normalized)) return true
  if (/interior[_\s-]*stainless|stainless[_\s-]*interior/.test(normalized)) return true
  if (/\d[_\s-]?ply/.test(normalized) && /stainless|graphite|aluminum/.test(normalized)) return true
  return false
}

/**
 * @param {string} normalized
 */
function extractConstructionDescriptors(normalized) {
  /** @type {ConstructionDescriptor[]} */
  const out = []
  if (/5[_\s-]?ply|five[_\s-]?ply/.test(normalized)) out.push('5_ply')
  if (/3[_\s-]?ply|three[_\s-]?ply/.test(normalized)) out.push('3_ply')
  if (/\bclad\b|bonded/.test(normalized)) out.push('clad')
  return out
}

/**
 * @param {string} normalized
 */
function resolveStainlessPrimaryCanonicalId(normalized) {
  if (/stainless[_\s-]*steel[_\s-]*316\b|\b316\b|18[_\s\/-]*10/.test(normalized)) {
    return 'stainless_steel_316'
  }
  if (/stainless[_\s-]*steel[_\s-]*304\b|\b304\b|18[_\s\/-]*8/.test(normalized)) {
    return 'stainless_steel_304'
  }
  if (/stainless[_\s-]*steel[_\s-]*18[_\s-]*10\b/.test(normalized)) {
    return 'stainless_steel_18_10'
  }
  if (/stainless[_\s-]*steel[_\s-]*18[_\s-]*8\b/.test(normalized)) {
    return 'stainless_steel_18_8'
  }
  return 'stainless_steel_unspecified'
}

/**
 * @param {string} normalized
 */
function hasStainlessFoodContactRole(normalized) {
  if (/stainless[_\s-]*steel[_\s-]*(interior|cooking|food[-_]?contact)/.test(normalized)) {
    return true
  }
  if (/(?:interior|cooking|food[-_]?contact)[_\s-]*stainless/.test(normalized)) {
    return true
  }
  if (/stainless[_\s-]*interior/.test(normalized)) {
    return true
  }
  if (/stainless[_\s-]*steel/.test(normalized) && !/\bptfe\b|nonstick|ceramic_nonstick/.test(normalized)) {
    if (/graphite|aluminum|aluminium|\d[_\s-]?ply|core|layer|bonded|clad|exterior|body/.test(normalized)) {
      return true
    }
  }
  return false
}

/**
 * @param {string} normalized
 */
function pickSubstrateCanonicalId(normalized) {
  /** @type {string[]} */
  const secondary = []
  let substrate = null

  const hasGraphite = /graphite/.test(normalized)
  const hasAluminum = /aluminum|aluminium/.test(normalized)
  const hasStainlessBody =
    /stainless[_\s-]*steel[_\s-]*(body|exterior|layer|bonded|clad|ply)|(?:body|exterior|layer).*stainless/.test(
      normalized,
    )

  if (hasGraphite) {
    substrate = 'graphite_structural_core'
    if (hasAluminum) secondary.push('aluminum_core')
    if (hasStainlessBody) secondary.push('stainless_steel_body')
  } else if (hasAluminum) {
    substrate = 'aluminum_core'
    if (hasStainlessBody) secondary.push('stainless_steel_body')
  } else if (hasStainlessBody || /stainless[_\s-]*steel/.test(normalized)) {
    substrate = 'stainless_steel_body'
  }

  return { substrate, secondary }
}

/**
 * @param {string} raw
 * @returns {CompoundCookwareParse}
 */
export function parseCompoundCookwareMaterial(raw) {
  const normalized = normalizeCompoundMaterialRaw(raw)
  const empty = {
    isCompound: false,
    constructionDescriptors: [],
    primaryContactCanonicalId: null,
    substrateCanonicalId: null,
    secondaryCoreMaterialIds: [],
    parseRuleId: 'cookware_compound_not_applicable_v1',
  }
  if (!normalized) return empty

  if (!isCompoundCookwareMaterialString(normalized)) {
    return empty
  }

  const constructionDescriptors = extractConstructionDescriptors(normalized)
  /** @type {CompoundCookwareParse} */
  const out = {
    isCompound: true,
    constructionDescriptors,
    primaryContactCanonicalId: null,
    substrateCanonicalId: null,
    secondaryCoreMaterialIds: [],
    parseRuleId: 'cookware_compound_material_v1',
  }

  if (hasStainlessFoodContactRole(normalized)) {
    out.primaryContactCanonicalId = resolveStainlessPrimaryCanonicalId(normalized)
  } else if (/cast_iron/.test(normalized) && !/enameled/.test(normalized)) {
    out.primaryContactCanonicalId = /seasoned|pre[-_]?seasoned/.test(normalized)
      ? 'cast_iron_seasoned'
      : 'cast_iron'
  } else if (/carbon_steel/.test(normalized)) {
    out.primaryContactCanonicalId = 'carbon_steel'
  }

  const { substrate, secondary } = pickSubstrateCanonicalId(normalized)
  out.substrateCanonicalId = substrate
  out.secondaryCoreMaterialIds = secondary

  return out
}

/**
 * @param {string} raw
 */
export function compoundParseSummary(raw) {
  const p = parseCompoundCookwareMaterial(raw)
  if (!p.isCompound) return null
  const parts = []
  if (p.primaryContactCanonicalId) parts.push(`food-contact: ${p.primaryContactCanonicalId}`)
  if (p.substrateCanonicalId) parts.push(`substrate: ${p.substrateCanonicalId}`)
  if (p.secondaryCoreMaterialIds.length) {
    parts.push(`secondary cores: ${p.secondaryCoreMaterialIds.join(', ')}`)
  }
  if (p.constructionDescriptors.length) {
    parts.push(`construction: ${p.constructionDescriptors.join(', ')}`)
  }
  return parts.join('; ')
}
