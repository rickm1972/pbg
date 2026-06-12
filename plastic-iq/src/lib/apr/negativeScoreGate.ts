/**
 * Phase 4.5 — negative-score publication gate (score < 75).
 * Publish/readiness safety — does not alter scoring math or display generation.
 */

import type {
  ApprovedProductRecord,
  AprDisplayPayload,
  LowScorePublicationReview,
} from '../../types/apr'
import { walkDisplayStrings } from './rendererTextContract'
import { resolvePublicMethodologyDisclaimer } from './publicReviewStamp'

export const LOW_SCORE_GATE_VERSION = '4.5.0'

export const NEGATIVE_SCORE_PUBLICATION_GATE = {
  id: 'negative_score_publication',
  enabled: true,
  threshold: 75,
  gate_version: LOW_SCORE_GATE_VERSION,
  plugin_point: 'contractPreflight.assertion_11_after_published_snapshot',
} as const

export type NegativeScoreGateFailure = {
  check_id: string
  rule: string
  path: string
  message: string
}

export type NegativeScoreGateReviewStatus =
  | 'approved'
  | 'rejected'
  | 'needs_revision'
  | 'missing'
  | 'not_required'

export type NegativeScoreGateResult = {
  ok: boolean
  applies: boolean
  score: number
  threshold: number
  failures: NegativeScoreGateFailure[]
  warnings: NegativeScoreGateFailure[]
  required_review: boolean
  review_status: NegativeScoreGateReviewStatus
  evidence_status: 'passed' | 'failed' | 'skipped' | 'needs_revision'
  language_status: 'passed' | 'failed' | 'skipped' | 'needs_revision'
  gate_version: string
}

export type NegativeScoreGateOptions = {
  low_score_publication_review?: LowScorePublicationReview | null
}

export type NegativeScoreGateViolation = NegativeScoreGateFailure & {
  check_id:
    | 'negative_score.publication_copy_required'
    | 'negative_score.evidence_insufficient'
    | 'negative_score.language_unsafe'
    | 'negative_score.review_missing'
    | 'negative_score.review_stale'
    | 'negative_score.methodology_disclaimer_missing'
}

const STRONG_EVIDENCE_ROLES = new Set([
  'manufacturer',
  'retailer_primary',
  'product_label',
  'safety_data_sheet',
  'certification_registry',
])

const SCORE_DRIVING_MATERIAL_TOKENS = [
  'ptfe',
  'pfoa',
  'pfas',
  'nonstick',
  'lead',
  'cadmium',
  'bisphenol',
  'bpa',
  'phthalate',
] as const

type LanguageRule = {
  check_id: string
  rule: string
  pattern: RegExp
  message: string
}

