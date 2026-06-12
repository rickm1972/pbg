/**
 * Regression fixture — hybrid stainless + proprietary nonstick food-contact pattern.
 * HexClad-style evidence shape; no product_id or brand hardcoding in tests.
 */

/** @returns {object} structured_evidence-shaped payload (pre-mapping) */
export function buildHybridNonstickCookwareStructuredEvidence() {
  return {
    schema_version: '3.8',
    product_identity: {
      product_name: 'Hybrid Nonstick 10 Inch Frying Pan with Tempered Glass Lid',
      brand: 'Example Hybrid Brand',
      subcategory: 'Cookware',
      sku_or_model: 'B09Y25BY8G',
      country_of_origin: 'China',
      country_null_code: null,
    },
    primary_contact_material: {
      material_identity: 'stainless_steel',
      undisclosed_code: null,
      source_url: 'https://example.com/hybrid-pan',
      confidence_label: 'manufacturer_confirmed',
      material_specs_disclosed: false,
    },
    secondary_components: [
      {
        component_role: 'lid',
        material_identity: 'tempered_glass',
        source_url: 'https://example.com/hybrid-pan',
        confidence_label: 'retailer_confirmed',
        null_code: null,
      },
      {
        component_role: 'handle',
        material_identity: 'stainless_steel',
        source_url: 'https://example.com/hybrid-pan',
        confidence_label: 'retailer_confirmed',
        null_code: null,
      },
    ],
    coatings_and_finishes: [
      {
        coating_name: 'TerraBond proprietary ceramic nonstick',
        coating_type: 'proprietary_undisclosed',
        composition_disclosed: false,
        source_url: 'https://example.com/hybrid-pan-faq',
        third_party_verified: false,
      },
    ],
    safety_claims: {
      pfas_free_claim: {
        claimed: true,
        source_url: 'https://example.com/hybrid-pan-faq',
        source_quote: 'PFAS-free TerraBond ceramic nonstick coating',
        structural_guarantee: false,
        structural_basis: null,
      },
      bpa_free_claim: { claimed: false, source_url: null, structural_guarantee: false, structural_basis: null },
      phthalate_free_claim: { claimed: false, source_url: null, structural_guarantee: false, structural_basis: null },
      lead_free_claim: { claimed: false, source_url: null, structural_guarantee: false, structural_basis: null },
      non_toxic_claim: { claimed: false, source_url: null, structural_guarantee: false, structural_basis: null },
      independent_testing_documented: false,
      testing_source_url: null,
    },
    conflict_and_review: {
      class_action_history: false,
      class_action_sources: [],
      conflicting_evidence: [
        {
          topic: 'historical_ptfe_formulation',
          detail: 'Third-party context source describes PTFE on older SKU formulation — not matched to current B09Y25BY8G TerraBond listing.',
          source_url: 'https://example.com/context-ptfe-review',
        },
      ],
      requires_human_review: true,
    },
    retailer_links: {
      amazon_url: 'https://example.com/hybrid-pan',
      manufacturer_direct_url: 'https://example.com/hybrid-pan-faq',
      walmart_url: null,
      target_url: null,
    },
    product_use_case: 'Hybrid stainless nonstick frying pan',
    care_and_use_instructions: null,
  }
}

/** Misclassified collapse fixture — the blind spot HexClad exposed. */
export function buildHybridCollapsedToInertMappings() {
  return {
    schema_version: '3.8',
    safety_claim_ids: {},
    regulatory_flag_ids: [],
    blockers: [],
    primary_contact_material_id: {
      field_key: 'primary_contact_material_id',
      canonical_id: 'stainless_steel_unspecified',
      raw_value: 'stainless_steel',
      confidence_label: 'retailer_confirmed',
      source_url: 'https://example.com/hybrid-pan',
    },
    coating_modifier_id: {
      field_key: 'coating_modifier_id',
      canonical_id: 'no_coating_modifier',
      raw_value: 'uncoated / no coating modifier',
      confidence_label: 'retailer_confirmed',
      source_url: 'https://example.com/hybrid-pan',
    },
    pfas_status_id: {
      field_key: 'pfas_status_id',
      canonical_id: 'pfas_not_present_inert_material',
      raw_value: 'Inert food-contact material',
      confidence_label: 'retailer_confirmed',
      source_url: 'https://example.com/hybrid-pan',
    },
    substrate_material_id: {
      field_key: 'substrate_material_id',
      canonical_id: 'stainless_steel_body',
      raw_value: 'stainless_steel',
      confidence_label: 'retailer_confirmed',
      source_url: 'https://example.com/hybrid-pan',
    },
  }
}
