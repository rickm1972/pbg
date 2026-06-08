/**
 * Material taxonomy flags for UI (mirrors scripts/agent2/deterministic/material-taxonomy.mjs).
 * Cap-dominant materials drive Risk Dashboard Material/Migration bars to match score-driving surfaces.
 */

/** Undisclosed food-contact coatings: hard cap 72, Layer 4A -3, Opaque badge. */
const UNKNOWN_FOOD_CONTACT_COATING_MATERIAL_IDS = new Set([
  'proprietary_named_food_contact',
  'terrabond_proprietary',
])

/** Manufactured food-contact coatings — not diluted by structural/handle components. */
const FOOD_CONTACT_COATING_MATERIAL_IDS = new Set([
  'ceramic_nonstick_sol_gel',
  'thermolon_ceramic',
  'ptfe_coating',
  'ptfe_nonstick',
  'ptfe_nonstick_titanium',
  'ptfe_titanium_reinforced',
])

const KNOWN_PTFE_FLUOROPOLYMER_IDS = new Set([
  'ptfe_coating',
  'ptfe_nonstick',
  'ptfe_nonstick_titanium',
  'ptfe_titanium_reinforced',
])

const INERT_FOOD_CONTACT_MATERIAL_IDS = new Set([
  'cast_iron',
  'cast_iron_seasoned',
  'carbon_steel',
  'cast_iron_integrated_handle',
  'stainless_steel_304',
  'stainless_steel_316',
  'stainless_steel_unspecified',
  'stainless_steel_handle',
  'tempered_glass',
  'borosilicate_glass',
  'soda_lime_glass',
  'glass_type_unspecified',
  'vitreous_enamel_over_cast_iron',
])

/**
 * True when this material_id should dominate Material/Migration indicator fills
 * (not diluted by low-risk structural/handle components).
 */
export function isRiskDashboardDominantMaterial(materialId: string | undefined | null): boolean {
  const id = String(materialId ?? '')
  if (!id) return false
  if (UNKNOWN_FOOD_CONTACT_COATING_MATERIAL_IDS.has(id)) return true
  if (FOOD_CONTACT_COATING_MATERIAL_IDS.has(id)) return true
  return /^(ptfe|ceramic_nonstick)|proprietary.*food|terrabond/i.test(id)
}

export function isFoodContactCoatingMaterial(materialId: string | undefined | null): boolean {
  const id = String(materialId ?? '')
  if (!id) return false
  if (UNKNOWN_FOOD_CONTACT_COATING_MATERIAL_IDS.has(id)) return true
  if (FOOD_CONTACT_COATING_MATERIAL_IDS.has(id)) return true
  return /ptfe|ceramic_nonstick|ceramic.*nonstick|proprietary.*food|terrabond/i.test(id)
}

/** Known disclosed PTFE / fluoropolymer nonstick — not “coating uncertainty”. */
export function isKnownPtfeFluoropolymerMaterial(materialId: string | undefined | null): boolean {
  const id = String(materialId ?? '')
  if (!id) return false
  if (KNOWN_PTFE_FLUOROPOLYMER_IDS.has(id)) return true
  return /^ptfe|teflon/i.test(id) || /\bfluoropolymer\b/i.test(id)
}

/** Bare inert food-contact surfaces (no manufactured nonstick coating). */
export function isInertFoodContactMaterial(materialId: string | undefined | null): boolean {
  const id = String(materialId ?? '')
  if (!id) return false
  if (INERT_FOOD_CONTACT_MATERIAL_IDS.has(id)) return true
  return /^(cast_iron|carbon_steel|tempered_glass|borosilicate|soda_lime)/.test(id)
}

/** Layer 4A / coatings mapping — mirrors material-taxonomy.mjs unknownFoodContactCoating. */
export function isUnknownFoodContactCoatingMaterial(materialId: string | undefined | null): boolean {
  return UNKNOWN_FOOD_CONTACT_COATING_MATERIAL_IDS.has(String(materialId ?? ''))
}

export function disclosureBadgeLimitsCoatingChemistry(badge: string | undefined | null): boolean {
  const b = String(badge ?? '').trim()
  return b === 'Material Uncertain' || b === 'Documentation Incomplete' || b === 'Opaque'
}
