/**
 * Server-side Layer 4A enforcement (positives + negatives) — mirrors Agent 1 cert verification pattern.
 */
import { LAYER_4A_NEGATIVE_LOOKUP } from '../agent4/constants.mjs'
import {
  enforceLayer4aPositive,
  formatLayer4aPositiveReasoning,
  lookupLayer4aPositive,
} from './layer4a-positive.mjs'

function normalizeReasonText(s) {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .replace(/\u2013|\u2014|–|—/g, '-')
    .replace(/\s+/g, ' ')
}

function adjustmentReason(adj) {
  if (typeof adj === 'string') return adj.trim()
  return String(adj?.reason ?? adj?.label ?? adj?.basis ?? '').trim()
}

function adjustmentValue(adj) {
  if (typeof adj === 'object' && adj != null) {
    const v = adj.value ?? adj.points
    if (v != null) return Number(v)
    if (typeof adj.adjustment === 'string') {
      const parsed = Number.parseInt(adj.adjustment.replace(/[^\d-]/g, ''), 10)
      return Number.isFinite(parsed) ? parsed : NaN
    }
  }
  return NaN
}

function isNegativeMarkedNotApplied(reason, value) {
  const text = String(reason ?? '')
  if (/not applied|does not apply|not apply:/i.test(text)) return true
  if (value === 0 && /not applied|does not apply/i.test(text)) return true
  return false
}

function lookupNegative(reason) {
  const norm = normalizeReasonText(reason)
  if (!norm) return null

  let best = null
  for (const row of LAYER_4A_NEGATIVE_LOOKUP) {
    const canonicalNorm = normalizeReasonText(row.reason)
    if (!canonicalNorm) continue
    const matches =
      row.pattern?.test(norm) ||
      norm === canonicalNorm ||
      norm.includes(canonicalNorm) ||
      canonicalNorm.includes(norm)
    if (!matches) continue
    if (!best || canonicalNorm.length > best.canonicalNorm.length) {
      best = { canonical: row.reason, value: row.value, canonicalNorm }
    }
  }
  return best ? { canonical: best.canonical, value: best.value } : null
}

function shouldApplyUnknownCoatingCap(negatives) {
  return negatives.some((adj) => {
    const reason = adjustmentReason(adj)
    const value = adjustmentValue(adj)
    if (isNegativeMarkedNotApplied(reason, value)) return false
    return (
      /unknown proprietary food-contact coating/i.test(reason) &&
      !/proprietary food-contact coating chemistry undisclosed/i.test(reason) &&
      value === -3
    )
  })
}

/**
 * Enforce negative adjustments to the four allowed exact reasons; rebuild net_adjustment.
 * @param {object} inputs
 * @returns {{ inputs: object, layer_4a_verified: object[] }}
 */
export function enforceLayer4aNegatives(inputs) {
  const layer4a = inputs.layer_4a ?? {}
  const rawNegatives = Array.isArray(layer4a.negative_adjustments)
    ? layer4a.negative_adjustments
    : []

  const layer_4a_verified = []
  const enforcedNegatives = []

  for (const adj of rawNegatives) {
    const reason = adjustmentReason(adj)
    const value = adjustmentValue(adj)

    if (isNegativeMarkedNotApplied(reason, value)) {
      layer_4a_verified.push({
        adjustment: reason || '(not applied)',
        matched: false,
        value: 0,
        action_taken: 'skipped — marked not applied',
      })
      continue
    }

    const lookup = lookupNegative(reason)
    if (!lookup) {
      layer_4a_verified.push({
        adjustment: reason || '(empty)',
        matched: false,
        value: 0,
        action_taken: 'stripped — not in Layer 4A negative lookup table',
      })
      continue
    }

    enforcedNegatives.push({
      reason: lookup.canonical,
      value: lookup.value,
    })
    layer_4a_verified.push({
      adjustment: reason,
      matched: true,
      canonical_label: lookup.canonical,
      value: lookup.value,
      action_taken: 'kept',
    })
  }

  const positiveSum = (layer4a.positive_adjustments ?? []).reduce((sum, adj) => {
    const v = adjustmentValue(adj)
    return sum + (Number.isFinite(v) ? v : 0)
  }, 0)
  const negativeSum = enforcedNegatives.reduce((sum, adj) => sum + adj.value, 0)

  const unknownCoatingCap = shouldApplyUnknownCoatingCap(enforcedNegatives)

  inputs.layer_4a = {
    ...layer4a,
    negative_adjustments: enforcedNegatives,
    net_adjustment: Math.max(-5, Math.min(5, positiveSum + negativeSum)),
    unknown_coating_cap_applies: unknownCoatingCap,
  }

  return { inputs, layer_4a_verified }
}

