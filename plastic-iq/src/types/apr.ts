/**
 * Approved Product Record (APR) — contract v1.0
 *
 * Single object the public page is built from. Each gate sub-record freezes on approval
 * with a content hash. Downstream gates reference upstream hashes; stale chains fail closed.
 *
 * Namespace split (load-bearing):
 * - normalization.components[] — scoring inputs only (Agent 3). Never read by renderer.
 * - display.* — public-facing authored strings (Agent 2). Never read by Agent 3 for math.
 */

import type { NormalizationComponent } from './agent'

/** APR contract schema version — bump when breaking shape changes. */
export const APR_SCHEMA_VERSION = '1.0.0'

/** Gate identifiers for immutable snapshots. */
export const APR_GATES = ['evidence', 'normalization', 'display', 'score', 'qa'] as const
export type AprGate = (typeof APR_GATES)[number]

/** Gate 1 closed vocabulary for source provenance. */
export const SOURCE_ROLES = [
  'retailer_primary',
  'retailer_supporting',
  'manufacturer',
  'context',
] as const
export type SourceRole = (typeof SOURCE_ROLES)[number]

/** Public source group labels authored by Agent 2. */
export const DISPLAY_SOURCE_GROUPS = [
  'Retailer',
  'Manufacturer',
  'Regulatory',
  'Context',
] as const
export type DisplaySourceGroup = (typeof DISPLAY_SOURCE_GROUPS)[number]

/** Parent hash references carried by each downstream gate snapshot. */
export type AprParentHashes = Partial<Record<AprGate, string>>

/** Immutable approved snapshot envelope (shared by all gates). */
export type AprGateSnapshot<TPayload> = {
  snapshot_id: string
  product_id: string
  gate: AprGate
  schema_version: string
  content_hash: string
  approved_at: string
  /** Hashes of upstream approved snapshots this record was built from. */
  parent_hashes: AprParentHashes
  payload: TPayload
}

// ---------------------------------------------------------------------------
// Gate 1 — evidence (Agent 1)
// ---------------------------------------------------------------------------

export type AprEvidenceSource = {
  source_type: string
  url: string
  title: string
  fetched_at: string | null
  /** Gate 1 assigned role — closed vocabulary. */
  source_role: SourceRole
  /** True when source variant differs from reviewed listing (size/SKU/model). */
  variant_mismatch: boolean
}

export type AprReviewedProductIdentity = {
  product_name: string
  brand: string | null
  sku_or_model: string | null
  /** Primary retailer listing URL — reviewed variant identity. */
  primary_retailer_url: string | null
}

export type AprEvidencePayload = {
  evidence_id: string
  bundle_version: number
  algorithm_version: string
  reviewed_identity: AprReviewedProductIdentity
  sources: AprEvidenceSource[]
  /** Opaque Gate 1 structured evidence — canonical mappings, checks, etc. */
  structured_evidence: Record<string, unknown>
}

export type AprEvidenceSnapshot = AprGateSnapshot<AprEvidencePayload>

// ---------------------------------------------------------------------------
// Gate 2 — normalization.components[] (Agent 2, scoring namespace)
// ---------------------------------------------------------------------------

/** Scoring-only component row — Agent 3 reads; renderer must not. */
export type AprNormalizationComponent = NormalizationComponent

export type AprNormalizationPayload = {
  input_id: string
  evidence_id: string
  evidence_content_hash: string
  algorithm_version: string
  /** Scoring inputs only. Never consumed by the public renderer. */
  components: AprNormalizationComponent[]
  layer_4a: Record<string, unknown> | null
  layer_4b: Record<string, unknown> | null
}

export type AprNormalizationSnapshot = AprGateSnapshot<AprNormalizationPayload>

// ---------------------------------------------------------------------------
// Gate 2 — display.* (Agent 2, public namespace)
// ---------------------------------------------------------------------------

export type AprDisplaySecondaryMaterial = {
  name: string
  note: string | null
}

export type AprDisplaySource = {
  url: string
  group: DisplaySourceGroup
  /** Final human label — no role prefixes, no sanitization at render. */
  label: string
  public_source_eligible: boolean
  source_role: SourceRole
  variant_mismatch: boolean
  /** Optional supporting footnote authored by Agent 2. */
  footnote: string | null
}

export type AprDisplayBuyCta = {
  label: string
  url: string
}

export type AprDisplayRiskBar = {
  id: string
  label: string
  fill_percent: number
  color_token: string
  status_label: string
}

export type AprDisplayWhyThisScoreSection = {
  title: string
  items: Array<{ text: string; note: string | null }>
}

export type AprDisplayWhyThisScore = {
  primary_material: string
  secondary_materials: string[]
  coatings: string
  use_conditions: string[]
  disclosure_quality: string
  cert_line: string
  /** Pre-shaped sections for renderer — Agent 2 authored. */
  sections: AprDisplayWhyThisScoreSection[]
}

