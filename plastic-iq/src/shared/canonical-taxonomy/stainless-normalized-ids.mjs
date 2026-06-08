/**
 * Agent 1 normalized material_identity / raw_value IDs for stainless (snake_case).
 * Used by primary-contact and substrate resolvers — not product-specific.
 */

/** @type {Record<string, string>} normalized raw → primary-contact canonical_id */
export const STAINLESS_PRIMARY_CANONICAL_BY_RAW = {
  stainless: 'stainless_steel_unspecified',
  stainless_steel: 'stainless_steel_unspecified',
  stainless_steel_unspecified: 'stainless_steel_unspecified',
  stainless_steel_cooking_surface: 'stainless_steel_cooking_surface',
  stainless_steel_304: 'stainless_steel_304',
  stainless_steel_316: 'stainless_steel_316',
  stainless_steel_18_8: 'stainless_steel_18_8',
  stainless_steel_18_10: 'stainless_steel_18_10',
}

/** Any normalized stainless food-contact raw ID. */
export function isNormalizedStainlessPrimaryRaw(raw) {
  const n = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
  if (!n) return false
  if (n in STAINLESS_PRIMARY_CANONICAL_BY_RAW) return true
  return /^stainless(_steel)?(_\d+)?(_\d+_\d+)?$/i.test(n) && /stainless/.test(n)
}

/**
 * @param {string} raw
 * @param {import('./types.mjs').TaxonomyEntry[]} entries
 */
export function resolveStainlessPrimaryFromNormalizedRaw(raw, entries) {
  const normalized = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
  const targetId = STAINLESS_PRIMARY_CANONICAL_BY_RAW[normalized]
  if (targetId) {
    return entries.find((e) => e.canonical_id === targetId) ?? null
  }
  if (/^stainless(_steel)?/i.test(normalized)) {
    return entries.find((e) => e.canonical_id === 'stainless_steel_unspecified') ?? null
  }
  return null
}

/**
 * @param {string} raw
 * @param {import('./types.mjs').TaxonomyEntry[]} entries
 */
export function resolveStainlessSubstrateFromNormalizedRaw(raw, entries = []) {
  const normalized = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
  if (!normalized || !Array.isArray(entries) || entries.length === 0) return null
  if (
    normalized in STAINLESS_PRIMARY_CANONICAL_BY_RAW ||
    /^stainless(_steel)?/i.test(normalized)
  ) {
    return entries.find((e) => e.canonical_id === 'stainless_steel_body') ?? null
  }
  return null
}
