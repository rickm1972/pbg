import type {
  NormalizationComponent,
  NormalizationLayer4a,
  NormalizationLayer4b,
  ProductScoreRow,
} from '../types/agent'
import {
  buildComponentFactorLabels,
  buildEscalatorThresholdChecks,
  type EscalatorThresholdCheck,
  type ScoreFactorLabel,
} from './scoreMathFactorLabels'

const NPR_SCALE = 1000
const LAYER_4A_CAP = 5
const HARD_CAP_UNKNOWN_COATING = 72
const SCORE_MAX = 99
/** Agent 3 V2.3.4 — matches scripts/agent3/algorithm.mjs */
const INERT_EXPOSURE_MULTIPLIER = 0.2

export const ESCALATOR_INFO: Record<
  string,
  {
    multiplier: number
    plainEnglishName: string
    plainEnglishReason: string
    reason: string
    reviewerThresholds: string[]
    thresholds: string[]
  }
> = {
  escalator_4: {
    multiplier: 1.5,
    plainEnglishName: 'Direct oral contact on high-hazard material',
    plainEnglishReason:
      'This product has a component with direct oral contact on a high-hazard material (oral/teether/pacifier pattern). The algorithm applies a 1.5 multiplier.',
    reason: 'Direct oral contact on high-hazard material (oral/teether/pacifier pattern).',
    reviewerThresholds: [
      'Contact Intimacy must be 1.0 (direct contact)',
      'Material Hazard must be ≥ 0.80',
      'Oral / teether / pacifier use pattern in component text',
    ],
    thresholds: [
      'contact_intimacy = 1.0',
      'material_hazard ≥ 0.80',
      'oral / teether / pacifier use pattern in component text',
    ],
  },
  escalator_2: {
    multiplier: 1.4,
    plainEnglishName: "Children's product high-migration escalation",
    plainEnglishReason:
      "This is a children's or infant product with high migration potential under heat/fat exposure. The algorithm applies a 1.4 multiplier.",
    reason: "Children's product with high migration and heat/fat exposure severity.",
    reviewerThresholds: [
      "Product is classified as children's / infant / toy",
      'Migration Potential must be ≥ 0.60',
      'Exposure Severity must be ≥ 0.88',
    ],
    thresholds: [
      'children\'s / infant / toy category',
      'adjusted_migration_potential ≥ 0.60',
      'exposure_severity ≥ 0.88',
    ],
  },
  escalator_3: {
    multiplier: 1.3,
    plainEnglishName: 'Degraded coating escalation',
    plainEnglishReason:
      'A degraded coating was detected with post-degradation migration ≥ 0.70. The algorithm applies a 1.3 multiplier.',
    reason: 'Degraded coating with post-degradation migration ≥ 0.70.',
    reviewerThresholds: [
      'Degradation adjustment > 0',
      'Migration after degradation must be ≥ 0.70',
    ],
    thresholds: ['degradation_adjustment > 0', 'migration + degradation ≥ 0.70'],
  },
  escalator_1: {
    multiplier: 1.25,
    plainEnglishName: 'High-heat PFAS/PTFE cookware escalation',
    plainEnglishReason:
      'This product uses a PFAS/PTFE-family food-contact coating under high heat/fat exposure conditions. The algorithm applies a 1.25 multiplier when high-migration food-contact materials meet the cookware escalation thresholds.',
    reason:
      'PFAS/PTFE-family and similar high-migration food-contact materials under high heat/fat exposure (V2.3.4 cookware escalation).',
    reviewerThresholds: [
      'Migration Potential must be ≥ 0.60',
      'Exposure Severity must be ≥ 0.88',
      'Product is not an infant/children\'s product escalation case',
      'Material family is PFAS/PTFE or similar high-migration food-contact material',
    ],
    thresholds: [
      'adjusted_migration_potential ≥ 0.60',
      'exposure_severity ≥ 0.88',
      'not classified as children\'s / infant product',
    ],
  },
}

