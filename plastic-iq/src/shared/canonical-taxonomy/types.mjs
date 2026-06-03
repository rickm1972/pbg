/**
 * @typedef {object} TaxonomyEntry
 * @property {string} canonical_id
 * @property {string} display_label
 * @property {string} description
 * @property {RegExp[]} aliases
 * @property {string} [mapping_rule_id]
 * @property {string} [agent2_material_id]
 * @property {string} taxonomy_file
 */

/**
 * @typedef {object} CanonicalFieldMapping
 * @property {string} field_key
 * @property {string} raw_value
 * @property {string} canonical_id
 * @property {string | null} mapping_rule_id
 * @property {string | null} source_url
 * @property {string | null} source_quote
 * @property {string | null} confidence_label
 * @property {string | null} [display_label]
 * @property {string | null} [taxonomy_file]
 * @property {string | null} [agent2_material_id]
 */

/**
 * @typedef {object} CanonicalMappingsPayload
 * @property {string} schema_version
 * @property {CanonicalFieldMapping} [primary_contact_material_id]
 * @property {CanonicalFieldMapping} [substrate_material_id]
 * @property {CanonicalFieldMapping} [coating_modifier_id]
 * @property {CanonicalFieldMapping} [pfas_status_id]
 * @property {Record<string, CanonicalFieldMapping>} [safety_claim_ids]
 * @property {CanonicalFieldMapping[]} [regulatory_flag_ids]
 * @property {Record<string, CanonicalFieldMapping>} [secondary_component_material_ids]
 * @property {Record<string, CanonicalFieldMapping>} [certification_ids]
 * @property {string[]} [blockers]
 */

export {}
