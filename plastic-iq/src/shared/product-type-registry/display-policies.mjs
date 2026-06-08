/**
 * Registry-owned display / secondary-material policies (Layer 2).
 * Preflight reads these — not hardcoded in agents or renderer.
 */

/** @typedef {'show_all_internal_cores_or_none' | 'suppress_internal_cores'} SecondaryMaterialPolicyMode */

/**
 * @typedef {object} SecondaryMaterialPolicy
 * @property {string} id
 * @property {SecondaryMaterialPolicyMode} mode
 * @property {string[]} internal_core_roles Agent 2 component roles treated as internal construction
 * @property {string[]} [internal_core_material_id_patterns] optional material_id substrings
 */

/** @type {Record<string, SecondaryMaterialPolicy>} */
export const SECONDARY_MATERIAL_POLICIES = {
  cookware_show_internal_cores: {
    id: 'cookware_show_internal_cores',
    mode: 'show_all_internal_cores_or_none',
    internal_core_roles: ['structural', 'internal_core'],
    internal_core_material_id_patterns: ['_core', 'graphite_', 'aluminum_core'],
  },
  drinkware_suppress_internal_cores: {
    id: 'drinkware_suppress_internal_cores',
    mode: 'suppress_internal_cores',
    internal_core_roles: ['structural', 'internal_core'],
    internal_core_material_id_patterns: ['_core'],
  },
  default_suppress_internal_cores: {
    id: 'default_suppress_internal_cores',
    mode: 'suppress_internal_cores',
    internal_core_roles: ['structural', 'internal_core'],
    internal_core_material_id_patterns: ['_core'],
  },
}

export const VALID_SECONDARY_MATERIAL_POLICY_REFS = Object.keys(SECONDARY_MATERIAL_POLICIES)

export function getSecondaryMaterialPolicy(ref) {
  return SECONDARY_MATERIAL_POLICIES[ref] ?? null
}

/** Transparency routes for grade-unspecified inert metals (registry-owned). */
export const TRANSPARENCY_ROUTES = {
  stainless_steel_unspecified: {
    material_id_patterns: ['stainless_steel_unspecified'],
    required_badge: 'Documentation Incomplete',
    required_disclosure_quality: 'Documentation Incomplete',
    forbidden_badges: ['Fully Disclosed', 'Full Disclosed'],
    expected_ci: '±3',
  },
}

/**
 * Oura-style risk-bar contract — Agent 2 authors display.risk_bars[]; renderer prints verbatim.
 * Polarity semantics: emerald + higher fill = lower concern; amber/red = elevated concern.
 */
export const RISK_BAR_CONTRACT = {
  bar_ids: ['material', 'migration', 'use_conditions'],
  allowed_color_tokens: ['emerald', 'amber', 'red'],
  min_fill_percent: 0,
  max_fill_percent: 100,
  /** Map color_token to expected concern direction (for structural validation only). */
  color_semantics: {
    emerald: 'lower_concern',
    amber: 'moderate_concern',
    red: 'higher_concern',
  },
}
