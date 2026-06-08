/** @typedef {import('./types.mjs').TaxonomyEntry} TaxonomyEntry */

/** @type {TaxonomyEntry[]} */
export const SAFETY_CLAIM_TAXONOMY = [
  {
    canonical_id: 'pfoa_free_claim',
    display_label: 'PFOA-free claim',
    description: 'Explicit PFOA-free marketing only — never infer PFAS-free.',
    aliases: [/pfoa[-\s]?free/i, /\bno\s+pfoa\b/i],
    mapping_rule_id: 'safety_pfoa_free_literal_v1',
    taxonomy_file: 'safety-claim-taxonomy.mjs',
  },
  {
    canonical_id: 'ptfe_free_claim',
    display_label: 'PTFE-free claim',
    description: 'Explicit PTFE-free marketing — distinct from PFAS-free and PFOA-free.',
    aliases: [/ptfe[-\s]?free/i, /\bno\s+ptfe\b/i],
    mapping_rule_id: 'safety_ptfe_free_literal_v1',
    taxonomy_file: 'safety-claim-taxonomy.mjs',
  },
  {
    canonical_id: 'pfas_free_claim_structurally_verified',
    display_label: 'PFAS-free claim structurally verified by material',
    description:
      'PFAS-free claim on an inherently PFAS-free inert food-contact material — not a vague coated/plastic marketing claim.',
    aliases: [],
    mapping_rule_id: 'safety_pfas_free_structural_v1',
    taxonomy_file: 'safety-claim-taxonomy.mjs',
  },
  {
    canonical_id: 'pfas_free_marketing_claim',
    display_label: 'PFAS-free marketing claim',
    description:
      'Explicit PFAS-free claim on coated/plastic/proprietary materials — requires scrutiny; not structurally verified.',
    aliases: [/pfas[-\s]?free/i],
    mapping_rule_id: 'safety_pfas_free_literal_v1',
    taxonomy_file: 'safety-claim-taxonomy.mjs',
  },
  {
    canonical_id: 'non_toxic_marketing_claim',
    display_label: 'Non-toxic marketing claim (not confirmed safety)',
    description: 'Non-toxic / toxin-free retailer marketing — not a safety verification.',
    aliases: [/non[-\s]?toxic/i, /toxin[-\s]?free/i],
    mapping_rule_id: 'safety_non_toxic_marketing_v1',
    taxonomy_file: 'safety-claim-taxonomy.mjs',
  },
  {
    canonical_id: 'bpa_free_claim',
    display_label: 'BPA-free claim',
    description: 'Explicit BPA-free structural or marketing claim.',
    aliases: [/bpa[-\s]?free/i],
    mapping_rule_id: 'safety_bpa_free_v1',
    taxonomy_file: 'safety-claim-taxonomy.mjs',
  },
  {
    canonical_id: 'lead_free_claim',
    display_label: 'Lead-free claim',
    description: 'Lead-free claim in manufacturer or retailer copy.',
    aliases: [/lead[-\s]?free/i],
    mapping_rule_id: 'safety_lead_free_v1',
    taxonomy_file: 'safety-claim-taxonomy.mjs',
  },
  {
    canonical_id: 'phthalate_free_claim',
    display_label: 'Phthalate-free claim',
    description: 'Phthalate-free claim in copy.',
    aliases: [/phthalate[-\s]?free/i],
    mapping_rule_id: 'safety_phthalate_free_v1',
    taxonomy_file: 'safety-claim-taxonomy.mjs',
  },
]
