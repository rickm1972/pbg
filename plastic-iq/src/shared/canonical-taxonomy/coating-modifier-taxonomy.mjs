/** @typedef {import('./types.mjs').TaxonomyEntry} TaxonomyEntry */

/** @type {TaxonomyEntry[]} */
export const COATING_MODIFIER_TAXONOMY = [
  {
    canonical_id: 'titanium_reinforced',
    display_label: 'Titanium reinforced (modifier)',
    description: 'Titanium reinforcement called out on PTFE/nonstick marketing — modifier only.',
    aliases: [/titanium/i, /titanium\s*advanced/i],
    mapping_rule_id: 'cookware_titanium_modifier_v1',
    taxonomy_file: 'coating-modifier-taxonomy.mjs',
  },
  {
    canonical_id: 'hard_anodized_exterior_finish',
    display_label: 'Hard anodized exterior finish',
    description: 'Exterior hard-anodized finish (non food-contact modifier).',
    aliases: [/hard\s*anodized\s*exterior/i, /exterior.*anodized/i],
    mapping_rule_id: 'cookware_hard_anodized_exterior_v1',
    taxonomy_file: 'coating-modifier-taxonomy.mjs',
  },
]
