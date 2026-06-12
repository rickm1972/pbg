/**
 * Gate 1 v7 approval eligibility — hybrid coated + manufacturer modal lab + proprietary review.
 * No product_id; pattern based on HexClad v7 substantive completion.
 */

import { buildManufacturerModalLabSource } from './manufacturerPdpModalLab.fixture.mjs'
import { FIXTURE_RETAILER_PDP } from './hybridManufacturerPdpFailure.fixture.mjs'

export const FIXTURE_HEXCLAD_V7_MANUFACTURER_PDP =
  'https://hexclad.com/collections/fry-pans-deep-sautes/products/10-hexclad-pan'

export function buildGate1ApprovalEligibilityHexCladV7Sources() {
  const modal = buildManufacturerModalLabSource()
  return [
    FIXTURE_RETAILER_PDP,
    {
      ...modal,
      url: FIXTURE_HEXCLAD_V7_MANUFACTURER_PDP,
      page_excerpt: modal.page_excerpt.replace(modal.url, FIXTURE_HEXCLAD_V7_MANUFACTURER_PDP),
    },
  ]
}

export function buildGate1ApprovalEligibilityHexCladV7Structured() {
  const mfrUrl = FIXTURE_HEXCLAD_V7_MANUFACTURER_PDP
  return {
    product_identity: {
      product_name: 'HexClad Hybrid Nonstick 10 Inch Frying Pan',
      brand: 'HexClad',
      subcategory: 'Cookware',
      category: 'Kitchen',
    },
    primary_contact_material: {
      material_identity: 'terrabond_proprietary',
      undisclosed_code: 'PROPRIETARY_NAMED',
      confidence_label: 'manufacturer_confirmed',
      source_url: mfrUrl,
    },
    coatings_and_finishes: [
      {
        coating_name: 'TerraBond proprietary nonstick',
        coating_type: 'proprietary_undisclosed',
        composition_disclosed: false,
        source_url: mfrUrl,
      },
    ],
    secondary_components: [
      {
        component_role: 'handle',
        material_identity: 'stainless_steel',
        source_url: mfrUrl,
      },
    ],
    product_use_case: 'Stovetop frying and sautéing',
    safety_claims: {
      pfas_free_claim: {
        claimed: true,
        source_url: mfrUrl,
        source_quote: 'TerraBond ceramic nonstick is PFAS-free',
      },
      pfoa_free_claim: {
        claimed: true,
        source_url: mfrUrl,
      },
    },
    retailer_links: {
      amazon_url: FIXTURE_RETAILER_PDP.url,
      manufacturer_direct_url: mfrUrl,
    },
    required_check_results: [
      {
        check_id: 'external.coated_product_lab_results',
        status: 'passed',
        detail:
          'Lab/testing evidence retrieved (manufacturer_published_third_party_lab_result).',
        source_url: mfrUrl,
      },
      {
        check_id: 'external.pfoa_vs_pfas_free_distinction',
        status: 'passed',
        detail: 'PFOA-free and PFAS-free claims documented with distinct manufacturer sources',
        source_url: mfrUrl,
      },
    ],
    canonical_mappings: {
      schema_version: '3.5',
      primary_contact_material_id: {
        canonical_id: 'hybrid_stainless_nonstick_food_contact',
        source_url: mfrUrl,
      },
      substrate_material_id: {
        canonical_id: 'stainless_steel_body',
        source_url: mfrUrl,
      },
      coating_modifier_id: {
        canonical_id: 'proprietary_nonstick_coating_undisclosed',
        source_url: mfrUrl,
      },
      pfas_status_id: {
        canonical_id: 'pfas_not_disclosed',
        source_url: mfrUrl,
      },
      safety_claim_ids: {
        pfas_free_marketing_claim: {
          canonical_id: 'pfas_free_marketing_claim',
          source_url: mfrUrl,
          source_quote: 'TerraBond ceramic nonstick is PFAS-free',
        },
        pfoa_free_claim: {
          canonical_id: 'pfoa_free_claim',
          source_url: mfrUrl,
          source_quote: 'PFOA-free',
        },
      },
      blockers: [],
    },
    conflict_and_review: {
      requires_human_review: true,
    },
  }
}

export function buildGate1ApprovalEligibilityHexCladV7Evidence() {
  const sources = buildGate1ApprovalEligibilityHexCladV7Sources()
  const structured = buildGate1ApprovalEligibilityHexCladV7Structured()
  return {
    evidence_id: 'fixture-hexclad-v7',
    product_id: 'fixture-product',
    bundle_version: 7,
    review_status: 'pending_review',
    sources,
    facts: [],
    agent_metadata: {
      structured_evidence: structured,
      minimum_threshold: { met: true, checks: [] },
    },
  }
}
