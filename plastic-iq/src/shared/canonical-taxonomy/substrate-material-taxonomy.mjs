/** @typedef {import('./types.mjs').TaxonomyEntry} TaxonomyEntry */

/** @type {TaxonomyEntry[]} */
export const SUBSTRATE_MATERIAL_TAXONOMY = [
  {
    canonical_id: 'hard_anodized_aluminum',
    display_label: 'Hard anodized aluminum',
    description: 'Hard-anodized aluminum body or substrate under interior coating.',
    aliases: [/hard\s*anodized/i, /hard\s*anodised/i, /anodized\s*aluminum/i],
    mapping_rule_id: 'cookware_hard_anodized_substrate_v1',
    agent2_material_id: 'hard_anodized_aluminum',
    taxonomy_file: 'substrate-material-taxonomy.mjs',
  },
  {
    canonical_id: 'aluminum_core',
    display_label: 'Aluminum core / body',
    description: 'Aluminum structural body without hard-anodized specification.',
    aliases: [/\baluminum\b/i, /\baluminium\b/i],
    mapping_rule_id: 'cookware_aluminum_substrate_v1',
    agent2_material_id: 'aluminum_core',
    taxonomy_file: 'substrate-material-taxonomy.mjs',
  },
  {
    canonical_id: 'cast_iron_body',
    display_label: 'Cast iron body',
    description: 'Cast iron substrate (not coated PTFE primary).',
    aliases: [/cast\s*iron/i],
    mapping_rule_id: 'cookware_cast_iron_substrate_v1',
    agent2_material_id: 'cast_iron',
    taxonomy_file: 'substrate-material-taxonomy.mjs',
  },
]
