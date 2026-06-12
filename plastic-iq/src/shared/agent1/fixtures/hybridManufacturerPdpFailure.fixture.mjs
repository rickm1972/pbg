/**
 * Hybrid coated cookware manufacturer-PDP failure pattern (no live product_id).
 * Models: retailer PDP + brand-only/wrong-region manufacturer + correct PDP in candidate set + third-party blog PTFE context.
 */

export const FIXTURE_BRAND = 'ExampleBrand'
export const FIXTURE_PRODUCT_NAME = 'ExampleBrand Hybrid Nonstick 10 Inch Fry Pan'

export const FIXTURE_RETAILER_PDP = {
  url: 'https://www.amazon.com/dp/B0EXAMPLE01',
  title: 'ExampleBrand Hybrid Nonstick 10 Inch Fry Pan',
  page_excerpt:
    'Hybrid stainless nonstick fry pan with proprietary ceramic nonstick valleys. PFAS-free. PTFE-free. Dishwasher safe.',
  source_type: 'amazon',
}

export const FIXTURE_MANUFACTURER_HOMEPAGE = {
  url: 'https://examplebrand.com/',
  title: 'ExampleBrand — Official Cookware',
  page_excerpt: 'Welcome to ExampleBrand. Shop our hybrid cookware collection.',
  source_type: 'manufacturer',
}

export const FIXTURE_MANUFACTURER_WRONG_REGION = {
  url: 'https://examplebrand.eu/collections/fry-pans',
  title: 'ExampleBrand EU Fry Pans',
  page_excerpt: 'Shop fry pans — ExampleBrand EU store.',
  source_type: 'manufacturer',
}

export const FIXTURE_MANUFACTURER_VALID_PDP = {
  url: 'https://examplebrand.com/products/10-hybrid-fry-pan',
  title: 'ExampleBrand 10" Hybrid Fry Pan — TerraBond ceramic nonstick',
  page_excerpt:
    'ExampleBrand Hybrid Nonstick 10 Inch Fry Pan with TerraBond proprietary ceramic nonstick coating. PFAS-free. PTFE-free. See third-party lab results for PFAS non-detect testing.',
  source_type: 'manufacturer',
}

export const FIXTURE_MANUFACTURER_LAB_RESULT = {
  url: 'https://examplebrand.com/pages/lab-results-terrabond',
  title: 'TerraBond third-party PFAS test results',
  page_excerpt:
    'Third-party lab test report: PFAS non-detect. PTFE non-detect. Manufacturer-published test results for TerraBond coating.',
  source_type: 'manufacturer',
}

export const FIXTURE_THIRD_PARTY_BLOG = {
  url: 'https://theenvironmentalblog.org/example-hybrid-pan-review',
  title: 'Example hybrid pan uses PFOA-free PTFE nonstick coating',
  page_excerpt:
    'This hybrid pan review notes a PFOA-free PTFE nonstick coating from an older formulation context.',
  source_type: 'third_party_review',
}

export function buildHybridManufacturerPdpFailureSources() {
  return [
    FIXTURE_RETAILER_PDP,
    FIXTURE_MANUFACTURER_HOMEPAGE,
    FIXTURE_MANUFACTURER_WRONG_REGION,
    FIXTURE_MANUFACTURER_VALID_PDP,
    FIXTURE_MANUFACTURER_LAB_RESULT,
    FIXTURE_THIRD_PARTY_BLOG,
  ]
}

export function buildHybridManufacturerPdpFailureStructured() {
  return {
    product_identity: {
      product_name: FIXTURE_PRODUCT_NAME,
      brand: FIXTURE_BRAND,
      subcategory: 'Cookware',
    },
    primary_contact_material: {
      material_identity: 'terrabond_proprietary',
      confidence_label: 'manufacturer_confirmed',
      source_url: FIXTURE_RETAILER_PDP.url,
    },
    coatings_and_finishes: [
      {
        coating_name: 'TerraBond proprietary ceramic nonstick',
        coating_type: 'proprietary_undisclosed',
        source_url: FIXTURE_RETAILER_PDP.url,
      },
    ],
    safety_claims: {
      pfas_free_claim: {
        claimed: true,
        source_quote: 'PFAS-free and PTFE-free',
        source_url: FIXTURE_RETAILER_PDP.url,
      },
      pfoa_free_claim: {
        claimed: true,
        source_quote: 'PFOA-free',
        source_url: FIXTURE_RETAILER_PDP.url,
      },
    },
    retailer_links: {
      amazon_url: FIXTURE_RETAILER_PDP.url,
      manufacturer_direct_url: FIXTURE_MANUFACTURER_HOMEPAGE.url,
    },
  }
}

export function buildHybridManufacturerPdpFailureProduct() {
  return {
    product_name: FIXTURE_PRODUCT_NAME,
    brand: FIXTURE_BRAND,
  }
}
