/** @typedef {import('./types.mjs').TaxonomyEntry} TaxonomyEntry */

/** @type {TaxonomyEntry[]} */
export const PFAS_STATUS_TAXONOMY = [
  {
    canonical_id: 'pfas_intentionally_added_disclosed',
    display_label: 'PFAS intentionally added (manufacturer disclosed)',
    description: 'Manufacturer or label lists PFAS family chemistries (e.g. PTFE, PFA, FEP).',
    aliases: [/ptfe/i, /\bpfa\b/i, /\bfep\b/i, /pfas\s*chemical/i, /intentionally\s*added/i],
    mapping_rule_id: 'pfas_intentionally_added_disclosed_v1',
    taxonomy_file: 'pfas-status-taxonomy.mjs',
  },
  {
    canonical_id: 'pfas_present_disclosed',
    display_label: 'PFAS present (disclosed)',
    description: 'Disclosed PFAS presence without full intentional-add wording.',
    aliases: [/pfas/i, /perfluoro/i],
    mapping_rule_id: 'pfas_present_disclosed_v1',
    taxonomy_file: 'pfas-status-taxonomy.mjs',
  },
  {
    canonical_id: 'pfas_free_claimed',
    display_label: 'PFAS-free claimed',
    description: 'Explicit PFAS-free claim only — never inferred from PFOA-free.',
    aliases: [/pfas[-\s]?free/i],
    mapping_rule_id: 'pfas_free_claimed_v1',
    taxonomy_file: 'pfas-status-taxonomy.mjs',
  },
  {
    canonical_id: 'pfas_not_disclosed',
    display_label: 'PFAS not disclosed',
    description: 'No affirmative PFAS disclosure in reviewed sources.',
    aliases: [],
    mapping_rule_id: 'pfas_not_disclosed_v1',
    taxonomy_file: 'pfas-status-taxonomy.mjs',
  },
]
