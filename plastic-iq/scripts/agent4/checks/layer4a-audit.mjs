/**
 * Check 2 — Layer 4A audit (exact lookup table match).
 */
import { LAYER_4A_POSITIVE_LOOKUP } from '../../agent2/layer4a-positive.mjs'
import { LAYER_4A_NEGATIVE_LOOKUP } from '../constants.mjs'

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

function sumAdjustments(items) {
  return (items ?? []).reduce((sum, adj) => {
    const v = adjustmentValue(adj)
    return sum + (Number.isFinite(v) ? v : 0)
  }, 0)
}

/**
 * @param {object} inputs — scoring_inputs.inputs
 */
export function runLayer4aAudit(inputs) {
  const layer4a = inputs?.layer_4a ?? {}
  const positives = layer4a.positive_adjustments ?? []
  const negatives = layer4a.negative_adjustments ?? []
  const reasoning = inputs?.layer_4a_positive_reasoning ?? []
  const flags = []

  const positiveByLabel = new Map(
    LAYER_4A_POSITIVE_LOOKUP.map((row) => [row.exact_label, row.points]),
  )
  const negativeByReason = new Map(
    LAYER_4A_NEGATIVE_LOOKUP.map((row) => [row.reason, row.value]),
  )

  for (const adj of positives) {
    const reason = adjustmentReason(adj)
    const value = adjustmentValue(adj)
    const expected = positiveByLabel.get(reason)
    if (expected == null) {
      flags.push({
        code: 'L4A_POSITIVE_NO_EXACT_MATCH',
        message: `Positive adjustment "${reason}" is not in the V2.3.3 lookup table`,
        context: { reason, value },
      })
      continue
    }
    if (value !== expected) {
      flags.push({
        code: 'L4A_POSITIVE_VALUE_MISMATCH',
        message: `Positive "${reason}" has value ${value}; lookup expects ${expected}`,
        context: { reason, value, expected },
      })
    }
  }

  const matchedReasoning = reasoning.filter((r) => r.matched === true)
  for (const adj of positives) {
    const reason = adjustmentReason(adj)
    const hasReasoning = matchedReasoning.some(
      (r) =>
        String(r.exact_list_match ?? r.matched_label ?? '').trim() === reason ||
        String(r.matched_canonical_label ?? '').trim() === reason,
    )
    if (!hasReasoning) {
      flags.push({
        code: 'L4A_POSITIVE_UNMATCHED_REASONING',
        message: `Positive "${reason}" has no matched layer_4a_positive_reasoning row`,
        context: { reason },
      })
    }
  }

  function lookupNegative(reason) {
    if (negativeByReason.has(reason)) {
      return { canonical: reason, value: negativeByReason.get(reason) }
    }
    for (const [canonical, value] of negativeByReason) {
      if (reason.startsWith(canonical) || canonical.startsWith(reason)) {
        return { canonical, value }
      }
    }
    return null
  }

  for (const adj of negatives) {
    const reason = adjustmentReason(adj)
    const value = adjustmentValue(adj)
    const lookup = lookupNegative(reason)
    if (!lookup) {
      flags.push({
        code: 'L4A_NEGATIVE_NOT_IN_TABLE',
        message: `Negative adjustment "${reason}" is not one of the four allowed negatives`,
        context: { reason, value },
      })
      continue
    }
    const expected = lookup.value
    if (value !== expected) {
      flags.push({
        code: 'L4A_NEGATIVE_VALUE_MISMATCH',
        message: `Negative "${reason}" has value ${value}; table expects ${expected}`,
        context: { reason, value, expected },
      })
    }
  }

  const positiveSum = sumAdjustments(positives)
  const negativeSum = sumAdjustments(negatives)
  const recomputed = Math.max(-5, Math.min(5, positiveSum + negativeSum))
  const reported = Number(layer4a.net_adjustment ?? 0)
  if (reported !== recomputed) {
    flags.push({
      code: 'L4A_NET_MISMATCH',
      message: `net_adjustment is ${reported}; recomputed sum is ${recomputed}`,
      context: { reported, recomputed, positiveSum, negativeSum },
    })
  }

  return {
    status: flags.length ? 'flag' : 'pass',
    flags,
    positives_audited: positives.length,
    negatives_audited: negatives.length,
    net_adjustment_reported: reported,
    net_adjustment_recomputed: recomputed,
  }
}
