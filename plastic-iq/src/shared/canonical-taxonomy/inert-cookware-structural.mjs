/**
 * Structural rules for uncoated / inert cookware food-contact surfaces (global, not product-specific).
 */

import {
  HYBRID_FOOD_CONTACT_PRIMARY_IDS,
  inertMetalProtectionBlocked as hybridInertMetalProtectionBlocked,
} from './hybrid-cookware-structural.mjs'

/** Re-export via wrapper — Vite dev `export { … } from` re-exports fail on Agent 1 /run. */
export function inertMetalProtectionBlocked(mappings) {
  return hybridInertMetalProtectionBlocked(mappings)
}

export const PTFE_FAMILY_PRIMARY_IDS = new Set([
  'ptfe_nonstick_coating',
  'ptfe_nonstick_titanium_reinforced',
])

/** Uncoated or mineral-like inert food-contact primaries (PFAS not structurally present). */
export const INERT_UNCOATED_PRIMARY_IDS = new Set([
  'cast_iron',
  'cast_iron_seasoned',
  'carbon_steel',
  'stainless_steel_304',
  'stainless_steel_316',
  'stainless_steel_18_8',
  'stainless_steel_18_10',
  'stainless_steel_unspecified',
  'stainless_steel_cooking_surface',
  'glass_food_contact',
  'ceramic_food_contact',
])

/** Inert enamel / glaze food-contact (coated, but not PFAS-family). */
export const INERT_ENAMELED_PRIMARY_IDS = new Set([
  'enamel_coating',
  'enameled_cast_iron_food_contact',
])

export const STRUCTURALLY_PFAS_FREE_PRIMARY_IDS = new Set([
  ...INERT_UNCOATED_PRIMARY_IDS,
  ...INERT_ENAMELED_PRIMARY_IDS,
])

/** Coated patterns where a coating modifier can change risk profile. */
export const COATED_RISK_PRIMARY_IDS = new Set([
  ...PTFE_FAMILY_PRIMARY_IDS,
  ...HYBRID_FOOD_CONTACT_PRIMARY_IDS,
  'ceramic_nonstick_sol_gel_coating',
  'ceramic_nonstick_verified',
])

export const UNCOATED_COATING_MODIFIER_IDS = new Set([
  'no_coating_modifier',
  'not_applicable',
])

const PFAS_PRESENT_STATUS_IDS = new Set([
  'pfas_present_disclosed',
  'pfas_intentionally_added_disclosed',
])

/**
 * @param {string | null | undefined} primaryId
 */
export function isInertFoodContactPrimary(primaryId) {
  return STRUCTURALLY_PFAS_FREE_PRIMARY_IDS.has(String(primaryId ?? ''))
}

/**
 * @param {string | null | undefined} primaryId
 */
export function isStructurallyPfasFreePrimary(primaryId) {
  return isInertFoodContactPrimary(primaryId)
}

/**
 * @param {string | null | undefined} primaryId
 */
export function isPtfeFamilyPrimary(primaryId) {
  return PTFE_FAMILY_PRIMARY_IDS.has(String(primaryId ?? ''))
}

/**
 * @param {string | null | undefined} primaryId
 */
export function requiresCoatingModifier(primaryId) {
  return COATED_RISK_PRIMARY_IDS.has(String(primaryId ?? ''))
}

/**
 * @param {import('./types.mjs').CanonicalMappingsPayload | null | undefined} mappings
 * @param {object} [structured]
 */
export function shouldApplyMinnesotaPfasRegulatoryFlag(mappings, structured = {}) {
  const primaryId = mappings?.primary_contact_material_id?.canonical_id ?? ''
  const pfasId = mappings?.pfas_status_id?.canonical_id ?? ''

  if (isPtfeFamilyPrimary(primaryId)) return true
  if (PFAS_PRESENT_STATUS_IDS.has(pfasId)) return true

  const ingText = (structured?.ingredient_list?.ingredients ?? []).join(' ')
  if (
    /intentionally\s+added/i.test(ingText) &&
    /pfas|ptfe|pfa|fep/i.test(ingText) &&
    !/\b(ptfe|pfas)[-\s]?free\b/i.test(ingText)
  ) {
    return true
  }

  if (inertMetalProtectionBlocked(mappings)) return false

  if (isInertFoodContactPrimary(primaryId) && pfasId === 'pfas_not_present_inert_material') {
    return false
  }

  if (isInertFoodContactPrimary(primaryId)) return false

  return false
}

const EXPLICIT_PFAS_FREE_CLAIM_RE = /\bpfas[-\s]?free\b/i
const PFAS_FREE_MARKETING_CONTEXT_RE = /pfas[-\s]?free alternative|avoid pfas|guide|comparison/i

/**
 * PFAS status may be structural; safety_claims.pfas_free_claim requires explicit marketing copy.
 * @param {object} structured
 */
export function stripInferredPfasFreeMarketingClaim(structured) {
  const field = structured?.safety_claims?.pfas_free_claim
  if (!field?.claimed) return

  const quote = String(field.source_quote ?? '').trim()
  const hasExplicit =
    quote.length > 0 &&
    EXPLICIT_PFAS_FREE_CLAIM_RE.test(quote) &&
    !PFAS_FREE_MARKETING_CONTEXT_RE.test(quote)

  if (hasExplicit) return

  field.claimed = false
  field.structural_guarantee = false
  field.structural_basis = null
}
