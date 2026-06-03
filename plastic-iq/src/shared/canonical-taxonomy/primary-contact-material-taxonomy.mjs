/**
 * Cookware-focused primary food-contact material canonical IDs (Gate 1 → Agent 2).
 * agent2_material_id links to scripts/agent2/deterministic/material-taxonomy.mjs
 */

/** @typedef {import('./types.mjs').TaxonomyEntry} TaxonomyEntry */

/** @type {TaxonomyEntry[]} */
export const PRIMARY_CONTACT_MATERIAL_TAXONOMY = [
  {
    canonical_id: 'ptfe_nonstick_coating',
    display_label: 'PTFE nonstick coating (food contact)',
    description: 'PTFE-based interior nonstick cooking surface.',
    aliases: [/ptfe/i, /nonstick/i, /non-stick/i, /teflon/i],
    mapping_rule_id: 'cookware_ptfe_interior_v1',
    agent2_material_id: 'ptfe_nonstick',
    taxonomy_file: 'primary-contact-material-taxonomy.mjs',
  },
  {
    canonical_id: 'ptfe_nonstick_titanium_reinforced',
    display_label: 'Titanium-reinforced PTFE nonstick (food contact)',
    description: 'PTFE nonstick with titanium reinforcement in marketing/spec copy.',
    aliases: [/titanium.*ptfe/i, /ptfe.*titanium/i, /titanium.*nonstick/i],
    mapping_rule_id: 'cookware_titanium_ptfe_interior_v1',
    agent2_material_id: 'ptfe_nonstick_titanium_reinforced',
    taxonomy_file: 'primary-contact-material-taxonomy.mjs',
  },
  {
    canonical_id: 'cast_iron_seasoned',
    display_label: 'Cast iron (seasoned)',
    description: 'Bare or pre-seasoned cast iron cooking surface.',
    aliases: [/cast\s*iron/i, /seasoned/i],
    mapping_rule_id: 'cookware_cast_iron_v1',
    agent2_material_id: 'cast_iron_seasoned',
    taxonomy_file: 'primary-contact-material-taxonomy.mjs',
  },
  {
    canonical_id: 'stainless_steel_cooking_surface',
    display_label: 'Stainless steel cooking surface',
    description: 'Stainless steel primary food-contact surface.',
    aliases: [/stainless/i],
    mapping_rule_id: 'cookware_stainless_v1',
    agent2_material_id: 'stainless_steel_unspecified',
    taxonomy_file: 'primary-contact-material-taxonomy.mjs',
  },
  {
    canonical_id: 'ceramic_nonstick_verified',
    display_label: 'Ceramic nonstick (verified PFAS-free claim)',
    description: 'Sol-gel / ceramic nonstick with verified PFAS-free positioning.',
    aliases: [/ceramic/i, /thermolon/i, /sol-gel/i],
    mapping_rule_id: 'cookware_ceramic_v1',
    agent2_material_id: 'ceramic_nonstick_verified',
    taxonomy_file: 'primary-contact-material-taxonomy.mjs',
  },
]
