/**
 * Ceramic nonstick over hard-anodized aluminum — pattern fixture (not brand-specific).
 */

export const CERAMIC_OVER_HARD_ANODIZED_PRODUCT = {
  product_name: 'Valencia Pro Ceramic Nonstick 10 Inch Frying Pan Skillet with Lid',
  brand: 'ExampleCeramicBrand',
}

export function buildCeramicOverHardAnodizedStructuredEvidence() {
  return {
    product_identity: {
      subcategory: 'cookware',
      brand: CERAMIC_OVER_HARD_ANODIZED_PRODUCT.brand,
      product_name: CERAMIC_OVER_HARD_ANODIZED_PRODUCT.product_name,
    },
    primary_contact_material: {
      material_identity: 'hard_anodized_aluminum',
      confidence_label: 'manufacturer_confirmed',
      source_url: 'https://exampleceramicbrand.us/products/valencia-pro-ceramic-non-stick-covered-frypan-10-inch',
    },
    coatings_and_finishes: [
      {
        coating_name: 'Thermolon Minerals Pro',
        coating_type: 'ceramic_nonstick_unverified',
        composition_disclosed: false,
        source_url: 'https://exampleceramicbrand.us/products/valencia-pro-ceramic-non-stick-covered-frypan-10-inch',
      },
    ],
    secondary_components: [
      {
        component_role: 'handle',
        material_identity: 'stainless_steel',
        confidence_label: 'manufacturer_confirmed',
      },
    ],
    safety_claims: {
      pfas_free_marketing_claim: {
        claimed: true,
        source_url: 'https://exampleceramicbrand.us/products/valencia-pro-ceramic-non-stick-covered-frypan-10-inch',
        source_quote: 'PFAS-free ceramic nonstick',
      },
    },
    retailer_links: {
      amazon_url: 'https://www.walmart.com/ip/example-ceramic-10-inch-frypan/123',
      manufacturer_direct_url:
        'https://exampleceramicbrand.us/products/valencia-pro-ceramic-non-stick-covered-frypan-10-inch',
    },
  }
}

export function buildCeramicOverHardAnodizedSources() {
  return [
    {
      source_type: 'manufacturer',
      url: 'https://exampleceramicbrand.us/products/valencia-pro-ceramic-non-stick-covered-frypan-10-inch',
      title: '',
      page_excerpt: '',
    },
    {
      source_type: 'retailer',
      url: 'https://www.walmart.com/ip/example-ceramic-8-inch-frypan/456',
      title: '8 inch ceramic fry pan',
      page_excerpt: 'Thermolon ceramic nonstick 8 inch skillet',
    },
    {
      source_type: 'retailer',
      url: 'https://www.walmart.com/ip/example-ceramic-10-inch-frypan/123',
      title: '10 inch ceramic fry pan with lid',
      page_excerpt: 'Thermolon Minerals Pro ceramic nonstick 10 inch covered frypan',
    },
  ]
}

export const CERAMIC_OVER_ALUMINUM_COMPOUND_RAW =
  'thermolon_minerals_pro_ceramic_nonstick_over_hard_anodized_aluminum_with_stainless_induction_base'
