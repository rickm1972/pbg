/**
 * Coating-over-substrate Agent 2 handoff — primary contact display + secondary dedupe.
 */

import { detectMaterialId, getMaterial, resolveMaterialId } from './material-taxonomy.mjs'

/** Food-contact coating material_ids treated as the same surface for dedupe. */
const FOOD_CONTACT_COATING_EQUIVALENTS = [
  ['ceramic_nonstick_sol_gel', 'thermolon_ceramic'],
  ['ptfe_nonstick', 'ptfe_coating', 'ptfe_nonstick_titanium_reinforced'],
]

/**
 * @param {string | null | undefined} a
 * @param {string | null | undefined} b
 */
export function foodContactCoatingMaterialIdsEquivalent(a, b) {
  const left = resolveMaterialId(String(a ?? ''))
  const right = resolveMaterialId(String(b ?? ''))
  if (!left || !right) return false
  if (left === right) return true
  for (const group of FOOD_CONTACT_COATING_EQUIVALENTS) {
    if (group.includes(left) && group.includes(right)) return true
  }
  return false
}

/**
 * @param {object | null | undefined} pcm
 * @param {object | null | undefined} substrateCanonical
 */
export function pcmIdentityMatchesSubstrate(pcm, substrateCanonical) {
  if (!pcm || !substrateCanonical) return false
  const pcmText = String(pcm.material_identity ?? '').trim().toLowerCase()
  if (!pcmText) return false
  const substrateIds = [
    substrateCanonical.canonical_id,
    substrateCanonical.agent2_material_id,
    substrateCanonical.raw_value,
  ]
    .filter(Boolean)
    .map((v) => String(v).trim().toLowerCase())

  if (substrateIds.some((id) => pcmText === id || pcmText.replace(/[\s-]+/g, '_') === id.replace(/[\s-]+/g, '_'))) {
    return true
  }

  const pcmDetected = detectMaterialId(pcmText.replace(/_/g, ' '))
  const substrateDetected = resolveMaterialId(
    substrateCanonical.agent2_material_id ?? substrateCanonical.canonical_id ?? '',
  )
  return Boolean(pcmDetected && substrateDetected && pcmDetected === substrateDetected)
}

/**
 * Prefer Gate 1 canonical coating identity when raw PCM points at substrate/body.
 * @param {object} pcm
 * @param {object | null | undefined} canonicalRow
 * @param {object | null | undefined} substrateCanonical
 * @param {object[]} [coatings]
 */
export function resolvePrimaryContactDisplayIdentity(pcm, canonicalRow, substrateCanonical, coatings = []) {
  const canonicalText = String(canonicalRow?.raw_value ?? '').trim()
  const coatingLine = coatings.find((c) => String(c.coating_name ?? '').trim())?.coating_name?.trim()
  if (
    canonicalRow?.canonical_id &&
    pcmIdentityMatchesSubstrate(pcm, substrateCanonical)
  ) {
    return canonicalText || coatingLine || pcm.material_identity
  }
  if (canonicalText && !String(pcm.material_identity ?? '').trim()) {
    return canonicalText
  }
  return pcm.material_identity
}

/**
 * @param {import('./component-extract.mjs').DraftComponent[]} components
 * @param {string} materialId
 * @param {string} materialIdentity
 * @param {string} componentRole
 */
export function isRedundantFoodContactSecondary(components, materialId, materialIdentity, componentRole) {
  const primaryIds = components
    .filter((c) => c.role === 'primary_food_contact')
    .map((c) => c.material_id)

  if (!primaryIds.length) return false

  const matchesPrimary = primaryIds.some((id) =>
    foodContactCoatingMaterialIdsEquivalent(id, materialId),
  )
  if (!matchesPrimary) return false

  if (componentRole === 'other' || componentRole === 'coating') return true

  const blob = `${materialIdentity} ${materialId}`.toLowerCase()
  if (
    (componentRole === 'structural' || componentRole === 'other') &&
    /ceramic|thermolon|nonstick|sol[-\s]?gel|diamond[-\s]?infused/i.test(blob)
  ) {
    return true
  }

  return false
}

/**
 * @param {import('./component-extract.mjs').DraftComponent[]} components
 */
export function dedupeRedundantFoodContactSecondaries(components) {
  const primaryIds = components
    .filter((c) => c.role === 'primary_food_contact')
    .map((c) => c.material_id)
  if (!primaryIds.length) return components

  return components.filter((c) => {
    if (c.role === 'primary_food_contact') return true
    return !primaryIds.some((id) => foodContactCoatingMaterialIdsEquivalent(id, c.material_id))
  })
}
