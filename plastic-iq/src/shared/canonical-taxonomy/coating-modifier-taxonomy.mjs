/** @typedef {import('./types.mjs').TaxonomyEntry} TaxonomyEntry */

/** @type {TaxonomyEntry[]} */
export const COATING_MODIFIER_TAXONOMY = [
  {
    canonical_id: 'no_coating_modifier',
    display_label: 'No coating modifier (uncoated surface)',
    description: 'Primary food-contact surface is uncoated — no risk-changing coating modifier.',
    aliases: [/^uncoated$/i, /no\s*coating/i, /bare\s*surface/i, /\bnone\b/i],
    mapping_rule_id: 'cookware_no_coating_modifier_v1',
    taxonomy_file: 'coating-modifier-taxonomy.mjs',
  },
  {
    canonical_id: 'not_applicable',
    display_label: 'Coating modifier not applicable',
    description: 'Coating modifier field does not apply to this primary contact pattern.',
    aliases: [/not\s*applicable/i, /\bn\/?a\b/i],
    mapping_rule_id: 'cookware_coating_modifier_na_v1',
    taxonomy_file: 'coating-modifier-taxonomy.mjs',
  },
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
  {
    canonical_id: 'proprietary_nonstick_coating_undisclosed',
    display_label: 'Proprietary nonstick coating (composition undisclosed)',
    description:
      'Manufacturer-named proprietary ceramic/nonstick coating; PTFE-free or PFAS-free may be claimed but full chemistry is not publicly disclosed.',
    aliases: [
      /terrabond/i,
      /terra\s*bond/i,
      /proprietary.*nonstick/i,
      /proprietary.*ceramic/i,
      /undisclosed.*coating/i,
      /proprietary_undisclosed/i,
    ],
    mapping_rule_id: 'cookware_proprietary_nonstick_undisclosed_v1',
    taxonomy_file: 'coating-modifier-taxonomy.mjs',
  },
  {
    canonical_id: 'ceramic_sol_gel_nonstick_coating',
    display_label: 'Ceramic sol-gel nonstick coating (modifier)',
    description: 'Sol-gel / mineral ceramic nonstick food-contact coating chemistry.',
    aliases: [
      /ceramic_nonstick_sol_gel/i,
      /ceramic\s*non[-\s]?stick\s*sol[-\s]?gel/i,
      /sol[-\s]?gel\s*ceramic/i,
      /ceramic\s*non[-\s]?stick\s*coating/i,
      /mineral[-\s]?based\s*ceramic/i,
    ],
    mapping_rule_id: 'cookware_ceramic_sol_gel_modifier_v1',
    taxonomy_file: 'coating-modifier-taxonomy.mjs',
  },
]
