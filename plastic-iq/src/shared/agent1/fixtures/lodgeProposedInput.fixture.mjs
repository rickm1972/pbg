/**
 * Lodge cast iron — simple inert proposed-input fixture (Phase 2 tests).
 */

export const FIXTURE_LODGE_PRODUCT = {
  product_id: '00000000-0000-4000-8000-000000000001',
  product_name: 'Lodge Cast Iron Skillet 10.25 inch',
  brand: 'Lodge',
  category: 'Kitchen',
  subcategory: 'Cookware',
}

export function buildLodgeProposedInputStructured() {
  const mfrUrl = 'https://www.lodgecastiron.com/product/10-25-inch-cast-iron-skillet'
  return {
    schema_version: '1.0',
    product_identity: {
      product_name: FIXTURE_LODGE_PRODUCT.product_name,
      brand: 'Lodge',
      subcategory: 'Frying Pan / Skillet',
      sku_or_model: 'L10SK3',
    },
    primary_contact_material: {
      material_identity: 'cast_iron',
      confidence_label: 'manufacturer_confirmed',
      source_url: mfrUrl,
      material_specs_disclosed: true,
    },
    secondary_components: [
      {
        component_role: 'handle',
        material_identity: 'cast_iron',
        source_url: mfrUrl,
      },
    ],
    coatings_and_finishes: [],
    product_use_case: 'Stovetop frying, sautéing, and oven use',
    safety_claims: {
      pfas_free_claim: { claimed: false },
      bpa_free_claim: { claimed: false },
    },
    retailer_links: {
      amazon_url: 'https://www.amazon.com/dp/B00006JSUA',
      manufacturer_direct_url: mfrUrl,
    },
    canonical_mappings: {
      schema_version: '3.8',
      primary_contact_material_id: {
        field_key: 'primary_contact_material_id',
        raw_value: 'cast_iron',
        canonical_id: 'cast_iron',
        source_url: mfrUrl,
        confidence_label: 'manufacturer_confirmed',
        display_label: 'Cast iron',
      },
      substrate_material_id: {
        field_key: 'substrate_material_id',
        raw_value: 'cast_iron',
        canonical_id: 'cast_iron_body',
        source_url: mfrUrl,
        confidence_label: 'manufacturer_confirmed',
        display_label: 'Cast iron body',
      },
      coating_modifier_id: {
        field_key: 'coating_modifier_id',
        raw_value: 'none',
        canonical_id: 'no_coating_modifier',
        source_url: mfrUrl,
        confidence_label: 'manufacturer_confirmed',
      },
      pfas_status_id: {
        field_key: 'pfas_status_id',
        raw_value: 'inert material',
        canonical_id: 'pfas_not_present_inert_material',
        source_url: mfrUrl,
        confidence_label: 'manufacturer_confirmed',
      },
      blockers: [],
    },
    transparency_assessment: {
      transparency_badge: 'Fully Disclosed',
      badge_justification: 'Cast iron material disclosed by manufacturer.',
      fully_disclosed_eligible: true,
    },
  }
}

export function buildLodgeProposedInputEvidenceRow() {
  const structured = buildLodgeProposedInputStructured()
  return {
    evidence_id: '00000000-0000-4000-8000-000000000010',
    product_id: FIXTURE_LODGE_PRODUCT.product_id,
    bundle_version: 1,
    review_status: 'pending_review',
    sources: [
      {
        source_type: 'manufacturer',
        url: structured.primary_contact_material.source_url,
        title: 'Lodge 10.25 Inch Cast Iron Skillet',
        page_excerpt: 'Seasoned cast iron skillet. Pre-seasoned with soy-based vegetable oil.',
      },
    ],
    agent_metadata: { structured_evidence: structured },
  }
}