const BANNED_LANGUAGE_RULES: LanguageRule[] = [
  { check_id: 'negative_score.language_unsafe', rule: 'banned_absolute_harm', pattern: /\btoxic\b/i, message: 'Disallowed absolute harm language: "toxic".' },
  { check_id: 'negative_score.language_unsafe', rule: 'banned_absolute_harm', pattern: /\bdangerous\b/i, message: 'Disallowed absolute harm language: "dangerous".' },
  { check_id: 'negative_score.language_unsafe', rule: 'banned_absolute_harm', pattern: /\bunsafe\b/i, message: 'Disallowed absolute harm language: "unsafe".' },
  { check_id: 'negative_score.language_unsafe', rule: 'banned_absolute_harm', pattern: /\bharmful\b/i, message: 'Disallowed absolute harm language: "harmful".' },
  { check_id: 'negative_score.language_unsafe', rule: 'banned_absolute_harm', pattern: /\bpoisonous\b/i, message: 'Disallowed absolute harm language: "poisonous".' },
  { check_id: 'negative_score.language_unsafe', rule: 'banned_absolute_harm', pattern: /\bcontaminated\b/i, message: 'Disallowed contamination claim: "contaminated".' },
  { check_id: 'negative_score.language_unsafe', rule: 'banned_medical', pattern: /\bcauses cancer\b/i, message: 'Out-of-lane medical causation language.' },
  { check_id: 'negative_score.language_unsafe', rule: 'banned_medical', pattern: /\bcauses infertility\b/i, message: 'Out-of-lane medical causation language.' },
  { check_id: 'negative_score.language_unsafe', rule: 'banned_medical', pattern: /\bendocrine[- ]disrupting product\b/i, message: 'Out-of-lane medical characterization.' },
  { check_id: 'negative_score.language_unsafe', rule: 'banned_regulatory', pattern: /\billegal\b/i, message: 'Out-of-lane regulatory violation claim.' },
  { check_id: 'negative_score.language_unsafe', rule: 'banned_regulatory', pattern: /\brecalled\b/i, message: 'Out-of-lane recall claim.' },
  { check_id: 'negative_score.language_unsafe', rule: 'banned_brand_characterization', pattern: /\bcontradicts (?:the )?marketing\b/i, message: 'Brand characterization / deception language.' },
  { check_id: 'negative_score.language_unsafe', rule: 'banned_brand_characterization', pattern: /\bdespite claiming\b/i, message: 'Brand characterization / deception language.' },
  { check_id: 'negative_score.language_unsafe', rule: 'banned_brand_characterization', pattern: /\bmisleading\b/i, message: 'Brand characterization / deception language.' },
  { check_id: 'negative_score.language_unsafe', rule: 'banned_brand_characterization', pattern: /\bgreenwashing\b/i, message: 'Brand characterization / deception language.' },
  { check_id: 'negative_score.language_unsafe', rule: 'banned_brand_characterization', pattern: /\bdeceptive\b/i, message: 'Brand characterization / deception language.' },
  { check_id: 'negative_score.language_unsafe', rule: 'banned_brand_characterization', pattern: /\bfraud\b/i, message: 'Brand characterization / deception language.' },
  { check_id: 'negative_score.language_unsafe', rule: 'banned_brand_characterization', pattern: /\bfalse advertising\b/i, message: 'Brand characterization / deception language.' },
  { check_id: 'negative_score.language_unsafe', rule: 'banned_brand_characterization', pattern: /\bbrand lied\b/i, message: 'Brand characterization / deception language.' },
  { check_id: 'negative_score.language_unsafe', rule: 'banned_brand_characterization', pattern: /\bcompany lied\b/i, message: 'Brand characterization / deception language.' },
  { check_id: 'negative_score.language_unsafe', rule: 'banned_brand_characterization', pattern: /\bhides\b/i, message: 'Brand characterization / deception language.' },
  { check_id: 'negative_score.language_unsafe', rule: 'banned_brand_characterization', pattern: /\bbrand claims but\b/i, message: 'Brand characterization / deception language.' },
  { check_id: 'negative_score.language_unsafe', rule: 'banned_brand_characterization', pattern: /\bcompany claims but\b/i, message: 'Brand characterization / deception language.' },
  { check_id: 'negative_score.language_unsafe', rule: 'banned_brand_characterization', pattern: /\bmarkets this product as\b/i, message: 'Brand marketing characterization — use reviewed-materials framing instead.' },
]

/** Allowed negated methodology framing — must not trigger banned-term scans. */
const METHODOLOGY_SAFE_PHRASES = [
  /does not mean the product is unsafe/i,
  /does not indicate the product is unsafe/i,
  /scores lower under our pac safety score methodology/i,
  /reviewed materials identify/i,
  /reflects relative pac exposure considerations under our methodology/i,
] as const

function isMethodologySafePhrase(text: string): boolean {
  return METHODOLOGY_SAFE_PHRASES.some((p) => p.test(text))
}

const CONFIRMED_HAZARD_WITHOUT_SUPPORT = [
  {
    check_id: 'negative_score.evidence_insufficient',
    rule: 'uncertainty_as_confirmed_hazard',
    pattern: /\bconfirmed (?:chemical )?hazard\b/i,
    message: 'Uncertainty cannot be phrased as a confirmed chemical hazard.',
  },
  {
    check_id: 'negative_score.evidence_insufficient',
    rule: 'uncertainty_as_confirmed_hazard',
    pattern: /\bdefinitely (?:contains|leaches|releases)\b/i,
    message: 'Absolute exposure certainty is not supported for disclosure-uncertainty cases.',
  },
  {
    check_id: 'negative_score.evidence_insufficient',
    rule: 'uncertainty_as_confirmed_hazard',
    pattern: /\bproven to (?:cause|release|leach)\b/i,
    message: 'Medical/exposure causation language is out of scope.',
  },
] as const

const AUTHORED_DISPLAY_PATH_PREFIXES = [
  'display.product_description',
  'display.disclosure_sentence',
  'display.primary_material',
  'display.coatings',
  'display.cert_line',
  'display.badge_summary',
  'display.retailer_caution_note',
  'display.sources_intro',
  'display.safer_alternatives_subhead',
  'display.safer_alternatives_footer',
  'display.methodology_disclaimer',
  'display.secondary_materials',
  'display.risk_bars',
  'display.why_this_score',
]

