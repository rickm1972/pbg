/**
 * GreenPan Gate 1 v7 approval eligibility — ceramic/hard-anodized, no lab evidence, granular subcategory.
 * Pattern fixture only; no product_id in eligibility logic.
 */

import { buildCeramicOverHardAnodizedSources } from '../../canonical-taxonomy/fixtures/ceramicOverHardAnodized.fixture.mjs'
import { buildGreenPanLeafscoreSource } from './greenpanLeafscoreLab.fixture.mjs'
import { buildGreenPanFaqSource } from './greenpanFaqLab.fixture.mjs'

const MFR_URL =
  'https://www.greenpan.us/products/valencia-pro-ceramic-non-stick-covered-frypan-10-inch'

export function buildGate1ApprovalEligibilityGreenPanV7Sources() {
  const base = buildCeramicOverHardAnodizedSources()
  const leaf = buildGreenPanLeafscoreSource()
  const faq = buildGreenPanFaqSource()
  const labLinkMention = {
    source_type: 'manufacturer',
    url: MFR_URL,
    title: 'Valencia Pro 10" Frypan | GreenPan',
    page_excerpt:
      'Thermolon Minerals Pro ceramic nonstick. PFAS-free. See our third-party lab test results for non-detect PFAS.',
  }
  return [...base.filter((s) => s.url !== MFR_URL), labLinkMention, leaf, faq]
}

export function buildGate1ApprovalEligibilityGreenPanV7Structured() {
  return {
    product_identity: {
      brand: 'GreenPan',
      subcategory: 'Frying Pan / Skillet',
      product_name: 'GreenPan Valencia Pro Ceramic Nonstick 10" Frying Pan Skillet with Lid',
      sku_or_model: 'CC000670-001',
    },
    primary_contact_material: {
      material_identity: 'thermolon_minerals_pro_ceramic_nonstick',
      undisclosed_code: 'PROPRIETARY_NAMED',
      confidence_label: 'manufacturer_confirmed',
      source_url: MFR_URL,
    },
    coatings_and_finishes: [
      {
        coating_name: 'Thermolon Minerals Pro',
        coating_type: 'ceramic_nonstick_unverified',
        composition_disclosed: false,
        source_url: MFR_URL,
      },
    ],
    secondary_components: [
      { component_role: 'body', material_identity: 'hard_anodized_aluminum', source_url: MFR_URL },
      { component_role: 'handle', material_identity: 'stainless_steel', source_url: MFR_URL },
    ],
    product_use_case: 'Stovetop frying and sautéing',
    safety_claims: {
      pfas_free_marketing_claim: {
        claimed: true,
        source_url: MFR_URL,
        source_quote: 'PFAS-free ceramic nonstick',
      },
      pfoa_free_claim: {
        claimed: true,
        source_url: MFR_URL,
        source_quote: 'PFOA-free',
      },
    },
    retailer_links: {
      amazon_url: 'https://www.amazon.com/dp/B09EXAMPLE',
      manufacturer_direct_url: MFR_URL,
    },
    required_check_results: [
      {
        check_id: 'external.coated_product_lab_results',
        status: 'failed',
        detail:
          'LAB_RESULTS_LINK_NOT_RETRIEVED: claim references lab results but linked report was not retrieved.',
        source_url: MFR_URL,
      },
      {
        check_id: 'external.pfoa_vs_pfas_free_distinction',
        status: 'passed',
        detail: 'PFOA-free and PFAS-free claims documented with distinct manufacturer sources',
        source_url: MFR_URL,
      },
    ],
    canonical_mappings: {
      schema_version: '3.5',
      primary_contact_material_id: {
        canonical_id: 'ceramic_nonstick_sol_gel_coating',
        source_url: MFR_URL,
      },
      substrate_material_id: {
        canonical_id: 'hard_anodized_aluminum',
        source_url: MFR_URL,
      },
      coating_modifier_id: {
        canonical_id: 'proprietary_nonstick_coating_undisclosed',
        source_url: MFR_URL,
      },
      pfas_status_id: {
        canonical_id: 'pfas_not_disclosed',
        source_url: MFR_URL,
      },
      safety_claim_ids: {
        pfoa_free_claim: {
          canonical_id: 'pfoa_free_claim',
          source_url: MFR_URL,
          source_quote: 'PFOA-free',
        },
        pfas_free_marketing_claim: {
          canonical_id: 'pfas_free_marketing_claim',
          source_url: MFR_URL,
          source_quote: 'PFAS-free ceramic nonstick',
        },
      },
    },
    agent1_source_validation: {
      blockers: [
        'LAB_RESULTS_LINK_NOT_RETRIEVED: PFAS/PTFE-free claim references lab results but linked test report was not retrieved.',
      ],
      warnings: [
        'NO_THIRD_PARTY_TESTING_FOUND: No third-party lab/testing evidence retrieved after targeted search for coated product claims.',
      ],
      lab_result_retrieval: {
        retrieved_lab_result: false,
        codes: ['LAB_RESULTS_LINK_NOT_RETRIEVED', 'NO_THIRD_PARTY_TESTING_FOUND'],
      },
    },
  }
}
