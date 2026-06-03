/**
 * Material taxonomy flags for UI (mirrors scripts/agent2/deterministic/material-taxonomy.mjs).
 * Cap-dominant materials drive Risk Dashboard Material/Migration bars to match algorithm penalties.
 */

/** Undisclosed food-contact coatings: hard cap 72, Layer 4A -3, Opaque badge. */
const UNKNOWN_FOOD_CONTACT_COATING_MATERIAL_IDS = new Set([
  'proprietary_named_food_contact',
  'terrabond_proprietary',
])

const RISK_DASHBOARD_DOMINANT_MATERIAL_IDS = UNKNOWN_FOOD_CONTACT_COATING_MATERIAL_IDS

/**
 * True when this material_id should dominate Material/Migration indicator fills
 * (not diluted by low-risk structural/handle components).
 */
export function isRiskDashboardDominantMaterial(materialId: string | undefined | null): boolean {
  return RISK_DASHBOARD_DOMINANT_MATERIAL_IDS.has(String(materialId ?? ''))
}

/** Layer 4A / coatings mapping — mirrors material-taxonomy.mjs unknownFoodContactCoating. */
export function isUnknownFoodContactCoatingMaterial(materialId: string | undefined | null): boolean {
  return UNKNOWN_FOOD_CONTACT_COATING_MATERIAL_IDS.has(String(materialId ?? ''))
}