function isAuthoredDisplayPath(path: string): boolean {
  if (path.startsWith('display.sources')) return false
  if (path.startsWith('display.buy_cta')) return false
  if (path.startsWith('display.product_title')) return false
  return AUTHORED_DISPLAY_PATH_PREFIXES.some((p) => path.startsWith(p))
}

export function collectAuthoredDisplayCopy(
  display: AprDisplayPayload,
): Array<{ path: string; text: string }> {
  const out: Array<{ path: string; text: string }> = []
  walkDisplayStrings(display, (path, value) => {
    if (!isAuthoredDisplayPath(path)) return
    const text = value.trim()
    if (text) out.push({ path, text })
  })
  return out
}

function resolveLowScoreReview(
  record: ApprovedProductRecord,
  options?: NegativeScoreGateOptions,
): LowScorePublicationReview | null {
  return (
    options?.low_score_publication_review ??
    record.qa.payload.low_score_publication_review ??
    null
  )
}

function scoreApplies(score: number): boolean {
  return NEGATIVE_SCORE_PUBLICATION_GATE.enabled && score < NEGATIVE_SCORE_PUBLICATION_GATE.threshold
}

function primaryScoreDrivingConcern(record: ApprovedProductRecord): string {
  const display = record.display.payload
  const components = record.normalization.payload.components ?? []
  const primaryComponent = components.find((c) => c.contact_intimacy > 0) ?? components[0]
  const parts = [
    display.primary_material,
    display.coatings,
    primaryComponent?.material_id,
    primaryComponent?.material,
  ].filter(Boolean)
  return parts[0] ?? 'unspecified food-contact material'
}

function textMentionsScoreDrivingMaterial(text: string): string[] {
  const lower = text.toLowerCase()
  return SCORE_DRIVING_MATERIAL_TOKENS.filter((token) => lower.includes(token))
}

function normalizationSupportsMaterial(record: ApprovedProductRecord, tokens: string[]): boolean {
  for (const component of record.normalization.payload.components ?? []) {
    const blob = `${component.material_id ?? ''} ${component.material ?? ''}`.toLowerCase()
    if (tokens.some((t) => blob.includes(t))) return true
  }
  const mappings = (
    record.evidence.payload.structured_evidence as {
      canonical_mappings?: Record<string, { canonical_id?: string }>
    }
  )?.canonical_mappings
  if (mappings) {
    for (const row of Object.values(mappings)) {
      const id = String(row?.canonical_id ?? '').toLowerCase()
      if (tokens.some((t) => id.includes(t))) return true
    }
  }
  return false
}

function strongSourceBlob(record: ApprovedProductRecord): string {
  return (record.evidence.payload.sources ?? [])
    .filter((s) => STRONG_EVIDENCE_ROLES.has(String(s.source_role ?? '')))
    .map((s) => `${s.title ?? ''} ${s.url ?? ''}`)
    .join(' ')
    .toLowerCase()
}

function strongSourceSupportsTokens(record: ApprovedProductRecord, tokens: string[]): boolean {
  if (normalizationSupportsMaterial(record, tokens)) return true
  const blob = strongSourceBlob(record)
  return tokens.some((t) => blob.includes(t))
}

function stripMethodologySafePhrases(text: string): string {
  let out = text
  for (const phrase of METHODOLOGY_SAFE_PHRASES) {
    out = out.replace(phrase, '')
  }
  return out
}

function scanLanguageSafety(
  authored: Array<{ path: string; text: string }>,
): NegativeScoreGateFailure[] {
  const failures: NegativeScoreGateFailure[] = []
  for (const { path, text } of authored) {
    if (path === 'display.methodology_disclaimer' && isMethodologySafePhrase(text)) {
      continue
    }
    const scanText = stripMethodologySafePhrases(text)
    for (const rule of BANNED_LANGUAGE_RULES) {
      if (rule.pattern.test(scanText)) {
        failures.push({
          check_id: rule.check_id,
          rule: rule.rule,
          path,
          message: `${rule.message} (${text.slice(0, 80)}…)`,
        })
      }
    }
    for (const rule of CONFIRMED_HAZARD_WITHOUT_SUPPORT) {
      if (rule.pattern.test(scanText)) {
        failures.push({
          check_id: rule.check_id,
          rule: rule.rule,
          path,
          message: rule.message,
        })
      }
    }
  }
  return failures
}