export type Layer4aVerifiedRow = {
  adjustment?: string
  matched?: boolean
  value?: number
  action_taken?: string
  canonical_label?: string
}

export type ScoreMathBreakdownContext = {
  layer4a?: NormalizationLayer4a
  layer4b?: NormalizationLayer4b
  layer4aVerified?: Layer4aVerifiedRow[]
  normalizationComponents?: NormalizationComponent[]
}

export type ComponentMathRow = {
  name: string
  hazard: number
  migration: number
  contactIntimacy: number
  severity: number
  duration: number
  /** Gate 2 normalization exposure (before Agent 3 inert ×0.2). */
  gate2Severity?: number
  gate2Duration?: number
  inertProtectionApplied?: boolean
  baseNpr: number
  nprAfterCategory: number
  escalatorId: string | null
  escalatorMultiplier: number
  finalNpr: number
  /** @deprecated use factorLabels */
  formula: string
  factorLabels: ScoreFactorLabel[]
  materialLabel?: string
}

export type RawScoreSteps = {
  general: string
  substituted: string
  result: string
}

export type Layer4aDisplay = {
  normalizationSuggestion: number
  appliedInFinalScore: number
  stripReason: string | null
  adjustments: Array<{
    label: string
    value: number
    includedInScore: boolean
    note?: string
  }>
}

export type ScoreMathBreakdown = {
  components: ComponentMathRow[]
  /** Sum of NPR after category modifiers, before escalator (single-component sum or CI-weighted mean). */
  baseNprBeforeEscalator: number
  weightedNprBeforeEscalator: number
  weightedNprAfterEscalator: number
  weightedNprFormula: string
  rawScore: number
  rawScoreSteps: RawScoreSteps
  layer4a: Layer4aDisplay
  escalator: {
    id: string
    plainEnglishName: string
    plainEnglishReason: string
    multiplier: number
    reason: string
    reviewerThresholds: string[]
    thresholds: string[]
    thresholdChecks: EscalatorThresholdCheck[]
    calculation: string
  } | null
  scoreAfter4a: number
  scoreAfter4aFormula: string
  roundedScore: number
  clampedScore: number
  displayedPacScore: number
  unknownCoatingCapApplied: boolean
  unknownCoatingCapValue: number | null
  confidence: {
    baseScore: number
    interval: number
    lower: number
    upper: number
    displayedRange: string | null
    badge: string | null
  }
  internallyConsistent: boolean
  consistencyNotes: string[]
}

