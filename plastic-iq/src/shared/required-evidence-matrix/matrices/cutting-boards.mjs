import { baseProductIdentityFields, baseRetailerLinks } from './_shared.mjs'

/** @type {import('../types.mjs').SubcategoryMatrix} */
export const CUTTING_BOARDS_MATRIX = {
  subcategory_key: 'cutting_boards',
  display_label: 'Cutting boards',
  product_identity_fields: [...baseProductIdentityFields(), ...baseRetailerLinks()],
  material_component_fields: [
    {
      id: 'material.primary_contact_raw',
      label: 'Cutting surface material (raw)',
      category: 'material_component',
      field_path: 'primary_contact_material.material_identity',
      required: true,
      score_driving: true,
    },
    {
      id: 'canonical.primary_contact_material_id',
      label: 'Primary contact material (canonical)',
      category: 'canonical',
      field_path: 'canonical_mappings.primary_contact_material_id',
      required: true,
      score_driving: true,
    },
  ],
  safety_claim_fields: [
    {
      id: 'safety.safety_claims_block',
      label: 'Safety claims block populated',
      category: 'safety_claim',
      field_path: 'safety_claims',
      required: true,
      score_driving: true,
    },
  ],
  use_care_fields: [
    {
      id: 'use.product_use_case',
      label: 'Product use case',
      category: 'use_care',
      field_path: 'product_use_case',
      required: true,
      score_driving: false,
    },
  ],
  optional_fields: [],
  non_score_fields: ['ingredient_list', 'coatings_and_finishes'],
  external_checks: [
    {
      id: 'external.sources_documented',
      label: 'At least one evidence source URL on file',
      category: 'external_check',
      score_driving: false,
    },
    {
      id: 'external.bamboo_binder_finish',
      label: 'Bamboo / wood composite binder & finish disclosure',
      category: 'external_check',
      pattern_trigger: 'bamboo_wood_composite',
      score_driving: true,
    },
    {
      id: 'external.plastic_food_contact_disclosure',
      label: 'Plastic cutting-surface disclosure',
      category: 'external_check',
      pattern_trigger: 'plastic_food_contact',
      score_driving: true,
    },
  ],
}