function scanEvidenceSufficiency(record: ApprovedProductRecord): NegativeScoreGateFailure[] {
  const failures: NegativeScoreGateFailure[] = []
  const authored = collectAuthoredDisplayCopy(record.display.payload)
  const concern = primaryScoreDrivingConcern(record)
  const allText = authored.map((a) => a.text).join(' ')
  const mentionedTokens = textMentionsScoreDrivingMaterial(allText)

  if (mentionedTokens.length === 0) return failures

  const ptfeFamily = mentionedTokens.filter((t) => ['ptfe', 'pfoa', 'pfas', 'nonstick'].includes(t))
  if (ptfeFamily.length > 0 && !strongSourceSupportsTokens(record, ptfeFamily)) {
    failures.push({
      check_id: 'negative_score.evidence_insufficient',
      rule: 'score_driving_material_unsupported',
      path: 'display',
      message: `Score-driving coating/material claim (${ptfeFamily.join(', ')}) lacks strong manufacturer/retailer/normalization support.`,
    })
  }

  const disclosure = record.display.payload.disclosure_quality.toLowerCase()
  const uncertaintyDriven =
    disclosure.includes('uncertain') ||
    disclosure.includes('incomplete') ||
    allText.toLowerCase().includes('not fully disclosed') ||
    allText.toLowerCase().includes('not fully characterized')

  if (uncertaintyDriven) {
    for (const { path, text } of authored) {
      if (/\bconfirmed (?:pfas|ptfe|pfoa)\b/i.test(text) || /\btoxic (?:pfas|ptfe|chemical)\b/i.test(text)) {
        failures.push({
          check_id: 'negative_score.evidence_insufficient',
          rule: 'uncertainty_as_confirmed_hazard',
          path,
          message:
            'Disclosure uncertainty case must not phrase coating/material concern as a confirmed chemical hazard.',
        })
      }
    }
  }

  if (!concern.trim()) {
    failures.push({
      check_id: 'negative_score.evidence_insufficient',
      rule: 'primary_concern_missing',
      path: 'normalization.components',
      message: 'Primary score-driving concern could not be resolved from normalization/display.',
    })
  }

  return failures
}

function validateHumanReview(
  score: number,
  review: LowScorePublicationReview | null,
  primaryConcern: string,
): { failures: NegativeScoreGateFailure[]; warnings: NegativeScoreGateFailure[]; status: NegativeScoreGateReviewStatus } {
  const failures: NegativeScoreGateFailure[] = []
  const warnings: NegativeScoreGateFailure[] = []

  if (!review) {
    failures.push({
      check_id: 'negative_score.review_missing',
      rule: 'human_approval_required',
      path: 'qa.low_score_publication_review',
      message: `Score ${score} < ${NEGATIVE_SCORE_PUBLICATION_GATE.threshold} requires explicit low-score publication review approval.`,
    })
    return { failures, warnings, status: 'missing' }
  }

  if (review.approval_status !== 'approved') {
    failures.push({
      check_id: 'negative_score.review_missing',
      rule: 'human_approval_required',
      path: 'qa.low_score_publication_review.approval_status',
      message: `Low-score publication review status is "${review.approval_status}", not approved.`,
    })
    return { failures, warnings, status: review.approval_status }
  }

  if (review.score_at_review !== score) {
    failures.push({
      check_id: 'negative_score.review_stale',
      rule: 'review_score_mismatch',
      path: 'qa.low_score_publication_review.score_at_review',
      message: `Review score ${review.score_at_review} does not match current approved score ${score}.`,
    })
  }

  if (review.low_score_gate_version !== LOW_SCORE_GATE_VERSION) {
    failures.push({
      check_id: 'negative_score.review_stale',
      rule: 'review_gate_version_stale',
      path: 'qa.low_score_publication_review.low_score_gate_version',
      message: `Review gate version ${review.low_score_gate_version} is stale (expected ${LOW_SCORE_GATE_VERSION}).`,
    })
  }

  if (review.evidence_sufficiency !== 'passed') {
    failures.push({
      check_id: 'negative_score.review_missing',
      rule: 'review_evidence_not_passed',
      path: 'qa.low_score_publication_review.evidence_sufficiency',
      message: 'Human review evidence_sufficiency must be passed.',
    })
  }

  if (review.language_safety !== 'passed') {
    failures.push({
      check_id: 'negative_score.review_missing',
      rule: 'review_language_not_passed',
      path: 'qa.low_score_publication_review.language_safety',
      message: 'Human review language_safety must be passed.',
    })
  }

  if (
    review.primary_score_driving_concern &&
    primaryConcern &&
    !review.primary_score_driving_concern.toLowerCase().includes(primaryConcern.slice(0, 12).toLowerCase())
  ) {
    warnings.push({
      check_id: 'negative_score.review_stale',
      rule: 'review_concern_drift',
      path: 'qa.low_score_publication_review.primary_score_driving_concern',
      message: 'Review primary concern may not match current assembly primary concern.',
    })
  }

  const status: NegativeScoreGateReviewStatus =
    failures.length > 0 ? 'needs_revision' : review.approval_status

  return { failures, warnings, status }
}

