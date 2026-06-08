/**
 * Ceramic sol-gel / mineral nonstick — manufactured coating (not PTFE, not inert bare ceramic).
 */

import { PRIMARY_CONTACT_MATERIAL_TAXONOMY } from './primary-contact-material-taxonomy.mjs'

export const CERAMIC_NONSTICK_PRIMARY_IDS = new Set([
  'ceramic_nonstick_sol_gel_coating',
  'ceramic_nonstick_verified',
])

/** Agent 1 / retailer snake_case IDs that normalize to the ceramic nonstick primary. */
export const CERAMIC_NONSTICK_LEGACY_RAW_IDS = new Set([
  'sol_gel_ceramic_nonstick_coating',
  'ceramic_nonstick_sol_gel',
  'ceramic_nonstick_sol_gel_coating',
  'sol_gel_ceramic_coating_on_aluminum_core',
  'ceramic_nonstick_coating_on_aluminum_core',
])

/** @typedef {'aluminum_core' | 'hard_anodized_aluminum'} CeramicCoatingSubstrateHint */

/**
 * @param {string | null | undefined} primaryId
 */
export function isCeramicNonstickPrimary(primaryId) {
  return CERAMIC_NONSTICK_PRIMARY_IDS.has(String(primaryId ?? ''))
}

/**
 * Token-normalized check for ceramic/sol-gel nonstick (any word order).
 * @param {string} text
 */
export function isCeramicNonstickMaterialText(text) {
  const raw = String(text ?? '').trim()
  if (!raw) return false
  const id = raw.toLowerCase().replace(/\s+/g, '_')
  if (CERAMIC_NONSTICK_LEGACY_RAW_IDS.has(id)) return true
  if (/ceramic_nonstick_sol_gel|sol_gel_ceramic_nonstick/i.test(id)) return true

  const t = raw.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  const hasCeramic = /\bceramic\b/.test(t)
  const hasNonstick = /\bnonstick\b|\bnon\s+stick\b/.test(t)
  const hasSolGel = /\bsol\b.*\bgel\b|\bsolgel\b/.test(t.replace(/\s+/g, '')) || (/\bsol\b/.test(t) && /\bgel\b/.test(t))
  if (hasCeramic && hasNonstick && (hasSolGel || /\bcoating\b/.test(t))) return true
  if (hasCeramic && hasSolGel && /\bcoating\b/.test(t)) return true

  if (/ceramic\s*non[-\s]?stick|mineral[-\s]?based\s*ceramic|thermolon/i.test(raw)) return true
  return false
}

/**
 * @param {import('./types.mjs').TaxonomyEntry[]} [entries]
 */
export function resolveCeramicNonstickPrimaryEntry(
  entries = PRIMARY_CONTACT_MATERIAL_TAXONOMY,
) {
  return entries.find((e) => e.canonical_id === 'ceramic_nonstick_sol_gel_coating') ?? null
}

/**
 * @param {string} raw
 * @param {import('./types.mjs').TaxonomyEntry[]} [entries]
 */
export function resolveCeramicNonstickPrimaryFromRaw(raw, entries = PRIMARY_CONTACT_MATERIAL_TAXONOMY) {
  if (!isCeramicNonstickMaterialText(raw)) return null
  return resolveCeramicNonstickPrimaryEntry(entries)
}

/**
 * Substrate embedded in compound coating-on-substrate material strings (snake_case or prose).
 * @param {string} text
 * @returns {CeramicCoatingSubstrateHint | null}
 */
export function parseCeramicCoatingSubstrateHint(text) {
  const raw = String(text ?? '').trim()
  if (!raw) return null
  const id = raw.toLowerCase().replace(/\s+/g, '_')
  const spaced = raw.toLowerCase().replace(/_/g, ' ')

  if (/hard[_\s-]*anodized|hard[_\s-]*anodised/i.test(id) || /hard\s*anodized/i.test(spaced)) {
    return 'hard_anodized_aluminum'
  }

  if (
    /aluminum[_\s-]*core|aluminium[_\s-]*core/i.test(id) ||
    /on[_\s-]*aluminum(?:[_\s-]*core)?|on[_\s-]*aluminium(?:[_\s-]*core)?/i.test(id) ||
    /coating[_\s-]*on[_\s-]*aluminum|ceramic[_\s-]*coated[_\s-]*aluminum|coated[_\s-]*aluminum/i.test(id) ||
    /\baluminum\s+core\b|\baluminium\s+core\b/i.test(spaced) ||
    /coating\s+on\s+aluminum|ceramic[-\s]+coated\s+aluminum|sol[-\s]?gel\s+ceramic\s+coating\s+on\s+aluminum/i.test(
      spaced,
    )
  ) {
    return 'aluminum_core'
  }

  if (isCeramicNonstickMaterialText(raw) && /\baluminum\b|\baluminium\b/i.test(spaced)) {
    return 'aluminum_core'
  }

  return null
}

/**
 * @param {string} text
 */
export function textDisclosesAluminumSubstrate(text) {
  return parseCeramicCoatingSubstrateHint(text) === 'aluminum_core'
}

/**
 * Marketing copy that negates PTFE/PFOA/PFAS presence (e.g. "PTFE & PFOA Free") — not disclosure of PFAS use.
 * @param {string} blob
 */
export function marketingClaimsPtfeOrPfasAbsent(blob) {
  const b = String(blob ?? '')
  if (/\b(ptfe|pfoa|pfas)\b[^.\n;]{0,48}\bfree\b/i.test(b)) return true
  if (/\bfree\s+from\s+(ptfe|pfoa|pfas)\b/i.test(b)) return true
  if (/\bno\s+(ptfe|pfoa|pfas)\b/i.test(b)) return true
  return false
}

/**
 * True only when copy discloses PTFE/PFA/FEP as present chemistry (not "PTFE-free").
 * @param {string} blob
 */
export function blobDisclosesPfasFamilyPresent(blob) {
  if (marketingClaimsPtfeOrPfasAbsent(blob)) return false
  if (/\bptfe\b/i.test(blob) && !/\bptfe[-\s]?free\b/i.test(blob)) return true
  if (/\bpfa\b(?!s)/i.test(blob) || /\bfep\b/i.test(blob)) return true
  if (/\bpfas\b/i.test(blob) && !/\bpfas[-\s]?free\b/i.test(blob)) return true
  return false
}
