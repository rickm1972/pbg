/** @typedef {import('../types.mjs').MatrixFieldRequirement} MatrixFieldRequirement */

/** @returns {MatrixFieldRequirement[]} */
export function baseProductIdentityFields() {
  return [
    {
      id: 'identity.product_name',
      label: 'Product name',
      category: 'product_identity',
      field_path: 'product_identity.product_name',
      required: true,
      score_driving: false,
    },
    {
      id: 'identity.brand',
      label: 'Brand',
      category: 'product_identity',
      field_path: 'product_identity.brand',
      required: true,
      score_driving: false,
    },
    {
      id: 'identity.subcategory',
      label: 'Subcategory',
      category: 'product_identity',
      field_path: 'product_identity.subcategory',
      required: true,
      score_driving: false,
    },
  ]
}

/** @returns {MatrixFieldRequirement[]} */
export function baseRetailerLinks() {
  return [
    {
      id: 'links.amazon_url',
      label: 'Amazon / retailer URL',
      category: 'product_identity',
      field_path: 'retailer_links.amazon_url',
      required: true,
      score_driving: false,
    },
    {
      id: 'links.manufacturer_url',
      label: 'Manufacturer product URL',
      category: 'product_identity',
      field_path: 'retailer_links.manufacturer_direct_url',
      required: true,
      score_driving: false,
    },
  ]
}

/** @returns {MatrixFieldRequirement[]} */
export function baseCanonicalCookwareMaterials() {
  return [
    {
      id: 'canonical.primary_contact_material_id',
      label: 'Primary contact material (canonical)',
      category: 'canonical',
      field_path: 'canonical_mappings.primary_contact_material_id',
      required: true,
      score_driving: true,
    },
    {
      id: 'canonical.substrate_material_id',
      label: 'Substrate material (canonical)',
      category: 'canonical',
      field_path: 'canonical_mappings.substrate_material_id',
      required: true,
      score_driving: true,
    },
    {
      id: 'canonical.coating_modifier_id',
      label: 'Coating modifier (canonical)',
      category: 'canonical',
      field_path: 'canonical_mappings.coating_modifier_id',
      required: true,
      score_driving: true,
    },
    {
      id: 'canonical.pfas_status_id',
      label: 'PFAS status (canonical)',
      category: 'canonical',
      field_path: 'canonical_mappings.pfas_status_id',
      required: true,
      score_driving: true,
    },
  ]
}