/** All public-facing strings — the only text namespace the renderer reads. */
export type AprDisplayPayload = {
  input_id: string
  evidence_id: string
  evidence_content_hash: string
  normalization_content_hash: string
  product_title: string
  primary_material: string
  disclosure_sentence: string
  product_description: string
  secondary_materials: AprDisplaySecondaryMaterial[]
  coatings: string
  use_conditions: string[]
  disclosure_quality: string
  cert_line: string
  risk_bars: AprDisplayRiskBar[]
  sources: AprDisplaySource[]
  buy_cta: AprDisplayBuyCta[]
  why_this_score: AprDisplayWhyThisScore
  /** Plain-English badge summary under transparency badge. */
  badge_summary: string
  /** Sidebar buy section heading. */
  buy_section_title: string
  /** High-risk caution note beside buy CTAs, or null. */
  retailer_caution_note: string | null
  /** Sources section intro paragraph. */
  sources_intro: string
  /** Safer alternatives section — relative score language only. */
  safer_alternatives_subhead?: string
  safer_alternatives_footer?: string
  /** Methodology disclaimer — frozen on snapshot when present; ProductPage falls back to global copy. */
  methodology_disclaimer?: string | null
  /** General approved snapshot review date (YYYY-MM-DD or ISO). */
  last_reviewed_at?: string | null
  /** Phase 4.5 — last low-score publication review date (visual stamp integration point). */
  low_score_last_reviewed_at?: string | null
}

export type AprDisplaySnapshot = AprGateSnapshot<AprDisplayPayload>

// ---------------------------------------------------------------------------
// Gate 3 — score (Agent 3)
// ---------------------------------------------------------------------------

export type AprScorePayload = {
  score_id: string
  input_id: string
  normalization_content_hash: string
  display_content_hash: string
  pac_safety_score: number
  tier: string
  displayed_confidence_range: string
  transparency_badge: string
  weighted_npr: number
  escalator_applied: string | null
  layer_4a_net: number
  algorithm_version: string
}

export type AprScoreSnapshot = AprGateSnapshot<AprScorePayload>

// ---------------------------------------------------------------------------
// Gate 4 — qa (Agent 4)
// ---------------------------------------------------------------------------

export type AprPreflightCheck = {
  check_id: string
  passed: boolean
  message: string | null
}

/** Phase 4.5 — explicit human approval artifact for score < 75 publication. */
export type LowScorePublicationReview = {
  reviewer_id: string
  reviewed_at: string
  low_score_gate_version: string
  score_at_review: number
  primary_score_driving_concern: string
  evidence_sufficiency: 'passed' | 'failed' | 'needs_revision'
  language_safety: 'passed' | 'failed' | 'needs_revision'
  approval_status: 'approved' | 'rejected' | 'needs_revision'
  reviewer_notes?: string | null
}

export type AprQaPayload = {
  qa_id: string
  score_content_hash: string
  display_content_hash: string
  preflight: {
    passed: boolean
    checked_at: string
    checks: AprPreflightCheck[]
  }
  /** Agent 4 classification checks — not display strings. */
  checks: Record<string, unknown>
  /** Phase 4.5 — required before publishing products with score < 75. */
  low_score_publication_review?: LowScorePublicationReview | null
}

export type AprQaSnapshot = AprGateSnapshot<AprQaPayload>

// ---------------------------------------------------------------------------
// Assembled APR — latest fully-approved record for public render
// ---------------------------------------------------------------------------

export type ApprovedProductRecord = {
  apr_id: string
  product_id: string
  schema_version: string
  assembled_at: string
  /** Hash of the full assembled APR (excluding apr_id/assembled_at). */
  assembled_content_hash: string
  evidence: AprEvidenceSnapshot
  normalization: AprNormalizationSnapshot
  display: AprDisplaySnapshot
  score: AprScoreSnapshot
  qa: AprQaSnapshot
}

/** Minimal shape the public renderer is allowed to consume (Phase 2 target). */
export type AprPublicRenderInput = {
  display: AprDisplayPayload
  score: Pick<
    AprScorePayload,
    | 'pac_safety_score'
    | 'tier'
    | 'displayed_confidence_range'
    | 'transparency_badge'
  >
  /** Render-only metadata from frozen snapshot record — not live DB. */
  snapshot_meta?: {
    snapshot_id: string
    published_at: string
  }
}

/** Field ownership map — each public element maps to exactly one writer. */
export const APR_FIELD_OWNERS = {
  'display.product_title': 'agent2',
  'display.primary_material': 'agent2',
  'display.disclosure_sentence': 'agent2',
  'display.product_description': 'agent2',
  'display.secondary_materials': 'agent2',
  'display.coatings': 'agent2',
  'display.use_conditions': 'agent2',
  'display.disclosure_quality': 'agent2',
  'display.cert_line': 'agent2',
  'display.risk_bars': 'agent2',
  'display.sources': 'agent2',
  'display.buy_cta': 'agent2',
  'display.why_this_score': 'agent2',
  'normalization.components': 'agent2',
  'score.pac_safety_score': 'agent3',
  'score.tier': 'agent3',
  'score.displayed_confidence_range': 'agent3',
  'score.transparency_badge': 'agent3',
  'evidence.sources.source_role': 'agent1',
  'evidence.sources.variant_mismatch': 'agent1',
  'evidence.reviewed_identity': 'agent1',
  'qa.preflight': 'agent4',
} as const

export type AprFieldOwner = (typeof APR_FIELD_OWNERS)[keyof typeof APR_FIELD_OWNERS]

/** Keys the renderer may read for public text — display + score numerics/tier only. */
export const RENDERER_ALLOWED_TEXT_PATHS = [
  'display.product_title',
  'display.primary_material',
  'display.disclosure_sentence',
  'display.product_description',
  'display.secondary_materials',
  'display.coatings',
  'display.use_conditions',
  'display.disclosure_quality',
  'display.cert_line',
  'display.risk_bars',
  'display.sources',
  'display.buy_cta',
  'display.why_this_score',
] as const

/** Keys the renderer must never read (scoring namespace). */
export const RENDERER_FORBIDDEN_READ_PATHS = [
  'normalization.components',
  'evidence.structured_evidence',
  'qa.checks',
] as const
