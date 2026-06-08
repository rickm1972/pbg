/**
 * Server-side Layer 4B badge + strip invalid Layer 4A negatives (V2.3.4).
 */
import {
  BADGES,
  hasPackagingOnlyInference,
  hasPrimaryInferredComponent,
} from '../agent3/confidence-interval.mjs'
import { deriveLayer4bTransparencyFromContract } from '../../src/shared/agent2/layer4b-transparency-contract.mjs'
import { safetyClaimContradictsMaterials } from './safety-claim-contradiction.mjs'

const MARKETING_LANGUAGE_REASON = 'marketing language only, no verifiable claims'

function normalizeConfidence(raw) {
  return String(raw ?? '').trim().toLowerCase()
}

function hasNegativeLayer4a(inputs) {
  for (const adj of inputs.layer_4a?.negative_adjustments ?? []) {
    const reason =
      typeof adj === 'string' ? adj : String(adj?.reason ?? adj?.label ?? '')
    const value =
      typeof adj === 'object' && adj != null
        ? Number(adj.value ?? adj.points ?? 0)
        : Number.parseInt(String(adj).replace(/[^\d-]/g, ''), 10)
    if (/not applied|does not apply/i.test(reason)) continue
    if (Number.isFinite(value) && value < 0) return true
  }
  return false
}

function hasUnknownFoodContactCoating(inputs) {
  return (inputs.components ?? []).some((c) => {
    const text = [
      c.material,
      c.material_hazard_table_entry,
      c.component_name,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return (
      /unknown proprietary food-contact coating|0\.80.*cap|terrabond|thermo-spot/i.test(
        text,
      ) && Number(c.contact_intimacy) >= 0.7
    )
  })
}

/** Marketing-language -2 does not apply when materials are fully disclosed (e.g. Lodge cast iron). */
export function shouldStripMarketingLanguageNegative(inputs) {
  if (inputs.layer_4a?.unknown_coating_cap_applies) return false
  if (hasPrimaryInferredComponent(inputs)) return false
  if (hasUnknownFoodContactCoating(inputs)) return false
  if (inputs.evidence && safetyClaimContradictsMaterials(inputs.evidence, inputs.components)) {
    return false
  }
  return true
}

export function stripMarketingLanguageNegative(inputs) {
  if (!shouldStripMarketingLanguageNegative(inputs)) {
    return { inputs, stripped: false }
  }

  const negatives = inputs.layer_4a?.negative_adjustments ?? []
  const kept = negatives.filter((adj) => {
    const reason =
      typeof adj === 'string' ? adj : String(adj?.reason ?? adj?.label ?? '')
    return !/marketing language only,\s*no verifiable/i.test(reason)
  })

  if (kept.length === negatives.length) {
    return { inputs, stripped: false }
  }

  const positiveSum = (inputs.layer_4a?.positive_adjustments ?? []).reduce((s, adj) => {
    const v = typeof adj === 'object' ? Number(adj.value ?? adj.points ?? 0) : 0
    return s + (Number.isFinite(v) ? v : 0)
  }, 0)
  const negativeSum = kept.reduce((s, adj) => {
    const v = typeof adj === 'object' ? Number(adj.value ?? adj.points ?? 0) : 0
    return s + (Number.isFinite(v) ? v : 0)
  }, 0)

  inputs.layer_4a = {
    ...inputs.layer_4a,
    negative_adjustments: kept,
    net_adjustment: Math.max(-5, Math.min(5, positiveSum + negativeSum)),
  }

  const verified = inputs.layer_4a_verified ?? []
  verified.push({
    adjustment: MARKETING_LANGUAGE_REASON,
    matched: false,
    value: 0,
    action_taken:
      'stripped — materials fully disclosed; no unknown food-contact coating (V2.3.4)',
  })
  inputs.layer_4a_verified = verified

  return { inputs, stripped: true }
}

const BADGE_RANK = {
  [BADGES.FULL_DISCLOSED]: 0,
  [BADGES.DOCUMENTATION_INCOMPLETE]: 1,
  [BADGES.MATERIAL_UNCERTAIN]: 2,
  [BADGES.OPAQUE]: 3,
}

function stricterBadge(a, b) {
  const ra = BADGE_RANK[a] ?? 2
  const rb = BADGE_RANK[b] ?? 2
  return ra >= rb ? a : b
}

/** Agent 2 preview badge (Agent 3 recomputes CI from score). */
export function enforceLayer4b(inputs, options = {}) {
  const gate1 = options.gate1TransparencyAssessment
  const opaque = Boolean(inputs.layer_4a?.unknown_coating_cap_applies)
  const primaryInferred = hasPrimaryInferredComponent(inputs)
  const packagingOnlyInferred = hasPackagingOnlyInference(inputs)
  const negative = hasNegativeLayer4a(inputs)

  const derived = deriveLayer4bTransparencyFromContract({
    opaque,
    primaryInferred,
    negativeLayer4a: negative,
    components: inputs.components,
  })

  let transparency_badge = derived.transparency_badge
  let confidence_interval = derived.confidence_interval
  let badge_justification = derived.badge_justification

  if (
    packagingOnlyInferred &&
    transparency_badge === BADGES.FULL_DISCLOSED
  ) {
    badge_justification =
      'Zero primary-contact inferred components; packaging-only inference does not affect badge (V2.3.4).'
  }

  if (gate1?.transparency_badge) {
    const merged = stricterBadge(transparency_badge, gate1.transparency_badge)
    if (merged !== transparency_badge) {
      transparency_badge = merged
      badge_justification = gate1.badge_justification ?? badge_justification
      if (merged === BADGES.DOCUMENTATION_INCOMPLETE) confidence_interval = Math.max(confidence_interval, 3)
      if (merged === BADGES.MATERIAL_UNCERTAIN) confidence_interval = Math.max(confidence_interval, 12)
      if (merged === BADGES.OPAQUE) confidence_interval = Math.max(confidence_interval, 22)
    }
  }

  inputs.layer_4b = {
    transparency_badge,
    confidence_interval,
    badge_justification,
    gate1_transparency_assessment: gate1 ?? null,
  }
  return inputs
}

export function finalizeNormalization(inputs) {
  let current = inputs
  const { inputs: afterStrip, stripped } = stripMarketingLanguageNegative(current)
  current = afterStrip
  current = enforceLayer4b(current)
  if (stripped) {
    current.normalization_notes = [
      current.normalization_notes,
      'Server stripped Marketing language only Layer 4A — not applicable when manufacturer fully discloses materials.',
    ]
      .filter(Boolean)
      .join(' ')
  }
  return current
}
