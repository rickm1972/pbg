/** @typedef {import('./types.mjs').TaxonomyEntry} TaxonomyEntry */

/** @type {TaxonomyEntry[]} */
export const COMPONENT_TYPE_TAXONOMY = [
  { canonical_id: 'handle', display_label: 'Handle', description: 'Cookware handle component.', aliases: [/handle/i], mapping_rule_id: 'component_handle_v1', taxonomy_file: 'component-type-taxonomy.mjs' },
  { canonical_id: 'lid', display_label: 'Lid', description: 'Cookware lid.', aliases: [/lid/i], mapping_rule_id: 'component_lid_v1', taxonomy_file: 'component-type-taxonomy.mjs' },
  { canonical_id: 'rivet', display_label: 'Rivet', description: 'Riveted attachment.', aliases: [/rivet/i], mapping_rule_id: 'component_rivet_v1', taxonomy_file: 'component-type-taxonomy.mjs' },
  { canonical_id: 'gasket', display_label: 'Gasket / seal', description: 'Gasket or seal component.', aliases: [/gasket/i, /seal/i], mapping_rule_id: 'component_gasket_v1', taxonomy_file: 'component-type-taxonomy.mjs' },
]
