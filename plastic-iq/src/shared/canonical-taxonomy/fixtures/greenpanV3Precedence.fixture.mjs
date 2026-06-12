/**
 * GreenPan v3 precedence regression — ceramic extraction correct but third-party TerraBond context must not win.
 * Pattern fixture; no product_id hardcoding in mapper logic.
 */

export const GREENPAN_V3_PRODUCT = {
  product_name: 'GreenPan Valencia Pro Ceramic Nonstick 10” Frying Pan Skillet with Lid',
  brand: 'GreenPan',
}

/** Mirrors Agent 1 v3 structured_evidence shape (pre-mapping). */
export function buildGreenPanV3StructuredEvidence() {
  return {
    product_identity: {
      subcategory: 'Cookware',
      brand: GREENPAN_V3_PRODUCT.brand,
      product_name: GREENPAN_V3_PRODUCT.product_name,
    },
    primary_contact_material: {
      material_identity: 'thermolon_minerals_pro_ceramic_nonstick',
      confidence_label: 'manufacturer_confirmed',
    },
    coatings_and_finishes: [
      {
        coating_name: 'Thermolon Minerals Pro',
        coating_type: 'ceramic_nonstick_unverified',
        composition_disclosed: false,
      },
    ],
    secondary_components: [
      { component_role: 'other', material_identity: 'hard_anodized_aluminum' },
      { component_role: 'handle', material_identity: 'stainless_steel' },
      { component_role: 'lid', material_identity: 'tempered_glass' },
      { component_role: 'base', material_identity: 'magneto_magnetic_stainless_base' },
    ],
    safety_claims: {
      pfas_free_marketing_claim: { claimed: true, source_quote: 'PFAS-free ceramic nonstick' },
    },
    retailer_links: {
      manufacturer_direct_url:
        'https://www.greenpan.us/products/valencia-pro-ceramic-non-stick-covered-frypan-10-inch',
    },
  }
}

/** Third-party HexClad comparison mentioning TerraBond — must not hijack ceramic canonical. */
export function buildGreenPanV3SourcesWithTerrabondContext() {
  return [
    {
      source_type: 'manufacturer',
      url: 'https://www.greenpan.us/products/valencia-pro-ceramic-non-stick-covered-frypan-10-inch',
      title: 'Valencia Pro 10" Frypan w/ Lid | GreenPan Official Store',
      page_excerpt: 'Hard Anodized PFAS-Free Cookware. Thermolon Minerals Pro ceramic nonstick coating.',
    },
    {
      source_type: 'third_party_review',
      url: 'https://www.leafscore.com/eco-friendly-kitchen-products/cookware/are-hexclad-pans-worth-it-not-if-ptfe-is-a-concern/',
      title: 'Are HexClad pans worth it?',
      page_excerpt:
        'proprietary HEXCLAD TERRABOND™ ceramic and that it is PTFE-free and PFAS-free. high-grade proprietary ceramic nonstick called TerraBond™',
    },
    {
      source_type: 'retailer',
      url: 'https://www.walmart.com/ip/greenpan-valencia-pro-10-inch-frypan/123',
      title: 'GreenPan Valencia Pro Ceramic Nonstick 10 inch Frying Pan Skillet with Lid',
      page_excerpt: 'Thermolon Minerals Pro diamond-infused ceramic nonstick over hard anodized aluminum',
    },
  ]
}
