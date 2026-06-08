/**
 * Phase 4.5 regression fixture — PTFE/nonstick low-score pattern (not T-Fal product id).
 */

import type {
  AprDisplayPayload,
  AprEvidencePayload,
  AprNormalizationPayload,
  AprQaPayload,
  AprScorePayload,
  ApprovedProductRecord,
  LowScorePublicationReview,
} from '../../../types/apr'
import { assembleApprovedProductRecord, createGateSnapshot } from '../snapshot.ts'
import { buildApprovedLowScoreReview, METHODOLOGY_DISCLAIMER_FIXTURE } from './lowScoreReview.ts'

const PRODUCT_ID = 'fixture-low-score-ptfe-pattern'
const EVIDENCE_ID = 'fixture-evidence-ptfe'
const INPUT_ID = 'fixture-input-ptfe'
const SCORE_ID = 'fixture-score-ptfe'
const QA_ID = 'fixture-qa-ptfe'

const RETAILER_URL = 'https://www.example-retailer.com/ptfe-cookware-set'
const MANUFACTURER_URL = 'https://www.example-brand.com/products/ptfe-nonstick-skillet'

const evidencePayload: AprEvidencePayload = {
  evidence_id: EVIDENCE_ID,
  bundle_version: 1,
  algorithm_version: 'agent1-v1',
  reviewed_identity: {
    product_name: 'Fixture PTFE Nonstick Cookware Set',
    brand: 'Fixture Brand',
    sku_or_model: null,
    primary_retailer_url: RETAILER_URL,
  },
  sources: [
    {
      source_type: 'other_retailer',
      url: RETAILER_URL,
      title: 'Retailer listing — PTFE nonstick coating food-contact surface',
      fetched_at: '2026-06-01T00:00:00Z',
      source_role: 'retailer_primary',
      variant_mismatch: false,
    },
    {
      source_type: 'manufacturer',
      url: MANUFACTURER_URL,
      title: 'Manufacturer product page — PTFE nonstick coating',
      fetched_at: '2026-06-01T00:00:00Z',
      source_role: 'manufacturer',
      variant_mismatch: false,
    },
  ],
  structured_evidence: {
    product_identity: {
      category: 'Kitchen',
      subcategory: 'Cookware',
      product_type: 'Fry pan',
      product_name: 'Fixture PTFE Nonstick Cookware Set',
      brand: 'Fixture Brand',
    },
    canonical_mappings: {
      primary_contact_surface: { canonical_id: 'ptfe_nonstick_coating' },
    },
  },
}

const normalizationPayload: AprNormalizationPayload = {
  input_id: INPUT_ID,
  evidence_id: EVIDENCE_ID,
  evidence_content_hash: '',
  algorithm_version: 'agent2-v1',
  components: [
    {
      component_name: 'Food contact coating',
      component_role: 'primary_food_contact',
      material_id: 'ptfe_nonstick_coating',
      material: 'PTFE nonstick coating, titanium reinforced',
      material_hazard: 0.85,
      adjusted_migration_potential: 0.7,
      contact_intimacy: 1,
      exposure_severity: 0.9,
      severity_justification: 'Direct food contact',
      exposure_duration: 0.8,
      duration_justification: 'Typical cookware use',
    },
  ],
  layer_4a: null,
  layer_4b: { transparency_badge: 'Documentation Incomplete' },
}

