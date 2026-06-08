/**
 * Gate 1 / Agent 2 transparency badge — score-driving provenance and coating disclosure.
 */
import { isExpansionRequired } from './constants.mjs'
import { isCeramicNonstickPrimary } from './ceramic-nonstick-structural.mjs'
import { isInertFoodContactPrimary } from './inert-cookware-structural.mjs'
import { resolveSourceTier } from './confidence-label-consistency.mjs'
import { COOKWARE_SCORE_DRIVING_FIELDS } from './score-driving-fields.mjs'

export const TRANSPARENCY_BADGES = {
  FULLY_DISCLOSED: 'Fully Disclosed',
  DOCUMENTATION_INCOMPLETE: 'Documentation Incomplete',
  MATERIAL_UNCERTAIN: 'Material Uncertain',
  OPAQUE: 'Opaque',
}

const THIRD_PARTY_CONFIDENCE = new Set([
  'third_party_review_citing_manufacturer',
  'third_party_context_source',
  'manufacturer_claim_via_secondary_source',
  'retailer_confirmed',
  'marketing_claim',
  'claim_not_independently_verified',
  'inferred_from_description',
  'inferred_from_category_pattern',
  'unknown',
  'proprietary_or_undisclosed',
])

/**
 * @param {string | null | undefined} label
 */
export function isWeakScoreDrivingProvenance(label) {
  return THIRD_PARTY_CONFIDENCE.has(String(label ?? ''))
}

/**
 * @param {object} structured
 */
export function hasProprietaryCeramicCoatingGap(structured) {
  const primaryId =
    structured?.canonical_mappings?.primary_contact_material_id?.canonical_id ?? ''
  if (!isCeramicNonstickPrimary(primaryId)) return false
  const coats = structured?.coatings_and_finishes ?? []
  if (!coats.length) return true
  return coats.some((c) => {
    if (c.composition_disclosed === false) return true
    const blob = `${c.coating_name ?? ''} ${c.coating_type ?? ''}`.toLowerCase()
    return /proprietary|undisclosed|unknown/i.test(blob)
  })
}

/**
 * @param {object[]} sources
 */
function manufacturerSourceLacksSnippet(sources) {
  for (const s of sources ?? []) {
    const tier = resolveSourceTier(s, s.url)
    if (tier !== 'manufacturer') continue
    const excerpt = String(s.page_excerpt ?? '').trim()
    if (!excerpt) return true
  }
  return false
}

/**
 * @param {object} structured
 * @param {import('./types.mjs').CanonicalMappingsPayload | null | undefined} mappings
 * @param {object[]} [sources]
 */
export function assessTransparency(structured, mappings, sources = []) {
  /** @type {string[]} */
  const reasons = []
  let badge = TRANSPARENCY_BADGES.FULLY_DISCLOSED
  let scoreDrivingViaThirdParty = false
  let proprietaryCoating = false

  if (!mappings) {
    return {
      transparency_badge: TRANSPARENCY_BADGES.MATERIAL_UNCERTAIN,
      badge_justification: 'Canonical mappings missing.',
      fully_disclosed_eligible: false,
      score_driving_via_third_party: false,
      proprietary_coating_composition: false,
      evaluated_at: new Date().toISOString(),
    }
  }

  const primaryId = mappings.primary_contact_material_id?.canonical_id ?? ''
  const stainlessGradeOnlyGap =
    primaryId === 'stainless_steel_unspecified' || primaryId === 'stainless_steel_cooking_surface'
  const stainlessGradeDisclosed =
    primaryId === 'stainless_steel_18_10' ||
    primaryId === 'stainless_steel_18_8' ||
    primaryId === 'stainless_steel_304' ||
    primaryId === 'stainless_steel_316'

  for (const req of COOKWARE_SCORE_DRIVING_FIELDS) {
    const row = mappings[req.field_key]
    if (!row || isExpansionRequired(row.canonical_id)) {
      badge = TRANSPARENCY_BADGES.MATERIAL_UNCERTAIN
      reasons.push(`${req.label}: unresolved taxonomy (${row?.canonical_id ?? 'missing'}).`)
      continue
    }
    if (isWeakScoreDrivingProvenance(row.confidence_label)) {
      scoreDrivingViaThirdParty = true
      if (badge === TRANSPARENCY_BADGES.FULLY_DISCLOSED) {
        badge = TRANSPARENCY_BADGES.DOCUMENTATION_INCOMPLETE
      }
      reasons.push(
        `${req.label}: sourced with ${row.confidence_label ?? 'weak provenance'} — not direct manufacturer confirmation.`,
      )
    }
  }

  if (stainlessGradeOnlyGap && badge === TRANSPARENCY_BADGES.FULLY_DISCLOSED) {
    badge = TRANSPARENCY_BADGES.DOCUMENTATION_INCOMPLETE
    reasons.push(
      'Stainless food-contact family is disclosed; exact alloy grade (304/316/18-10) is not specified in reviewed sources.',
    )
  }

  proprietaryCoating = hasProprietaryCeramicCoatingGap(structured)
  if (proprietaryCoating) {
    if (badge === TRANSPARENCY_BADGES.FULLY_DISCLOSED) {
      badge = TRANSPARENCY_BADGES.DOCUMENTATION_INCOMPLETE
    }
    reasons.push(
      'Ceramic/sol-gel nonstick coating composition is proprietary or not fully disclosed in reviewed sources.',
    )
  }

  if (scoreDrivingViaThirdParty && manufacturerSourceLacksSnippet(sources)) {
    reasons.push(
      'Manufacturer product page had no usable snippet; score-driving material fields rely on retailer or third-party/context sources.',
    )
  }

  const fullyEligible =
    badge === TRANSPARENCY_BADGES.FULLY_DISCLOSED &&
    !scoreDrivingViaThirdParty &&
    !proprietaryCoating

  return {
    transparency_badge: badge,
    badge_justification:
      reasons.length > 0
        ? reasons.join(' ')
        : 'Score-driving materials mapped with direct manufacturer-tier provenance and no proprietary coating gap.',
    fully_disclosed_eligible: fullyEligible,
    score_driving_via_third_party: scoreDrivingViaThirdParty,
    proprietary_coating_composition: proprietaryCoating,
    evaluated_at: new Date().toISOString(),
  }
}