function scanMethodologyFields(display: AprDisplayPayload): NegativeScoreGateFailure[] {
  const failures: NegativeScoreGateFailure[] = []
  const warnings: NegativeScoreGateFailure[] = []

  const effectiveDisclaimer = resolvePublicMethodologyDisclaimer(display)
  if (!effectiveDisclaimer.trim()) {
    failures.push({
      check_id: 'negative_score.methodology_disclaimer_missing',
      rule: 'methodology_disclaimer_required',
      path: 'display.methodology_disclaimer',
      message:
        'Low-score pages require display.methodology_disclaimer (PAC methodology framing).',
    })
  }

  if (!display.low_score_last_reviewed_at?.trim()) {
    warnings.push({
      check_id: 'negative_score.methodology_disclaimer_missing',
      rule: 'review_date_recommended',
      path: 'display.low_score_last_reviewed_at',
      message:
        'display.low_score_last_reviewed_at is missing — required for on-page review date stamp in a future task.',
    })
  }

  return [...failures, ...warnings]
}

export function runNegativeScorePublicationGate(
  record: ApprovedProductRecord,
  options: NegativeScoreGateOptions = {},
): NegativeScoreGateResult {
  const score = record.score.payload.pac_safety_score
  const threshold = NEGATIVE_SCORE_PUBLICATION_GATE.threshold

  if (!scoreApplies(score)) {
    return {
      ok: true,
      applies: false,
      score,
      threshold,
      failures: [],
      warnings: [],
      required_review: false,
      review_status: 'not_required',
      evidence_status: 'skipped',
      language_status: 'skipped',
      gate_version: LOW_SCORE_GATE_VERSION,
    }
  }

  const authored = collectAuthoredDisplayCopy(record.display.payload)
  const languageFailures = scanLanguageSafety(authored)
  const evidenceFailures = scanEvidenceSufficiency(record)
  const methodologyIssues = scanMethodologyFields(record.display.payload)
  const methodologyFailures = methodologyIssues.filter((f) =>
    f.check_id === 'negative_score.methodology_disclaimer_missing' &&
    f.rule === 'methodology_disclaimer_required',
  )
  const methodologyWarnings = methodologyIssues.filter((f) => f.rule === 'review_date_recommended')

  const primaryConcern = primaryScoreDrivingConcern(record)
  const review = resolveLowScoreReview(record, options)
  const reviewResult = validateHumanReview(score, review, primaryConcern)

  const failures = [
    ...languageFailures,
    ...evidenceFailures,
    ...methodologyFailures,
    ...reviewResult.failures,
  ]
  const warnings = [...methodologyWarnings, ...reviewResult.warnings]

  const evidence_status: NegativeScoreGateResult['evidence_status'] =
    evidenceFailures.length > 0 ? 'failed' : 'passed'
  const language_status: NegativeScoreGateResult['language_status'] =
    languageFailures.length > 0 ? 'failed' : 'passed'

  return {
    ok: failures.length === 0,
    applies: true,
    score,
    threshold,
    failures,
    warnings,
    required_review: true,
    review_status: reviewResult.status,
    evidence_status,
    language_status,
    gate_version: LOW_SCORE_GATE_VERSION,
  }
}

export function assertNegativeScorePublicationReady(
  record: ApprovedProductRecord,
  options: NegativeScoreGateOptions = {},
): NegativeScoreGateResult {
  const result = runNegativeScorePublicationGate(record, options)
  if (!result.applies) return result
  if (!result.ok) {
    const summary = result.failures.map((f) => f.message).join('; ')
    throw new Error(`Negative-score publication gate failed: ${summary}`)
  }
  return result
}