function buildDisplay(evidenceHash: string, normalizationHash: string): AprDisplayPayload {
  return {
    input_id: INPUT_ID,
    evidence_id: EVIDENCE_ID,
    evidence_content_hash: evidenceHash,
    normalization_content_hash: normalizationHash,
    product_title: 'Fixture PTFE Nonstick Cookware Set',
    primary_material: 'PTFE nonstick coating, titanium reinforced',
    disclosure_sentence:
      'No third-party certification found; reviewed materials identify PTFE nonstick coating in the food-contact layer.',
    product_description:
      'This product scores lower under our PAC Safety Score methodology because reviewed materials identify PTFE nonstick coating in the food-contact layer. The score reflects food-contact material, coating, use conditions, and disclosure quality.',
    secondary_materials: [{ name: 'Hard anodized aluminum', note: null }],
    coatings: 'PTFE nonstick coating',
    use_conditions: ['Oven heat with fat exposure', 'Stovetop heat with fat exposure'],
    disclosure_quality: 'Documentation Incomplete',
    cert_line:
      'No third-party certification found; reviewed materials identify PTFE nonstick coating in the food-contact layer.',
    risk_bars: [
      {
        id: 'material',
        label: 'Contact material: PTFE coating',
        fill_percent: 15,
        color_token: 'red',
        status_label: 'High concern · PTFE coating',
      },
    ],
    sources: [
      {
        url: RETAILER_URL,
        group: 'Retailer',
        label: 'Example Retailer — PTFE cookware listing',
        public_source_eligible: true,
        source_role: 'retailer_primary',
        variant_mismatch: false,
        footnote: null,
      },
    ],
    buy_cta: [{ label: 'Buy on Example Retailer', url: RETAILER_URL }],
    why_this_score: {
      primary_material: 'PTFE nonstick coating, titanium reinforced',
      secondary_materials: ['Hard anodized aluminum'],
      coatings: 'PTFE nonstick coating',
      use_conditions: ['Oven heat with fat exposure', 'Stovetop heat with fat exposure'],
      disclosure_quality: 'Documentation Incomplete',
      cert_line:
        'No third-party certification found; reviewed materials identify PTFE nonstick coating in the food-contact layer.',
      sections: [
        {
          title: 'Primary material',
          items: [{ text: 'PTFE nonstick coating, titanium reinforced', note: null }],
        },
      ],
    },
    badge_summary: 'Documentation Incomplete — coating identified; disclosure gaps remain.',
    buy_section_title: 'Where to buy',
    retailer_caution_note: 'This product is rated High Risk by PlasticBegone.',
    sources_intro: 'Sources used for this score.',
    methodology_disclaimer: METHODOLOGY_DISCLAIMER_FIXTURE,
    low_score_last_reviewed_at: '2026-06-05',
  }
}

export function buildLowScorePtfePatternFixtureApr(
  review?: LowScorePublicationReview | null,
): ApprovedProductRecord {
  const evidence = createGateSnapshot({
    snapshot_id: 'snap-evidence-ptfe-fixture',
    product_id: PRODUCT_ID,
    gate: 'evidence',
    approved_at: '2026-06-01T00:00:00Z',
    payload: evidencePayload,
  })

  normalizationPayload.evidence_content_hash = evidence.content_hash
  const normalization = createGateSnapshot({
    snapshot_id: 'snap-normalization-ptfe-fixture',
    product_id: PRODUCT_ID,
    gate: 'normalization',
    approved_at: '2026-06-01T00:00:00Z',
    parent_hashes: { evidence: evidence.content_hash },
    payload: normalizationPayload,
  })

  const displayPayload = buildDisplay(evidence.content_hash, normalization.content_hash)
  const display = createGateSnapshot({
    snapshot_id: 'snap-display-ptfe-fixture',
    product_id: PRODUCT_ID,
    gate: 'display',
    approved_at: '2026-06-01T00:00:00Z',
    parent_hashes: {
      evidence: evidence.content_hash,
      normalization: normalization.content_hash,
    },
    payload: displayPayload,
  })

  const scorePayload: AprScorePayload = {
    score_id: SCORE_ID,
    input_id: INPUT_ID,
    normalization_content_hash: normalization.content_hash,
    display_content_hash: display.content_hash,
    pac_safety_score: 2,
    tier: 'High Risk',
    displayed_confidence_range: '0–8',
    transparency_badge: 'Documentation Incomplete',
    weighted_npr: 0.9,
    escalator_applied: null,
    layer_4a_net: 0,
    algorithm_version: 'v2.3.4',
  }

  const score = createGateSnapshot({
    snapshot_id: 'snap-score-ptfe-fixture',
    product_id: PRODUCT_ID,
    gate: 'score',
    approved_at: '2026-06-01T00:00:00Z',
    parent_hashes: {
      normalization: normalization.content_hash,
      display: display.content_hash,
    },
    payload: scorePayload,
  })

  const qaPayload: AprQaPayload = {
    qa_id: QA_ID,
    score_content_hash: score.content_hash,
    display_content_hash: display.content_hash,
    preflight: { passed: true, checked_at: '2026-06-01T00:00:00Z', checks: [] },
    checks: {},
    low_score_publication_review:
      review === undefined
        ? buildApprovedLowScoreReview({
            score: 2,
            primary_score_driving_concern: 'PTFE nonstick coating',
          })
        : review,
  }

  const qa = createGateSnapshot({
    snapshot_id: 'snap-qa-ptfe-fixture',
    product_id: PRODUCT_ID,
    gate: 'qa',
    approved_at: '2026-06-01T00:00:00Z',
    parent_hashes: { score: score.content_hash, display: display.content_hash },
    payload: qaPayload,
  })

  return assembleApprovedProductRecord({
    apr_id: 'apr-fixture-ptfe-pattern',
    product_id: PRODUCT_ID,
    assembled_at: '2026-06-01T00:00:00Z',
    evidence,
    normalization,
    display,
    score,
    qa,
  })
}