const MARKETING_LANGUAGE_NEGATIVE = {
  reason: 'Marketing language only, no verifiable claims',
  value: -2,
}

/**
 * When unknown food-contact coating cap applies, PFAS-free / non-toxic marketing on
 * undisclosed chemistry is not independently verifiable — require marketing -2.
 */
export function enforceMarketingLanguageForUnknownCoating(inputs) {
  if (!inputs.layer_4a?.unknown_coating_cap_applies) {
    return { inputs, added: false }
  }

  const layer4a = inputs.layer_4a ?? {}
  const negatives = [...(layer4a.negative_adjustments ?? [])]
  const hasMarketing = negatives.some((adj) =>
    /marketing language only,\s*no verifiable/i.test(adjustmentReason(adj)),
  )

  if (hasMarketing) {
    return { inputs, added: false }
  }

  negatives.push({
    reason: MARKETING_LANGUAGE_NEGATIVE.reason,
    value: MARKETING_LANGUAGE_NEGATIVE.value,
  })

  const positiveSum = (layer4a.positive_adjustments ?? []).reduce((sum, adj) => {
    const v = adjustmentValue(adj)
    return sum + (Number.isFinite(v) ? v : 0)
  }, 0)
  const negativeSum = negatives.reduce((sum, adj) => sum + adjustmentValue(adj), 0)

  inputs.layer_4a = {
    ...layer4a,
    negative_adjustments: negatives,
    net_adjustment: Math.max(-5, Math.min(5, positiveSum + negativeSum)),
    unknown_coating_cap_applies: true,
  }

  return { inputs, added: true }
}

/**
 * Full Layer 4A enforcement: positives, negatives, layer_4a_verified audit trail.
 */
export function enforceLayer4a(inputs) {
  enforceLayer4aPositive(inputs)
  const { inputs: withNegatives, layer_4a_verified: negativeVerified } =
    enforceLayer4aNegatives(inputs)
  const { inputs: withMarketing, added: marketingAdded } =
    enforceMarketingLanguageForUnknownCoating(withNegatives)
  if (marketingAdded) {
    withMarketing.normalization_notes = [
      withMarketing.normalization_notes,
      'Server added Marketing language only Layer 4A (-2) — PFAS-free/non-toxic claims on unknown proprietary food-contact coating are not independently verifiable.',
    ]
      .filter(Boolean)
      .join(' ')
  }

  const positiveVerified = (withMarketing.layer_4a_positive_reasoning ?? []).map((row) => {
    const lookup = lookupLayer4aPositive(row.exact_list_match ?? '')
    return {
      adjustment: row.certification_found ?? row.certification ?? '(none)',
      exact_list_match: row.exact_list_match ?? '',
      matched: Boolean(row.matched),
      value: row.awarded_value ?? 0,
      action_taken: row.matched ? 'kept' : 'no exact lookup match',
      ...(row.rejection_reason ? { rejection_reason: row.rejection_reason } : {}),
    }
  })

  const verified = [...positiveVerified, ...negativeVerified]
  if (marketingAdded) {
    verified.push({
      adjustment: MARKETING_LANGUAGE_NEGATIVE.reason,
      matched: true,
      canonical_label: MARKETING_LANGUAGE_NEGATIVE.reason,
      value: MARKETING_LANGUAGE_NEGATIVE.value,
      action_taken:
        'added — manufacturer safety claims on unknown proprietary food-contact coating are not independently verifiable (server-enforced V2.3.4)',
    })
  }
  withMarketing.layer_4a_verified = verified
  return withMarketing
}

export { formatLayer4aPositiveReasoning, lookupLayer4aPositive }