/** Contract preflight adapter — maps gate failures to assertion 11 violations. */
/** Language-only validation for a proposed description override string. */
export function validateDescriptionOverrideLanguage(
  overrideText: string,
): { ok: boolean; failures: NegativeScoreGateFailure[] } {
  const failures = scanLanguageSafety([
    { path: 'display.product_description', text: overrideText.trim() },
  ])
  return { ok: failures.length === 0, failures }
}

/** Full negative-score gate on snapshot + proposed override (approval path). */
export function validateDescriptionOverrideForApproval(
  snapshot: import('./publishedDisplaySnapshot').PublishedDisplaySnapshotRecord,
  overrideText: string,
  options: NegativeScoreGateOptions = {},
): NegativeScoreGateResult {
  const record = snapshotToMinimalAprForGate(snapshot, overrideText, options)
  return runNegativeScorePublicationGate(record, options)
}

function snapshotToMinimalAprForGate(
  snapshot: import('./publishedDisplaySnapshot').PublishedDisplaySnapshotRecord,
  overrideText: string,
  options: NegativeScoreGateOptions = {},
): ApprovedProductRecord {
  const display = {
    ...snapshot.display,
    product_description: overrideText.trim(),
  }
  return {
    apr_id: 'override-gate-check',
    product_id: snapshot.product_id,
    schema_version: '1',
    assembled_at: new Date().toISOString(),
    assembled_content_hash: '',
    evidence: {
      snapshot_id: 'ev-gate',
      product_id: snapshot.product_id,
      gate: 'evidence',
      schema_version: '1',
      content_hash: '',
      approved_at: '',
      parent_hashes: {},
      payload: {
        evidence_id: '',
        bundle_version: 1,
        algorithm_version: '',
        reviewed_identity: {
          product_name: display.product_title,
          brand: '',
          sku_or_model: null,
          primary_retailer_url: null,
        },
        sources: (display.sources ?? []).map((s) => ({
          source_type: 'other_retailer',
          url: s.url,
          title: s.label,
          fetched_at: '',
          source_role: s.source_role,
          variant_mismatch: s.variant_mismatch ?? false,
        })),
        structured_evidence: {},
      },
    },
    normalization: {
      snapshot_id: 'norm-gate',
      product_id: snapshot.product_id,
      gate: 'normalization',
      schema_version: '1',
      content_hash: '',
      approved_at: '',
      parent_hashes: {},
      payload: {
        input_id: snapshot.product_id,
        evidence_id: '',
        evidence_content_hash: '',
        algorithm_version: '',
        components: [],
        layer_4a: null,
        layer_4b: null,
      },
    },
    display: {
      snapshot_id: 'disp-gate',
      product_id: snapshot.product_id,
      gate: 'display',
      schema_version: '1',
      content_hash: '',
      approved_at: '',
      parent_hashes: {},
      payload: display,
    },
    score: {
      snapshot_id: 'score-gate',
      product_id: snapshot.product_id,
      gate: 'score',
      schema_version: '1',
      content_hash: '',
      approved_at: '',
      parent_hashes: {},
      payload: {
        score_id: '',
        input_id: snapshot.product_id,
        normalization_content_hash: '',
        display_content_hash: '',
        pac_safety_score: snapshot.score.pac_safety_score,
        tier: snapshot.score.tier,
        displayed_confidence_range: snapshot.score.displayed_confidence_range ?? '',
        transparency_badge: snapshot.score.transparency_badge ?? '',
        weighted_npr: 0,
        escalator_applied: null,
        layer_4a_net: 0,
        algorithm_version: '',
      },
    },
    qa: {
      snapshot_id: 'qa-gate',
      product_id: snapshot.product_id,
      gate: 'qa',
      schema_version: '1',
      content_hash: '',
      approved_at: '',
      parent_hashes: {},
      payload: {
        qa_id: '',
        score_content_hash: '',
        display_content_hash: '',
        preflight: { passed: true, checked_at: '', checks: [] },
        checks: {},
        low_score_publication_review: options.low_score_publication_review ?? null,
      },
    },
  }
}

export function assertNegativeScorePublicationPolicy(
  record: ApprovedProductRecord,
  options: NegativeScoreGateOptions = {},
): NegativeScoreGateViolation[] {
  if (!NEGATIVE_SCORE_PUBLICATION_GATE.enabled) return []
  const result = runNegativeScorePublicationGate(record, options)
  if (!result.applies) return []
  return result.failures.map((f) => ({
    check_id: (f.check_id as NegativeScoreGateViolation['check_id']) ?? 'negative_score.publication_copy_required',
    rule: 'negative_score_publication',
    path: f.path,
    message: f.message,
  }))
}
