/**
 * Layer B — stainless documentation contract fixture (Phase 4 assertion 4).
 */

import type {
  AprDisplayPayload,
  AprEvidencePayload,
  AprNormalizationPayload,
  AprQaPayload,
  AprScorePayload,
  ApprovedProductRecord,
} from '../../../types/apr'
import { createGateSnapshot, assembleApprovedProductRecord } from '../snapshot.ts'

const PRODUCT_ID = 'fixture-stainless-unspecified'
const EVIDENCE_ID = 'fixture-evidence-stainless'
const INPUT_ID = 'fixture-input-stainless'
const SCORE_ID = 'fixture-score-stainless'
const QA_ID = 'fixture-qa-stainless'

const evidencePayload: AprEvidencePayload = {
  evidence_id: EVIDENCE_ID,
  bundle_version: 1,
  algorithm_version: 'agent1-v1',
  reviewed_identity: {
    product_name: 'Fixture Stainless Skillet',
    brand: 'Fixture Brand',
    sku_or_model: null,
    primary_retailer_url: 'https://example.com/stainless-skillet',
  },
  sources: [
    {
      source_type: 'other_retailer',
      url: 'https://example.com/stainless-skillet',
      title: 'Fixture retailer listing',
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
      product_name: 'Fixture Stainless Skillet',
      brand: 'Fixture Brand',
    },
    canonical_mappings: {
      primary_contact_material_id: { canonical_id: 'stainless_steel_unspecified', raw_value: 'Stainless steel' },
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
      component_name: 'Food contact surface',
      component_role: 'primary_food_contact',
      material_id: 'stainless_steel_unspecified',
      material: 'Stainless steel (grade unspecified)',
      material_hazard: 0.03,
      adjusted_migration_potential: 0.01,
      contact_intimacy: 1,
      exposure_severity: 0.8,
      severity_justification: 'Direct food contact',
      exposure_duration: 0.5,
      duration_justification: 'Typical cookware use',
    },
  ],
  layer_4a: null,
  layer_4b: { transparency_badge: 'Documentation Incomplete' },
}

function buildDisplayPayload(evidenceHash: string, normalizationHash: string): AprDisplayPayload {
  return {
    input_id: INPUT_ID,
    evidence_id: EVIDENCE_ID,
    evidence_content_hash: evidenceHash,
    normalization_content_hash: normalizationHash,
    product_title: 'Fixture Stainless Skillet',
    primary_material: 'Stainless steel of unspecified grade',
    disclosure_sentence: 'Exact stainless steel grade is not specified by the manufacturer.',
    product_description:
      'This cookware uses a stainless steel food-contact surface of unspecified grade for typical stovetop use.',
    secondary_materials: [],
    coatings: 'None',
    use_conditions: ['Stovetop heat with fat exposure'],
    disclosure_quality: 'Documentation Incomplete',
    cert_line: 'No third-party certification found; exact stainless grade is not fully disclosed.',
    risk_bars: [],
    sources: [
      {
        url: 'https://example.com/stainless-skillet',
        group: 'Retailer',
        label: 'Fixture retailer — Fixture Stainless Skillet',
        public_source_eligible: true,
        source_role: 'retailer_primary',
        variant_mismatch: false,
        footnote: null,
      },
    ],
    buy_cta: [{ label: 'Buy on Fixture Retailer', url: 'https://example.com/stainless-skillet' }],
    why_this_score: {
      primary_material: 'Stainless steel of unspecified grade',
      secondary_materials: [],
      coatings: 'None',
      use_conditions: ['Stovetop heat with fat exposure'],
      disclosure_quality: 'Documentation Incomplete',
      cert_line: 'No third-party certification found; exact stainless grade is not fully disclosed.',
      sections: [],
    },
    badge_summary:
      'Documentation Incomplete — most materials are known; minor details (grade, finish) are unconfirmed.',
    buy_section_title: 'Where to buy',
    retailer_caution_note: null,
    sources_intro: 'Sources used for this score.',
  }
}

export function buildStainlessDocumentationFixtureApr(): ApprovedProductRecord {
  const evidence = createGateSnapshot({
    snapshot_id: 'snap-evidence-stainless',
    product_id: PRODUCT_ID,
    gate: 'evidence',
    approved_at: '2026-06-01T00:00:00Z',
    payload: evidencePayload,
  })

  normalizationPayload.evidence_content_hash = evidence.content_hash
  const normalization = createGateSnapshot({
    snapshot_id: 'snap-normalization-stainless',
    product_id: PRODUCT_ID,
    gate: 'normalization',
    approved_at: '2026-06-01T00:00:00Z',
    parent_hashes: { evidence: evidence.content_hash },
    payload: normalizationPayload,
  })

  const displayPayload = buildDisplayPayload(evidence.content_hash, normalization.content_hash)
  const display = createGateSnapshot({
    snapshot_id: 'snap-display-stainless',
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
    pac_safety_score: 95,
    tier: 'Excellent',
    displayed_confidence_range: '±3',
    transparency_badge: 'Documentation Incomplete',
    weighted_npr: 0.01,
    escalator_applied: null,
    layer_4a_net: 0,
    algorithm_version: 'v2.3.4',
  }

  const score = createGateSnapshot({
    snapshot_id: 'snap-score-stainless',
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
  }

  const qa = createGateSnapshot({
    snapshot_id: 'snap-qa-stainless',
    product_id: PRODUCT_ID,
    gate: 'qa',
    approved_at: '2026-06-01T00:00:00Z',
    parent_hashes: { score: score.content_hash, display: display.content_hash },
    payload: qaPayload,
  })

  return assembleApprovedProductRecord({
    apr_id: 'apr-fixture-stainless',
    product_id: PRODUCT_ID,
    assembled_at: '2026-06-01T00:00:00Z',
    evidence,
    normalization,
    display,
    score,
    qa,
  })
}
