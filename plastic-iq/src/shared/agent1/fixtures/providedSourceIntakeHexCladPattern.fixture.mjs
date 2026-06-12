/**
 * HexClad-pattern source intake fixture (no live product_id).
 * User-provided US manufacturer PDP is valid; search discovers wrong-region brand-only source.
 */

import {
  FIXTURE_MANUFACTURER_VALID_PDP,
  FIXTURE_MANUFACTURER_WRONG_REGION,
  FIXTURE_RETAILER_PDP,
  FIXTURE_THIRD_PARTY_BLOG,
} from './hybridManufacturerPdpFailure.fixture.mjs'

export const FIXTURE_PROVIDED_MANUFACTURER_PDP = {
  ...FIXTURE_MANUFACTURER_VALID_PDP,
  url: 'https://examplebrand.com/collections/fry-pans/products/10-hybrid-fry-pan',
  page_excerpt:
    'ExampleBrand Hybrid Nonstick 10 Inch Fry Pan. TerraBond proprietary ceramic nonstick coating valleys. PFAS-free. PTFE-free. Stainless hybrid construction. Third-party lab results linked.',
}

export function buildProvidedIntakeHexCladPatternProduct() {
  return {
    product_name: 'ExampleBrand Hybrid Nonstick 10 Inch Fry Pan',
    brand: 'ExampleBrand',
    amazon_url: FIXTURE_RETAILER_PDP.url,
    affiliate_link: 'https://www.amazon.com/dp/B0EXAMPLE01?tag=affiliate-tag',
    manufacturer_product_url: FIXTURE_PROVIDED_MANUFACTURER_PDP.url,
  }
}

export function buildProvidedIntakeHexCladPatternDiscoveredSources() {
  return [
    FIXTURE_RETAILER_PDP,
    FIXTURE_MANUFACTURER_WRONG_REGION,
    FIXTURE_THIRD_PARTY_BLOG,
  ]
}

export function buildProvidedIntakeHexCladPatternStructuredBeforePriority() {
  return {
    product_identity: {
      product_name: 'ExampleBrand Hybrid Nonstick 10 Inch Fry Pan',
      brand: 'ExampleBrand',
    },
    retailer_links: {
      amazon_url: FIXTURE_RETAILER_PDP.url,
      manufacturer_direct_url: FIXTURE_MANUFACTURER_WRONG_REGION.url,
    },
    primary_contact_material: {
      material_identity: 'terrabond_proprietary',
      source_url: FIXTURE_RETAILER_PDP.url,
    },
  }
}

export function buildProvidedIntakeHexCladPatternIntakeReport() {
  return {
    schema_version: '1.0',
    entries: [
      {
        url: FIXTURE_RETAILER_PDP.url,
        intended_role: 'amazon_evidence',
        assigned_source_role: 'primary_retailer',
        fetch_ok: true,
        validation: { passed: true, issues: [] },
        fields_supported: ['product identity', 'retailer claims'],
        failure_reason: null,
        used_as_primary_evidence: true,
        search_discovered_alternate_url: null,
      },
      {
        url: FIXTURE_PROVIDED_MANUFACTURER_PDP.url,
        intended_role: 'manufacturer_product',
        assigned_source_role: 'manufacturer_primary',
        fetch_ok: true,
        validation: {
          passed: true,
          url_kind: 'product_detail',
          supports_material_evidence: true,
          supports_product_identity: true,
          issues: [],
        },
        fields_supported: ['material/coating evidence', 'product identity'],
        failure_reason: null,
        used_as_primary_evidence: true,
        search_discovered_alternate_url: FIXTURE_MANUFACTURER_WRONG_REGION.url,
      },
    ],
    sources: [
      {
        source_type: 'manufacturer',
        url: FIXTURE_PROVIDED_MANUFACTURER_PDP.url,
        title: FIXTURE_PROVIDED_MANUFACTURER_PDP.title,
        page_excerpt: FIXTURE_PROVIDED_MANUFACTURER_PDP.page_excerpt,
        provided_intake: true,
      },
    ],
  }
}
