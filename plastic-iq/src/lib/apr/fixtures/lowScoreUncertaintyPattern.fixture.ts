/**
 * Phase 4.5 regression fixture — Caution-range uncertainty/disclosure pattern (not Caraway product id).
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

const PRODUCT_ID = 'fixture-low-score-uncertainty-pattern'
const EVIDENCE_ID = 'fixture-evidence-uncertainty'
const INPUT_ID = 'fixture-input-uncertainty'
const SCORE_ID = 'fixture-score-uncertainty'
const QA_ID = 'fixture-qa-uncertainty'

const RETAILER_URL = 'https://www.example-retailer.com/ceramic-cookware'

const evidencePayload: AprEvidencePayload = {
  evidence_id: EVIDENCE_ID,
  bundle_version: 1,
  algorithm_version: 'agent1-v1',
  reviewed_identity: {
    product_name: 'Fixture Ceramic Nonstick Fry Pan',
    brand: 'Fixture Brand',
    sku_or_model: null,
    primary_retailer_url: RETAILER_URL,
  },
  sources: [
    {
      source_type: 'other_retailer',
      url: RETAILER_URL,
      title: 'Retailer listing — ceramic nonstick sol-gel coating',
      fetched_at: '2026-06-01T00:00:00Z',
      source_role: 'retailer_primary',
      variant_mismatch: false,
    },
  ],
  structured_evidence: {
    product_identity: {
      category: 'Kitchen',
      subcategory: 'Cookware',
      product_type: 'Fry pan',
      product_name: 'Fixture Ceramic Nonstick Fry Pan',
      brand: 'Fixture Brand',
    },
    canonical_mappings: {
      primary_contact_surface: { canonical_id: 'ceramic_nonstick_sol_gel' },
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
      material_id: 'ceramic_nonstick_sol_gel',
      material: 'Ceramic nonstick sol-gel coating',
      material_hazard: 0.45,
      adjusted_migration_potential: 0.35,
      contact_intimacy: 1,
      exposure_severity: 0.8,
      severity_justification: 'Direct food contact',
      exposure_duration: 0.7,
      duration_justification: 'Typical cookware use',
    },
  ],
  layer_4a: null,
  layer_4b: { transparency_badge: 'Material Uncertain' },
}

function buildDisplay(evidenceHash: string, normalizationHash: string): AprDisplayPayload {
  return {
    input_id: INPUT_ID,
    evidence_id: EVIDENCE_ID,
    evidence_content_hash: evidenceHash,
    normalization_content_hash: normalizationHash,
    product_title: 'Fixture Ceramic Nonstick Fry Pan',
    primary_material: 'Ceramic nonstick sol-gel coating',
    disclosure_sentence:
      'No third-party certification found; most materials are identified, but some manufacturer documentation details remain incomplete.',
    product_description:
      'This product scores lower under our PAC Safety Score methodology because key food-contact chemistry is not fully disclosed. Reviewed materials identify a ceramic nonstick sol-gel coating, but the exact formulation is not fully characterized. That uncertainty is reflected in the score and transparency badge.',
    secondary_materials: [
      { name: 'Aluminum core', note: null },
      { name: 'Stainless steel handle', note: null },
    ],
    coatings: 'Ceramic nonstick sol-gel coating',
    use_conditions: ['Oven heat with fat exposure', 'Stovetop heat with fat exposure'],
    disclosure_quality: 'Material Uncertain',
    cert_line:
      'No third-party certification found; most materials are identified, but some manufacturer documentation details remain incomplete.',
    risk_bars: [
      {
        id: 'material',
        label: 'Contact material: Ceramic nonstick sol-gel coating',
        fill_percent: 56,
        color_token: 'amber',
        status_label: 'Moderate concern · coating uncertainty',
      },
    ],
    sources: [
      {
        url: RETAILER_URL,
        group: 'Retailer',
        label: 'Example Retailer — ceramic cookware listing',
        public_source_eligible: true,
        source_role: 'retailer_primary',
        variant_mismatch: false,
        footnote: null,
      },
    ],
    buy_cta: [{ label: 'Buy on Example Retailer', url: RETAILER_URL }],
    why_this_score: {
      primary_material: 'Ceramic nonstick sol-gel coating',
      secondary_materials: ['Aluminum core', 'Stainless steel handle'],
      coatings: 'Ceramic nonstick sol-gel coating',
      use_conditions: ['Oven heat with fat exposure', 'Stovetop heat with fat exposure'],
      disclosure_quality: 'Material Uncertain',
      cert_line:
        'No third-party certification found; most materials are identified, but some manufacturer documentation details remain incomplete.',
      sections: [
        {
          title: 'Primary material',
          items: [{ text: 'Ceramic nonstick sol-gel coating', note: null }],
        },
      ],
    },
    badge_summary: 'Material Uncertain — disclosure gaps affect confidence.',
    buy_section_title: 'Where to buy',
    retailer_caution_note: null,
    sources_intro: 'Sources used for this score.',
    methodology_disclaimer: METHODOLOGY_DISCLAIMER_FIXTURE,
    low_score_last_reviewed_at: '2026-06-05',
  }
}

export function buildLowScoreUncertaintyPatternFixtureApr(
  review?: LowScorePublicationReview | null,
): ApprovedProductRecord {
  const evidence = createGateSnapshot({
    snapshot_id: 'snap-evidence-uncertainty-fixture',
    product_id: PRODUCT_ID,
    gate: 'evidence',
    approved_at: '2026-06-01T00:00:00Z',
    payload: evidencePayload,
  })

  normalizationPayload.evidence_content_hash = evidence.content_hash
  const normalization = createGateSnapshot({
    snapshot_id: 'snap-normalization-uncertainty-fixture',
    product_id: PRODUCT_ID,
    gate: 'normalization',
    approved_at: '2026-06-01T00:00:00Z',
    parent_hashes: { evidence: evidence.content_hash },
    payload: normalizationPayload,
  })

  const displayPayload = buildDisplay(evidence.content_hash, normalization.content_hash)
  const display = createGateSnapshot({
    snapshot_id: 'snap-display-uncertainty-fixture',
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
    pac_safety_score: 66,
    tier: 'Caution',
    displayed_confidence_range: '60–72',
    transparency_badge: 'Material Uncertain',
    weighted_npr: 0.4,
    escalator_applied: null,
    layer_4a_net: 0,
    algorithm_version: 'v2.3.4',
  }

  const score = createGateSnapshot({
    snapshot_id: 'snap-score-uncertainty-fixture',
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
            score: 66,
            primary_score_driving_concern: 'Ceramic nonstick sol-gel coating uncertainty',
          })
        : review,
  }

  const qa = createGateSnapshot({
    snapshot_id: 'snap-qa-uncertainty-fixture',
    product_id: PRODUCT_ID,
    gate: 'qa',
    approved_at: '2026-06-01T00:00:00Z',
    parent_hashes: { score: score.content_hash, display: display.content_hash },
    payload: qaPayload,
  })

  return assembleApprovedProductRecord({
    apr_id: 'apr-fixture-uncertainty-pattern',
    product_id: PRODUCT_ID,
    assembled_at: '2026-06-01T00:00:00Z',
    evidence,
    normalization,
    display,
    score,
    qa,
  })
}
