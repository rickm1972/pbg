/**
 * Hybrid cookware structural rules — stainless lattice + nonstick food-contact coating.
 * Global taxonomy guardrails (not product-specific).
 */

import { isHybridPrimaryContactRaw } from './canonical-taxonomy-fallbacks.mjs'

const UNCOATED_COATING_MODIFIER_IDS = new Set(['no_coating_modifier', 'not_applicable'])

const COATED_RISK_PRIMARY_IDS = new Set([
  'ptfe_nonstick_coating',
  'ptfe_nonstick_titanium_reinforced',
  'hybrid_stainless_nonstick_food_contact',
  'ceramic_nonstick_sol_gel_coating',
  'ceramic_nonstick_verified',
])

/** Primary food-contact pattern: raised stainless peaks + coated nonstick valleys. */
export const HYBRID_FOOD_CONTACT_PRIMARY_IDS = new Set([
  'hybrid_stainless_nonstick_food_contact',
])

/** Coating modifiers that indicate a food-contact nonstick coating is present. */
export const FOOD_CONTACT_COATING_MODIFIER_IDS = new Set([
  'ceramic_sol_gel_nonstick_coating',
  'proprietary_nonstick_coating_undisclosed',
])

/** HexClad-style exposed stainless cooking-surface geometry — not base plate / handle / bonded body. */
const HYBRID_EXPOSED_STAINLESS_GEOMETRY_RE =
  /laser[-\s]?etched|hexagonal\s+(peaks|pattern|surface)|stainless\s+hexagon|steel\s+hexagon\s+peaks|peaks.*stainless|stainless\s+(peaks|grid|lattice)|raised\s+stainless/i

/**
 * @param {string | null | undefined} primaryId
 */
export function isHybridFoodContactPrimary(primaryId) {
  return HYBRID_FOOD_CONTACT_PRIMARY_IDS.has(String(primaryId ?? ''))
}

/**
 * @param {string | null | undefined} coatingModifierId
 */
export function hasFoodContactCoatingModifier(coatingModifierId) {
  return FOOD_CONTACT_COATING_MODIFIER_IDS.has(String(coatingModifierId ?? ''))
}

/**
 * @param {import('./types.mjs').CanonicalMappingsPayload | null | undefined} mappings
 */
export function inertMetalProtectionBlocked(mappings) {
  const primaryId = mappings?.primary_contact_material_id?.canonical_id ?? ''
  const coatingId = mappings?.coating_modifier_id?.canonical_id ?? ''

  if (isHybridFoodContactPrimary(primaryId)) return true
  if (hasFoodContactCoatingModifier(coatingId)) return true
  if (COATED_RISK_PRIMARY_IDS.has(primaryId) && !UNCOATED_COATING_MODIFIER_IDS.has(coatingId)) {
    return true
  }
  return false
}

/**
 * True when structured evidence describes hybrid/coated cooking surface (not bare metal only).
 * @param {object} structured
 * @param {object[]} [sources]
 */
const HYBRID_PRIMARY_RAW_RE =
  /terrabond|terra\s*bond|hybrid_stainless|hybrid.*nonstick|terrabond_proprietary/i

/**
 * Product-disclosed evidence only — never third-party source excerpts (HexClad TerraBond mentions must not hijack ceramic pans).
 * @param {object} structured
 */
function collectHybridProductEvidenceBlob(structured) {
  const name = String(structured?.product_identity?.product_name ?? '').trim()
  const pcmRaw = String(structured?.primary_contact_material?.material_identity ?? '').trim()
  const coatParts = (structured?.coatings_and_finishes ?? []).flatMap((c) => [
    c.coating_name ?? '',
    c.coating_type ?? '',
  ])
  return [name, pcmRaw, ...coatParts].join(' ')
}

