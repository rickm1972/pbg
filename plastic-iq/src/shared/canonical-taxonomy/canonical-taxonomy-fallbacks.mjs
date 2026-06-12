/**
 * Hardcoded taxonomy rows for dev hot-reload — Vite can keep stale PRIMARY_CONTACT_MATERIAL_TAXONOMY
 * arrays without hybrid entries; Agent 1 /run must not depend on a full server restart.
 */

/** @typedef {import('./types.mjs').TaxonomyEntry} TaxonomyEntry */

/** @type {TaxonomyEntry} */
export const HYBRID_FOOD_CONTACT_PRIMARY_ENTRY = {
  canonical_id: 'hybrid_stainless_nonstick_food_contact',
  display_label: 'Hybrid stainless lattice + nonstick-coated food-contact surface',
  mapping_rule_id: 'cookware_hybrid_stainless_nonstick_v1',
  agent2_material_id: 'hybrid_stainless_nonstick_food_contact',
  taxonomy_file: 'primary-contact-material-taxonomy.mjs',
}

/** @type {TaxonomyEntry} */
export const PROPRIETARY_NONSTICK_COATING_MODIFIER_ENTRY = {
  canonical_id: 'proprietary_nonstick_coating_undisclosed',
  display_label: 'Proprietary nonstick coating (composition undisclosed)',
  mapping_rule_id: 'cookware_proprietary_nonstick_undisclosed_v1',
  taxonomy_file: 'coating-modifier-taxonomy.mjs',
}

/** @type {TaxonomyEntry} */
export const STAINLESS_STEEL_BODY_SUBSTRATE_ENTRY = {
  canonical_id: 'stainless_steel_body',
  display_label: 'Stainless steel body / bonded construction',
  mapping_rule_id: 'cookware_stainless_body_v1',
  taxonomy_file: 'substrate-material-taxonomy.mjs',
}

/**
 * @param {TaxonomyEntry[]} entries
 * @param {string} canonicalId
 * @param {TaxonomyEntry} fallback
 */
export function findTaxonomyEntryById(entries, canonicalId, fallback) {
  return entries.find((e) => e.canonical_id === canonicalId) ?? fallback
}

/** @param {string} raw */
export function isHybridPrimaryContactRaw(raw) {
  const normalized = String(raw ?? '').toLowerCase().replace(/\s+/g, '_')
  return /terrabond|terra_bond|hybrid_stainless|hybrid.*nonstick|terrabond_proprietary/i.test(normalized)
}
