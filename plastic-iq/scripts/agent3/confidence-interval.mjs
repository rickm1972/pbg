/**
 * V2.3.4 — Transparency badge + confidence interval from plausible hazard bands.
 */
import { scorePacCore } from './algorithm.mjs'

export const INFERRED_CONFIDENCES = new Set([
  'inferred from description',
  'inferred from category pattern',
  'unknown',
  'proprietary or undisclosed',
])

export const PRIMARY_CONTACT_CI_THRESHOLD = 0.7

export const BADGES = {
  FULL_DISCLOSED: 'Full Disclosed',
  DOCUMENTATION_INCOMPLETE: 'Documentation Incomplete',
  MATERIAL_UNCERTAIN: 'Material Uncertain',
  OPAQUE: 'Opaque',
}

function normalizeConfidence(raw) {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
}

function componentBlob(component) {
  return [
    component.component_name,
    component.material,
    component.material_hazard_table_entry,
    component.rationale,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function hasInferredComponent(inputs) {
  return (inputs.components ?? []).some((c) =>
    INFERRED_CONFIDENCES.has(normalizeConfidence(c.data_confidence)),
  )
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

/**
 * Plausible hazard band for a component (null = point estimate only).
 * @returns {{ low: number, high: number, kind: string } | null}
 */
export function getComponentHazardBand(component, inputs) {
  const ci = Number(component.contact_intimacy)
  const conf = normalizeConfidence(component.data_confidence)
  const text = componentBlob(component)
  const haz = Number(component.material_hazard)

  if (inputs.layer_4a?.unknown_coating_cap_applies) {
    if (
      ci >= PRIMARY_CONTACT_CI_THRESHOLD &&
      (/unknown proprietary|terrabond|thermo-spot|0\.80/i.test(text) || haz >= 0.75)
    ) {
      return { low: 0.8, high: 0.8, kind: 'opaque_coating' }
    }
  }

  if (
    ci >= PRIMARY_CONTACT_CI_THRESHOLD &&
    (conf === 'unknown' ||
      (/bristle|could be nylon|natural fiber/i.test(text) &&
        /conservative upper bound|0\.25.*0\.68|multiple/i.test(text)))
  ) {
    if (/bristle|could be nylon, silicone|nylon non-food-contact 0\.45 \(conservative/i.test(text)) {
      return { low: 0.25, high: 0.68, kind: 'wide_primary' }
    }
  }

  if (/teak/i.test(text) && /wood untreated|finishing|oiled|beeswax|polished|natural/i.test(text)) {
    return { low: 0.06, high: 0.08, kind: 'teak_finishing' }
  }

  if (
    /recycled plastic unspecified|100% post-consumer|pcr plastic|recycled plastic, resin type unspecified/i.test(
      text,
    ) ||
    (haz >= 0.7 && /recycled|pcr|post-consumer/i.test(text))
  ) {
    return { low: 0.72, high: 0.72, kind: 'pcr_unspecified' }
  }

  if (
    ci >= PRIMARY_CONTACT_CI_THRESHOLD &&
    /silicone unverified|food-grade status not|grade unverified|food-grade verification not/i.test(text)
  ) {
    return { low: 0.15, high: 0.25, kind: 'silicone_primary' }
  }

  if (
    /resin type unspecified|resin unspecified|plastic bottle.*not disclosed|highest plausible.*pp5|hdpe.*ldpe.*pp5/i.test(
      text,
    ) &&
    INFERRED_CONFIDENCES.has(conf)
  ) {
    return { low: 0.18, high: 0.2, kind: 'resin_undisclosed' }
  }

  if (
    /grade unspecified|ss304 0\.03 \(inferred|18\/8 or 18\/10 inferred|type unspecified, scored conservatively at ss304/i.test(
      text,
    ) &&
    !INFERRED_CONFIDENCES.has(conf)
  ) {
    return { low: 0.02, high: 0.03, kind: 'ss_grade' }
  }

  if (
    ci < PRIMARY_CONTACT_CI_THRESHOLD &&
    ci >= 0.25 &&
    /gasket|seal/i.test(text) &&
    INFERRED_CONFIDENCES.has(conf)
  ) {
    return { low: 0.15, high: 0.38, kind: 'gasket' }
  }

  if (
    /exterior|powder coat|duracoat|klean coat/i.test(text) &&
    ci <= 0.15 &&
    !INFERRED_CONFIDENCES.has(conf)
  ) {
    return { low: 0.3, high: 0.4, kind: 'exterior_coat' }
  }

  if (INFERRED_CONFIDENCES.has(conf) && ci >= PRIMARY_CONTACT_CI_THRESHOLD) {
    const assigned = Number.isFinite(haz) ? haz : 0.45
    return { low: assigned, high: assigned, kind: 'inferred_primary_point' }
  }

  return null
}

function buildHazardOverrides(inputs, mode) {
  /** @type {Record<string, number>} */
  const overrides = {}
  for (const component of inputs.components ?? []) {
    const band = getComponentHazardBand(component, inputs)
    if (!band || band.low === band.high) continue
    overrides[component.component_name] = mode === 'low' ? band.low : band.high
  }
  return overrides
}

function scoreHalfWidth(inputs, pacScore) {
  const lowOverrides = buildHazardOverrides(inputs, 'low')
  const highOverrides = buildHazardOverrides(inputs, 'high')
  const hasBand =
    Object.keys(lowOverrides).length > 0 || Object.keys(highOverrides).length > 0

  if (!hasBand) return 0

  const lowResult = scorePacCore(inputs, lowOverrides)
  const highResult = scorePacCore(inputs, highOverrides)
  return Math.max(0, pacScore - lowResult.pac_safety_score, highResult.pac_safety_score - pacScore)
}

function hasWidePrimaryBand(inputs) {
  return (inputs.components ?? []).some((c) => {
    const band = getComponentHazardBand(c, inputs)
    return band?.kind === 'wide_primary'
  })
}

function hasPcrUnspecifiedBand(inputs) {
  return (inputs.components ?? []).some((c) => {
    const band = getComponentHazardBand(c, inputs)
    return band?.kind === 'pcr_unspecified'
  })
}

function hasOnlyDocumentationBands(inputs) {
  const bands = (inputs.components ?? [])
    .map((c) => getComponentHazardBand(c, inputs))
    .filter(Boolean)
  if (!bands.length) return false
  const docKinds = new Set(['teak_finishing', 'ss_grade', 'exterior_coat', 'resin_undisclosed'])
  return bands.every((b) => docKinds.has(b.kind) || b.low === b.high)
}

/**
 * @param {object} inputs — scoring_inputs.inputs
 * @param {number} pacScore — score at assigned hazards
 */
export function deriveTransparencyBadgeAndCI(inputs, pacScore) {
  const halfWidth = Math.ceil(scoreHalfWidth(inputs, pacScore))
  const opaque = Boolean(inputs.layer_4a?.unknown_coating_cap_applies)
  const inferred = hasInferredComponent(inputs)
  const negative = hasNegativeLayer4a(inputs)
  const widePrimary = hasWidePrimaryBand(inputs)
  const pcrUnspecified = hasPcrUnspecifiedBand(inputs)
  const onlyDoc = hasOnlyDocumentationBands(inputs)

  let transparency_badge
  let confidence_interval

  if (opaque) {
    transparency_badge = BADGES.OPAQUE
    confidence_interval = Math.max(22, halfWidth)
  } else if (!inferred && !negative) {
    transparency_badge = BADGES.FULL_DISCLOSED
    confidence_interval = 0
  } else if (widePrimary || inferred || pcrUnspecified) {
    transparency_badge = BADGES.MATERIAL_UNCERTAIN
    confidence_interval = Math.max(12, halfWidth)
  } else if (onlyDoc) {
    transparency_badge = BADGES.DOCUMENTATION_INCOMPLETE
    confidence_interval = 3
  } else {
    transparency_badge = BADGES.MATERIAL_UNCERTAIN
    confidence_interval = Math.max(12, halfWidth)
  }

  const lower = Math.max(0, pacScore - confidence_interval)
  const upper = Math.min(99, pacScore + confidence_interval)
  const displayed_confidence_range =
    confidence_interval === 0 ? null : `${lower}–${upper}`

  return {
    transparency_badge,
    confidence_interval,
    displayed_confidence_range,
    score_swing_half_width: halfWidth,
    badge_justification: buildBadgeJustification({
      transparency_badge,
      confidence_interval,
      opaque,
      inferred,
      negative,
      widePrimary,
      pcrUnspecified,
      halfWidth,
    }),
  }
}

function buildBadgeJustification(ctx) {
  const parts = [`Badge: ${ctx.transparency_badge}`, `CI: ±${ctx.confidence_interval}`]
  if (ctx.opaque) parts.push('unknown food-contact coating cap applies')
  if (ctx.inferred) parts.push('has inferred/unknown/proprietary component confidences')
  if (ctx.negative) parts.push('has negative Layer 4A adjustments')
  if (ctx.widePrimary) parts.push('wide primary food-contact hazard band')
  if (ctx.pcrUnspecified) parts.push('recycled PCR resin unspecified')
  if (ctx.halfWidth > 0) parts.push(`re-score half-width: ${ctx.halfWidth}`)
  return parts.join('; ')
}
