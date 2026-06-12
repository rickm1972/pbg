/**
 * Phase 6.7 — build agent3_locked_outputs JSON payloads from locked-input score result.
 * Pure conversion; no DB, no re-lookup, no mutation of locked inputs.
 */

/**
 * @param {import('../../src/types/lockedInput.ts').LockedInputPayload} lockedPayload
 * @param {ReturnType<import('./score-locked-input.mjs').scoreLockedInputPackage>} scoreResult
 */
export function buildLockedOutputPayloads(lockedPayload, scoreResult) {
  const scoreDrivingIds = new Set(
    (lockedPayload.locked_components ?? [])
      .filter((c) => c.locked_is_score_driving)
      .map((c) => c.locked_component_id),
  )

  const components = (scoreResult.component_math_breakdown ?? []).map((c) => ({
    component_name: c.component_name,
    component_role: c.component_role,
    score_driving: true,
    locked_canonical_material_id: c.locked_canonical_material_id,
    locked_resolved_material_taxonomy_id: c.locked_resolved_material_taxonomy_id ?? null,
    hazard_used: c.hazard_used,
    base_migration: c.base_migration,
    adjusted_migration_used: c.adjusted_migration_used,
    contact_intimacy: c.contact_intimacy,
    exposure_severity: c.exposure_severity,
    exposure_duration: c.exposure_duration,
    non_detect_mitigation_applied: Boolean(c.non_detect_mitigation_applied),
    mitigation_factor: c.mitigation_factor ?? null,
    component_weight: c.component_weight ?? c.contact_intimacy,
    npr_before_escalator: c.npr_before_escalator,
    escalator_multiplier: c.escalator_multiplier ?? 1,
    npr_after_escalator: c.npr_after_escalator,
    inert_protection_applied: Boolean(c.inert_protection_applied),
  }))

  /** @type {import('../../src/types/agent3LockedOutput.ts').Agent3LockedOutputScorePayload} */
  const score_payload = {
    pac_safety_score: scoreResult.pac_safety_score,
    tier: scoreResult.tier,
    transparency_badge: scoreResult.transparency_badge ?? null,
    weighted_npr: scoreResult.weighted_npr,
    raw_score_before_layer_4a: scoreResult.raw_score_before_layer_4a,
    layer_4a_total_applied: scoreResult.layer_4a_total_applied,
    score_after_layer_4a: scoreResult.score_after_layer_4a,
    cap_triggered: Boolean(scoreResult.cap_triggered),
    cap_value: scoreResult.cap_value ?? null,
    score_after_cap: scoreResult.score_after_cap,
    final_score: scoreResult.final_score,
    escalator_applied: scoreResult.escalator_applied ?? null,
    input_source: 'locked_input_package',
  }

  /** @type {import('../../src/types/agent3LockedOutput.ts').Agent3LockedOutputMathBreakdown} */
  const math_breakdown = {
    components,
    weighted_npr_breakdown: scoreResult.weighted_npr_breakdown ?? {},
    weighted_npr: scoreResult.weighted_npr,
    raw_score_before_layer_4a: scoreResult.raw_score_before_layer_4a,
    raw_score_formula: scoreResult.raw_score_formula ?? null,
    layer_4a_total_applied: scoreResult.layer_4a_total_applied,
    score_after_layer_4a: scoreResult.score_after_layer_4a,
    cap_triggered: Boolean(scoreResult.cap_triggered),
    cap_value: scoreResult.cap_value ?? null,
    score_after_cap: scoreResult.score_after_cap,
    final_score: scoreResult.final_score,
  }

  const primaryMaterials = (lockedPayload.locked_components ?? [])
    .filter((c) => c.locked_is_score_driving)
    .map((c) => ({
      name: c.locked_component_name,
      role: c.locked_component_role,
      canonical_id: c.locked_canonical_material_id,
    }))

  const badge = scoreResult.transparency_badge ?? lockedPayload.locked_transparency_badge
  const whyDraft = [
    `PAC Safety Score ${scoreResult.pac_safety_score} (${scoreResult.tier}) from locked Agent 1 package.`,
    badge ? `Transparency badge: ${badge}.` : null,
    scoreResult.layer_4a_total_applied
      ? `Layer 4A adjustment ${scoreResult.layer_4a_total_applied}.`
      : null,
    lockedPayload.locked_badge_basis ? lockedPayload.locked_badge_basis : null,
  ]
    .filter(Boolean)
    .join(' ')

  /** @type {import('../../src/types/agent3LockedOutput.ts').Agent3LockedOutputDisplayPayload} */
  const display_payload = {
    product_name: lockedPayload.locked_product_name ?? null,
    brand: lockedPayload.locked_brand ?? null,
    transparency_badge: badge ?? null,
    badge_basis: lockedPayload.locked_badge_basis ?? null,
    layer_4a_total: scoreResult.layer_4a_total_applied,
    cap_triggered: Boolean(scoreResult.cap_triggered),
    primary_materials: primaryMaterials,
    source_summary: lockedPayload.locked_source_summary ?? null,
    locked_input_warning:
      'Locked-input Agent 3 path is parallel/opt-in. Publishing is not enabled from this output yet.',
    why_this_score_draft: whyDraft || null,
  }

  return { score_payload, math_breakdown, display_payload }
}
