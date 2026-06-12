/**
 * Test-only product-type configs — not loaded in production registry bootstrap.
 * Used by Phase 0.5 verification tests to prove no-code composability.
 */

/** @type {import('../schema.mjs').ProductTypeRegistryConfig} */
export const TUMBLER_TEST_CONFIG = {
  registry_key: 'kitchen.drinkware.tumbler',
  category: 'Kitchen',
  subcategory: 'Drinkware',
  product_type: 'Tumbler',
  subcategory_aliases: ['tumbler'],
  contact_model_refs: ['drink_contact', 'indirect_contact'],
  exposure_modifier_refs: ['repeated_daily_use', 'wet', 'heat', 'freezing'],
  component_schema: [
    {
      role_ref: 'primary_contact_surface',
      material_class_refs: ['stainless_steel', 'plastics_resins', 'glass', 'silicone'],
    },
    { role_ref: 'lid_cap', material_class_refs: ['plastics_resins', 'stainless_steel'] },
    { role_ref: 'seal_gasket', material_class_refs: ['silicone', 'rubber_elastomers'] },
    { role_ref: 'straw_spout', material_class_refs: ['plastics_resins', 'silicone'] },
  ],
  material_class_refs: ['stainless_steel', 'plastics_resins', 'glass', 'silicone', 'rubber_elastomers'],
  chemical_family_refs: ['bisphenols_bpa_bps', 'phthalates'],
  claim_family_refs: ['bpa_free', 'food_grade'],
  required_evidence_fields: ['material.primary_contact_raw', 'material.primary_contact_canonical'],
  disclosure_rule_refs: ['drinkware_transparency'],
  matrix_key: 'drinkware',
  source_requirements: ['retailer_primary'],
  scoring_assumption_ref: 'v2.3.5.drinkware',
  display_template_refs: ['drinkware_description'],
  fixture_refs: [],
  secondary_material_policy_ref: 'drinkware_suppress_internal_cores',
}

/** Product identity with no registry config — subcategory avoids drinkware alias collision. */
export const UNCONFIGURED_TEST_PRODUCT = {
  product_id: '00000000-0000-4000-8000-000000000099',
  product_name: 'Verification Unconfigured Test Vessel',
  category: 'Kitchen',
  subcategory: 'Unconfigured Test Vessel',
  product_type: 'Unconfigured Test Vessel',
  active: true,
  agent_status: 'new',
}
