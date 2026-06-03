/** @typedef {import('./types.mjs').TaxonomyEntry} TaxonomyEntry */

/** @type {TaxonomyEntry[]} */
export const REGULATORY_FLAG_TAXONOMY = [
  {
    canonical_id: 'minnesota_pfas_ban_2025',
    display_label: 'Minnesota PFAS ban (2025)',
    description: 'Minnesota PFAS in cookware prohibition referenced in manufacturer/regulatory copy.',
    aliases: [/minnesota/i, /mn\s+pfas/i, /cookware.*ban/i],
    mapping_rule_id: 'regulatory_minnesota_pfas_ban_2025_v1',
    taxonomy_file: 'regulatory-flag-taxonomy.mjs',
  },
]