function num(v: unknown, fallback = 0): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function fmt(n: number, digits = 4): string {
  return n.toFixed(digits)
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

function roundNearest(n: number): number {
  return Math.round(n)
}

function clampLayer4a(net: number): number {
  return clamp(net, -LAYER_4A_CAP, LAYER_4A_CAP)
}

function computeRawScore(weightedNpr: number): number {
  return 100 - Math.sqrt(Math.max(0, weightedNpr)) * 5
}

function parseDisplayedRange(text: string | null | undefined): [number, number] | null {
  if (!text?.trim()) return null
  const m = text.match(/(\d+)\s*[–-]\s*(\d+)/)
  if (!m) return null
  return [Number(m[1]), Number(m[2])]
}

function adjustmentLabel(adj: string | { reason?: string; label?: string }): string {
  if (typeof adj === 'string') return adj
  return adj.reason ?? adj.label ?? 'Adjustment'
}

function adjustmentValue(adj: string | { value?: number; points?: number }): number {
  if (typeof adj === 'string') {
    const parsed = Number.parseInt(adj.replace(/[^\d-]/g, ''), 10)
    return Number.isFinite(parsed) ? parsed : 0
  }
  const v = adj.value ?? adj.points
  return Number.isFinite(Number(v)) ? Number(v) : 0
}

function buildLayer4aDisplay(
  layer4a: NormalizationLayer4a | undefined,
  scoringNet: number,
  verified?: Layer4aVerifiedRow[],
): Layer4aDisplay {
  const normalizationSuggestion = num(layer4a?.net_adjustment)
  const appliedInFinalScore = scoringNet
  const adjustments = buildLayer4aAdjustments(layer4a, scoringNet, verified).adjustments

  let stripReason: string | null = null
  if (normalizationSuggestion !== appliedInFinalScore) {
    const marketingAdj = adjustments.find(
      (a) => /marketing language only/i.test(a.label) && !a.includedInScore,
    )
    if (marketingAdj) {
      stripReason =
        'Marketing-language deduction was stripped before scoring because materials are fully disclosed (not unknown or opaque coating).'
    } else {
      stripReason =
        verified?.find((v) => /stripped/i.test(String(v.action_taken ?? '')))?.action_taken ??
        'Server enforcement adjusted Layer 4A before scoring — see normalization audit trail.'
    }
  }

  return {
    normalizationSuggestion,
    appliedInFinalScore,
    stripReason,
    adjustments,
  }
}

function buildLayer4aAdjustments(
  layer4a: NormalizationLayer4a | undefined,
  scoringNet: number,
  verified?: Layer4aVerifiedRow[],
): ScoreMathBreakdown['layer4a'] {
  const normalizationNet = num(layer4a?.net_adjustment)
  const positives = layer4a?.positive_adjustments ?? []
  const negatives = layer4a?.negative_adjustments ?? []
  const adjustments: ScoreMathBreakdown['layer4a']['adjustments'] = []

  const stripNote =
    verified?.find((v) => /stripped/i.test(String(v.action_taken ?? '')))?.action_taken ??
    undefined

  for (const adj of positives) {
    adjustments.push({
      label: adjustmentLabel(adj),
      value: adjustmentValue(adj),
      includedInScore: scoringNet !== 0 || adjustmentValue(adj) === 0,
      note: 'Positive Layer 4A adjustments are included when matched by server enforcement.',
    })
  }

  for (const adj of negatives) {
    const label = adjustmentLabel(adj)
    const value = adjustmentValue(adj)
    const isMarketingOnly = /marketing language only/i.test(label)
    const strippedByServer =
      isMarketingOnly &&
      scoringNet === 0 &&
      value < 0 &&
      (layer4a?.net_adjustment ?? 0) !== scoringNet
    adjustments.push({
      label,
      value,
      includedInScore: !strippedByServer && value !== 0,
      note: strippedByServer
        ? (stripNote ??
          'Stripped before scoring — materials fully disclosed (server enforcement).')
        : undefined,
    })
  }

  if (!adjustments.length && normalizationNet !== 0) {
    adjustments.push({
      label: 'Net adjustment (normalization packet)',
      value: normalizationNet,
      includedInScore: scoringNet === normalizationNet,
    })
  }

  return {
    normalizationNet,
    scoringNet,
    adjustments,
  }
}

function parseConfidenceInterval(
  score: ProductScoreRow,
  layer4b?: NormalizationLayer4b,
): ScoreMathBreakdown['confidence'] {
  const baseScore = score.pac_safety_score
  const parsed = parseDisplayedRange(score.displayed_confidence_range)
  if (parsed) {
    const [lower, upper] = parsed
    const interval = Math.max(baseScore - lower, upper - baseScore)
    return {
      baseScore,
      interval,
      lower,
      upper,
      displayedRange: score.displayed_confidence_range,
      badge: score.transparency_badge ?? layer4b?.transparency_badge ?? null,
    }
  }

  const ci = num(layer4b?.confidence_interval, 0)
  const lower = clamp(baseScore - ci, 0, SCORE_MAX)
  const upper = clamp(baseScore + ci, 0, SCORE_MAX)
  return {
    baseScore,
    interval: ci,
    lower,
    upper,
    displayedRange: ci === 0 ? null : `${lower}–${upper}`,
    badge: score.transparency_badge ?? layer4b?.transparency_badge ?? null,
  }
}

function matchNormalizationComponent(
  name: string,
  pool: NormalizationComponent[] | undefined,
): NormalizationComponent | undefined {
  if (!pool?.length) return undefined
  const exact = pool.find((c) => c.component_name === name)
  if (exact) return exact
  return pool.find((c) =>
    c.component_name.toLowerCase().includes(name.toLowerCase().slice(0, 20)),
  )
}

/**
 * Reconstruct the V2.3.4 PAC score math trail for Gate 3 review.
 * Uses stored product_scores fields as source of truth for the displayed score.
 */
export function buildScoreMathBreakdown(
  score: ProductScoreRow,
  ctx: ScoreMathBreakdownContext = {},
): ScoreMathBreakdown {
  const storedComponents = score.component_nprs?.components ?? []
  const scoringNet = num(score.layer_4a_net)
  const unknownCoatingCap = Boolean(ctx.layer4a?.unknown_coating_cap_applies)

  const components: ComponentMathRow[] = storedComponents.map((c) => {
    const hazard = num(c.material_hazard)
    const migration = num(c.adjusted_migration_potential)
    const ci = num(c.contact_intimacy)
    const severity = num(c.exposure_severity)
    const duration = num(c.exposure_duration)
    const baseNpr = num(c.base_npr, hazard * migration * ci * severity * duration * NPR_SCALE)
    const nprAfterCategory = num(c.npr_after_category, baseNpr)
    const escalatorId = (c.escalator_applied as string | null) ?? null
    const escalatorMultiplier = num(c.escalator_multiplier, 1)
    const finalNpr = num(c.final_npr, nprAfterCategory * escalatorMultiplier)
    const name = String(c.component_name ?? 'Component')
    const norm = matchNormalizationComponent(name, ctx.normalizationComponents)
    const inertProtectionApplied = Boolean(c.inert_protection_applied)
    const gate2Severity =
      norm?.exposure_severity != null
        ? num(norm.exposure_severity)
        : inertProtectionApplied
          ? severity / INERT_EXPOSURE_MULTIPLIER
          : undefined
    const gate2Duration =
      norm?.exposure_duration != null
        ? num(norm.exposure_duration)
        : inertProtectionApplied
          ? duration / INERT_EXPOSURE_MULTIPLIER
          : undefined
    const factorLabels = buildComponentFactorLabels(
      hazard,
      migration,
      ci,
      severity,
      duration,
      baseNpr,
      norm,
      {
        inertProtectionApplied,
        gate2Severity,
        gate2Duration,
      },
    )

    return {
      name,
      hazard,
      migration,
      contactIntimacy: ci,
      severity,
      duration,
      gate2Severity,
      gate2Duration,
      inertProtectionApplied,
      baseNpr,
      nprAfterCategory,
      escalatorId,
      escalatorMultiplier,
      finalNpr,
      formula: `${fmt(hazard)} × ${fmt(migration)} × ${fmt(ci)} × ${fmt(severity)} × ${fmt(duration)} × ${NPR_SCALE} = ${fmt(baseNpr, 1)}`,
      factorLabels,
      materialLabel: norm?.material ?? String(c.material ?? ''),
    }
  })

  const sumCi = components.reduce((sum, c) => sum + c.contactIntimacy, 0)
  const baseNprBeforeEscalator = components.reduce((sum, c) => sum + c.nprAfterCategory, 0)
  const weightedNprBeforeEscalator =
    sumCi > 0
      ? components.reduce((sum, c) => sum + c.nprAfterCategory * c.contactIntimacy, 0) / sumCi
      : baseNprBeforeEscalator
  const weightedNprAfterEscalator =
    sumCi > 0
      ? components.reduce((sum, c) => sum + c.finalNpr * c.contactIntimacy, 0) / sumCi
      : num(score.weighted_npr)

  const weightedNprFormula =
    sumCi > 0
      ? `Σ(final_npr × CI) / Σ(CI) = ${fmt(weightedNprAfterEscalator, 4)}`
      : `Stored weighted NPR = ${fmt(num(score.weighted_npr), 4)}`

  const rawScore = computeRawScore(weightedNprAfterEscalator)
  const wNprDisplay = weightedNprAfterEscalator.toFixed(4)
  const rawScoreSteps: RawScoreSteps = {
    general: 'Raw score = 100 - (sqrt(Weighted NPR) × 5)',
    substituted: `Raw score = 100 - (sqrt(${wNprDisplay}) × 5)`,
    result: `Raw score = ${rawScore.toFixed(4)} (rounded PAC uses ${roundNearest(rawScore)})`,
  }

  const escalatorId =
    score.escalator_applied ??
    components.find((c) => c.escalatorId)?.escalatorId ??
    null
  const primaryComponent = components[0]
  const primaryNorm = primaryComponent
    ? matchNormalizationComponent(primaryComponent.name, ctx.normalizationComponents)
    : undefined
  const escalator =
    escalatorId && ESCALATOR_INFO[escalatorId]
      ? {
          id: escalatorId,
          plainEnglishName: ESCALATOR_INFO[escalatorId].plainEnglishName,
          plainEnglishReason: ESCALATOR_INFO[escalatorId].plainEnglishReason,
          ...ESCALATOR_INFO[escalatorId],
          thresholdChecks: primaryComponent
            ? buildEscalatorThresholdChecks(escalatorId, {
                migration: primaryComponent.migration,
                severity: primaryComponent.severity,
                materialLabel: primaryComponent.materialLabel,
                materialId: primaryNorm?.material_id,
                material: primaryNorm?.material,
              })
            : [],
          calculation: `Base NPR ${baseNprBeforeEscalator.toFixed(1)} × Escalator multiplier ${ESCALATOR_INFO[escalatorId].multiplier} = Weighted NPR ${weightedNprAfterEscalator.toFixed(1)}`,
        }
      : null

  let scoreAfter4a = rawScore + clampLayer4a(scoringNet)
  let unknownCoatingCapValue: number | null = null
  if (unknownCoatingCap) {
    unknownCoatingCapValue = HARD_CAP_UNKNOWN_COATING
    scoreAfter4a = Math.min(scoreAfter4a, HARD_CAP_UNKNOWN_COATING)
  }

  const scoreAfter4aFormula = unknownCoatingCap
    ? `${fmt(rawScore, 2)} + (${scoringNet}) = ${fmt(rawScore + clampLayer4a(scoringNet), 2)} → min(…, ${HARD_CAP_UNKNOWN_COATING}) = ${fmt(scoreAfter4a, 2)}`
    : `${fmt(rawScore, 2)} + (${scoringNet}) = ${fmt(scoreAfter4a, 2)}`

  const roundedScore = roundNearest(scoreAfter4a)
  const clampedScore = clamp(roundedScore, 0, SCORE_MAX)

  const layer4a = buildLayer4aDisplay(ctx.layer4a, scoringNet, ctx.layer4aVerified)
  const confidence = parseConfidenceInterval(score, ctx.layer4b)

  const consistencyNotes: string[] = []
  const recomputedPac = clampedScore
  if (recomputedPac !== score.pac_safety_score) {
    consistencyNotes.push(
      `Recomputed PAC ${recomputedPac} differs from stored ${score.pac_safety_score} — check component NPR payload or algorithm version.`,
    )
  }

  return {
    components,
    baseNprBeforeEscalator,
    weightedNprBeforeEscalator,
    weightedNprAfterEscalator,
    weightedNprFormula,
    rawScore,
    rawScoreSteps,
    layer4a,
    escalator,
    scoreAfter4a,
    scoreAfter4aFormula,
    roundedScore,
    clampedScore,
    displayedPacScore: score.pac_safety_score,
    unknownCoatingCapApplied: unknownCoatingCap,
    unknownCoatingCapValue,
    confidence,
    internallyConsistent: recomputedPac === score.pac_safety_score,
    consistencyNotes,
  }
}