export function detectHybridCookwareEvidenceSignals(structured, sources = []) {
  const pcmRaw = String(structured?.primary_contact_material?.material_identity ?? '').trim()
  const pcmNorm = pcmRaw.replace(/_/g, ' ')
  if (HYBRID_PRIMARY_RAW_RE.test(pcmNorm)) return true
  if (isHybridPrimaryContactRaw(pcmRaw)) return true

  const productBlob = collectHybridProductEvidenceBlob(structured).replace(/_/g, ' ')
  if (/terrabond|terra\s*bond/i.test(productBlob)) return true

  const name = String(structured?.product_identity?.product_name ?? '').trim()
  if (/\bhybrid\b/i.test(name) && HYBRID_EXPOSED_STAINLESS_GEOMETRY_RE.test(productBlob)) {
    return true
  }

  const authoritativeSourceBlob = (sources ?? [])
    .map((s) => `${s.title ?? ''} ${s.page_excerpt ?? ''}`)
    .join(' ')
  const geometryBlob = `${productBlob} ${authoritativeSourceBlob}`

  if (HYBRID_EXPOSED_STAINLESS_GEOMETRY_RE.test(geometryBlob)) {
    return true
  }

  const bareMetalPrimary =
    /^stainless(_steel)?$/i.test(pcmRaw.replace(/\s+/g, '_')) ||
    pcmRaw === 'stainless_steel' ||
    pcmRaw === 'stainless steel'

  if (
    bareMetalPrimary &&
    /terrabond|terra\s*bond/i.test(productBlob) &&
    HYBRID_EXPOSED_STAINLESS_GEOMETRY_RE.test(geometryBlob)
  ) {
    return true
  }

  return false
}

/**
 * Preflight / approval blockers: coated food-contact surface cannot use inert-metal canonical rows.
 * @param {import('./types.mjs').CanonicalMappingsPayload | null | undefined} mappings
 * @param {object} [structured]
 * @returns {string[]}
 */
export function getCoatingInertContradictionBlockers(mappings, structured = {}) {
  if (!mappings) return []

  const blockers = []
  const primaryId = mappings.primary_contact_material_id?.canonical_id ?? ''
  const coatingId = mappings.coating_modifier_id?.canonical_id ?? ''
  const pfasId = mappings.pfas_status_id?.canonical_id ?? ''

  const evidenceSignalsHybrid = detectHybridCookwareEvidenceSignals(structured, [])
  const coatedSurface =
    isHybridFoodContactPrimary(primaryId) ||
    hasFoodContactCoatingModifier(coatingId) ||
    (COATED_RISK_PRIMARY_IDS.has(primaryId) && !UNCOATED_COATING_MODIFIER_IDS.has(coatingId)) ||
    (evidenceSignalsHybrid &&
      UNCOATED_COATING_MODIFIER_IDS.has(coatingId) &&
      /stainless/.test(primaryId))

  if (!coatedSurface) return blockers

  if (pfasId === 'pfas_not_present_inert_material') {
    blockers.push(
      'Contradiction: food-contact coating is present but PFAS status is pfas_not_present_inert_material. Inert-metal PFAS status cannot apply when a nonstick coating participates in the cooking surface.',
    )
  }

  if (UNCOATED_COATING_MODIFIER_IDS.has(coatingId)) {
    blockers.push(
      'Contradiction: food-contact nonstick coating is present but coating_modifier is no_coating_modifier or not_applicable. Use ceramic_sol_gel_nonstick_coating or proprietary_nonstick_coating_undisclosed.',
    )
  }

  if (
    evidenceSignalsHybrid &&
    primaryId === 'stainless_steel_unspecified' &&
    UNCOATED_COATING_MODIFIER_IDS.has(coatingId)
  ) {
    blockers.push(
      'Contradiction: hybrid/coated cookware evidence collapsed to bare stainless_steel_unspecified + no_coating_modifier. Map to hybrid_stainless_nonstick_food_contact or return TAXONOMY_EXPANSION_REQUIRED — never route coated hybrid pans down the inert-metal path.',
    )
  }

  return blockers
}
