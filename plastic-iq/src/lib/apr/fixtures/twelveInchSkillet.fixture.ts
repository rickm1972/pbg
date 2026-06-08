/**
 * Layer B contract fixture — regression APR for 12" reviewed product with
 * variant-mismatched 12.5" manufacturer product page (hidden) and eligible collection.
 * Used by ownership/schema tests only — not production hardcoding.
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

const PRODUCT_ID = 'fixture-product-12in-skillet'
const EVIDENCE_ID = 'fixture-evidence-001'
const INPUT_ID = 'fixture-input-001'
const SCORE_ID = 'fixture-score-001'
const QA_ID = 'fixture-qa-001'

export const FIXTURE_REVIEWED_NAME =
  'All-Clad G5 Graphite Core Stainless-Steel Fry Pan with Lid, 12 inch'

export const FIXTURE_WS_URL =
  'https://www.williams-sonoma.com/products/all-clad-g5-graphite-fry-pan-lid/'

export const FIXTURE_MFR_COLLECTION_URL =
  'https://www.all-clad.com/cookware/collections/g5-graphite-core.html'

export const FIXTURE_MFR_MISMATCH_URL =
  'https://www.all-clad.com/products/g5-graphite-core-5-ply-bonded-cookware-skillet-with-lid-12-5-inch.html'

const evidencePayload: AprEvidencePayload = {
  evidence_id: EVIDENCE_ID,
  bundle_version: 1,
  algorithm_version: 'agent1-v1',
  reviewed_identity: {
    product_name: FIXTURE_REVIEWED_NAME,
    brand: 'All-Clad',
    sku_or_model: null,
    primary_retailer_url: FIXTURE_WS_URL,
  },
  sources: [
    {
      source_type: 'other_retailer',
      url: FIXTURE_WS_URL,
      title: 'Williams Sonoma listing',
      fetched_at: '2026-06-01T00:00:00Z',
      source_role: 'retailer_primary',
      variant_mismatch: false,
    },
    {
      source_type: 'manufacturer',
      url: FIXTURE_MFR_COLLECTION_URL,
      title: 'G5 Graphite Core cookware collection',
      fetched_at: '2026-06-01T00:00:00Z',
      source_role: 'manufacturer',
      variant_mismatch: false,
    },
    {
      source_type: 'manufacturer',
      url: FIXTURE_MFR_MISMATCH_URL,
      title: 'G5 graphite core skillet 12.5 inch',
      fetched_at: '2026-06-01T00:00:00Z',
      source_role: 'manufacturer',
      variant_mismatch: true,
    },
  ],
  structured_evidence: {
    product_identity: {
      category: 'Kitchen',
      subcategory: 'Cookware',
      product_type: 'Fry pan',
      product_name: FIXTURE_REVIEWED_NAME,
      brand: 'All-Clad',
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
    {
      component_name: 'Graphite core',
      component_role: 'structural',
      material_id: 'graphite_core',
      material: 'Graphite core',
      material_hazard: 0.02,
      adjusted_migration_potential: 0.001,
      contact_intimacy: 0,
      exposure_severity: 0,
      severity_justification: 'Internal bonded core',
      exposure_duration: 0,
      duration_justification: 'Not food-contact',
    },
    {
      component_name: 'Aluminum core',
      component_role: 'structural',
      material_id: 'aluminum_core',
      material: 'Aluminum core',
      material_hazard: 0.22,
      adjusted_migration_potential: 0.001,
      contact_intimacy: 0,
      exposure_severity: 0,
      severity_justification: 'Internal bonded core',
      exposure_duration: 0,
      duration_justification: 'Not food-contact',
    },
  ],
  layer_4a: null,
  layer_4b: { transparency_badge: 'Documentation Incomplete' },
}

export function buildFixtureDisplayPayload(
  evidenceHash: string,
  normalizationHash: string,
): AprDisplayPayload {
  return {
    input_id: INPUT_ID,
    evidence_id: EVIDENCE_ID,
    evidence_content_hash: evidenceHash,
    normalization_content_hash: normalizationHash,
    product_title: FIXTURE_REVIEWED_NAME,
    primary_material: 'Stainless steel',
    disclosure_sentence:
      'Exact stainless steel grade is not specified by the manufacturer.',
    product_description:
      'This cookware uses a stainless steel of unspecified grade food-contact surface bonded to internal graphite and aluminum cores.',
    secondary_materials: [
      {
        name: 'Graphite core',
        note: 'Internal bonded core — not a food-contact surface.',
      },
      {
        name: 'Aluminum core',
        note: 'Internal bonded core — not a food-contact surface.',
      },
    ],
    coatings: 'None',
    use_conditions: ['Oven heat with fat exposure', 'Stovetop heat with fat exposure'],
    disclosure_quality: 'Documentation Incomplete',
    cert_line:
      'No third-party certification found; material family is identified, but the exact stainless steel grade/spec is not fully disclosed.',
    risk_bars: [],
    sources: [
      {
        url: FIXTURE_WS_URL,
        group: 'Retailer',
        label: `Williams Sonoma — ${FIXTURE_REVIEWED_NAME}`,
        public_source_eligible: true,
        source_role: 'retailer_primary',
        variant_mismatch: false,
        footnote: null,
      },
      {
        url: FIXTURE_MFR_COLLECTION_URL,
        group: 'Manufacturer',
        label: 'All-Clad G5 Graphite Core cookware collection',
        public_source_eligible: true,
        source_role: 'manufacturer',
        variant_mismatch: false,
        footnote: null,
      },
      {
        url: FIXTURE_MFR_MISMATCH_URL,
        group: 'Manufacturer',
        label: 'All-Clad G5 Graphite Core cookware construction page',
        public_source_eligible: false,
        source_role: 'manufacturer',
        variant_mismatch: true,
        footnote: null,
      },
    ],
    buy_cta: [{ label: 'Buy on Williams Sonoma', url: FIXTURE_WS_URL }],
    why_this_score: {
      primary_material: 'Stainless steel of unspecified grade',
      secondary_materials: ['Graphite core', 'Aluminum core'],
      coatings: 'None',
      use_conditions: ['Oven heat with fat exposure', 'Stovetop heat with fat exposure'],
      disclosure_quality: 'Documentation Incomplete',
      cert_line:
        'No third-party certification found; material family is identified, but the exact stainless steel grade/spec is not fully disclosed.',
      sections: [
        {
          title: 'Primary material',
          items: [{ text: 'Stainless steel of unspecified grade', note: null }],
        },
        {
          title: 'Secondary materials',
          items: [
            { text: 'Graphite core', note: 'Internal bonded core — not a food-contact surface.' },
            { text: 'Aluminum core', note: null },
          ],
        },
      ],
    },
    badge_summary:
      'Documentation Incomplete — most materials are known; minor details (grade, finish) are unconfirmed.',
    buy_section_title: 'Where to buy',
    retailer_caution_note: null,
    sources_intro:
      'Sources used for this score, including retailer and manufacturer sources where applicable.',
  }
}

const scorePayload: AprScorePayload = {
  score_id: SCORE_ID,
  input_id: INPUT_ID,
  normalization_content_hash: '',
  display_content_hash: '',
  pac_safety_score: 99,
  tier: 'Excellent',
  displayed_confidence_range: '±3',
  transparency_badge: 'Documentation Incomplete',
  weighted_npr: 0.01,
  escalator_applied: null,
  layer_4a_net: 0,
  algorithm_version: 'v2.3.4',
}

const qaPayload: AprQaPayload = {
  qa_id: QA_ID,
  score_content_hash: '',
  display_content_hash: '',
  preflight: {
    passed: true,
    checked_at: '2026-06-01T00:00:00Z',
    checks: [{ check_id: 'ownership.namespace_split', passed: true, message: null }],
  },
  checks: {},
}

/** Build a fully hash-linked fixture APR for contract tests. */
export function buildTwelveInchSkilletFixtureApr(): ApprovedProductRecord {
  const evidence = createGateSnapshot({
    snapshot_id: 'snap-evidence-fixture',
    product_id: PRODUCT_ID,
    gate: 'evidence',
    approved_at: '2026-06-01T00:00:00Z',
    payload: evidencePayload,
  })

  normalizationPayload.evidence_content_hash = evidence.content_hash

  const normalization = createGateSnapshot({
    snapshot_id: 'snap-normalization-fixture',
    product_id: PRODUCT_ID,
    gate: 'normalization',
    approved_at: '2026-06-01T00:00:00Z',
    parent_hashes: { evidence: evidence.content_hash },
    payload: normalizationPayload,
  })

  const displayPayload = buildFixtureDisplayPayload(
    evidence.content_hash,
    normalization.content_hash,
  )

  const display = createGateSnapshot({
    snapshot_id: 'snap-display-fixture',
    product_id: PRODUCT_ID,
    gate: 'display',
    approved_at: '2026-06-01T00:00:00Z',
    parent_hashes: {
      evidence: evidence.content_hash,
      normalization: normalization.content_hash,
    },
    payload: displayPayload,
  })

  scorePayload.normalization_content_hash = normalization.content_hash
  scorePayload.display_content_hash = display.content_hash

  const score = createGateSnapshot({
    snapshot_id: 'snap-score-fixture',
    product_id: PRODUCT_ID,
    gate: 'score',
    approved_at: '2026-06-01T00:00:00Z',
    parent_hashes: {
      normalization: normalization.content_hash,
      display: display.content_hash,
    },
    payload: scorePayload,
  })

  qaPayload.score_content_hash = score.content_hash
  qaPayload.display_content_hash = display.content_hash

  const qa = createGateSnapshot({
    snapshot_id: 'snap-qa-fixture',
    product_id: PRODUCT_ID,
    gate: 'qa',
    approved_at: '2026-06-01T00:00:00Z',
    parent_hashes: {
      score: score.content_hash,
      display: display.content_hash,
    },
    payload: qaPayload,
  })

  return assembleApprovedProductRecord({
    apr_id: 'apr-fixture-12in',
    product_id: PRODUCT_ID,
    assembled_at: '2026-06-01T00:00:00Z',
    evidence,
    normalization,
    display,
    score,
    qa,
  })
}

/** Public-eligible sources from fixture — mismatched 12.5" page excluded. */
export function fixturePublicEligibleSources(apr: ApprovedProductRecord) {
  return apr.display.payload.sources.filter((s) => s.public_source_eligible)
}
