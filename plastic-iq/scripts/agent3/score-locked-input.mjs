/**
 * Phase 6 — score from adapted locked input (no prepareAgent3ScoringInputs, no re-mitigation).
 */
import {
  scorePacCore,
  tierForScore,
  formatCalculationTrace,
} from './algorithm.mjs'
import {
  METHODOLOGY_VERSION,
  MATERIAL_LOOKUP_VERSION,
} from './locked-input-adapter.mjs'

export const LOCKED_SCORING_METHODOLOGY_VERSION = METHODOLOGY_VERSION
export const LOCKED_SCORING_MATERIAL_LOOKUP_VERSION = MATERIAL_LOOKUP_VERSION

const HARD_CAP_UNKNOWN_COATING = 72
const SCORE_MAX = 99

function round4(n) {
  return Math.round(n * 10000) / 10000
}

/**
 * Score adapted locked inputs using core PAC math only.
 * @param {object} adaptedInputs — from adaptLockedPayloadToScoringInputs
 * @param {object} [meta]
 */
export function scoreLockedInputPackage(adaptedInputs, meta = {}) {
  const core = scorePacCore(adaptedInputs, null, { lockedInputMode: true, evidence: null })

  const capTriggered = Boolean(adaptedInputs.layer_4a?.unknown_coating_cap_applies)
  let scoreAfterCap = core.score_after_4a
  let capValue = null
  if (capTriggered) {
    capValue = HARD_CAP_UNKNOWN_COATING
    scoreAfterCap = Math.min(scoreAfterCap, HARD_CAP_UNKNOWN_COATING)
  }

  const finalScore = Math.min(SCORE_MAX, Math.max(0, Math.round(scoreAfterCap)))
  const tier = tierForScore(finalScore)
  const transparencyBadge =
    adaptedInputs.locked_transparency_badge ??
    meta.lockedPayload?.locked_transparency_badge ??
    null

  const componentBreakdown = buildLockedInputComponentBreakdown(adaptedInputs, core)

  return {
    input_source: 'locked_input_package',
    locked_input_id: meta.lockedInputId ?? adaptedInputs.locked_input_package_id ?? null,
    lock_hash: meta.lockHash ?? null,
    methodology_version: adaptedInputs.methodology_version ?? METHODOLOGY_VERSION,
    material_lookup_version: adaptedInputs.material_lookup_version ?? MATERIAL_LOOKUP_VERSION,
    algorithm_version: METHODOLOGY_VERSION,
    pac_safety_score: finalScore,
    tier,
    transparency_badge: transparencyBadge,
    weighted_npr: round4(core.weighted_npr),
    raw_score_before_layer_4a: round4(core.raw_score),
    raw_score_formula: `100 - sqrt(weighted_npr) * 5 = 100 - sqrt(${round4(core.weighted_npr)}) * 5`,
    layer_4a_total_applied: core.layer_4a_net,
    score_after_layer_4a: round4(core.score_after_4a),
    cap_triggered: capTriggered,
    cap_value: capValue,
    score_after_cap: round4(scoreAfterCap),
    final_score: finalScore,
    escalator_applied: [
      ...new Set(
        core.component_results.map((c) => c.escalator_applied).filter(Boolean),
      ),
    ].join(', ') || null,
    component_math_breakdown: componentBreakdown,
    weighted_npr_breakdown: buildWeightedNprBreakdown(componentBreakdown),
    calculation: core,
    component_nprs: {
      components: core.component_results,
      weighted_npr: round4(core.weighted_npr),
    },
    warnings: meta.warnings ?? [],
    dry_run: meta.dryRun !== false,
  }
}

function buildLockedInputComponentBreakdown(adaptedInputs, core) {
  const byName = new Map(core.component_results.map((r) => [r.component_name, r]))
  return (adaptedInputs.components ?? []).map((comp) => {
    const result = byName.get(comp.component_name) ?? {}
    const weight = comp.contact_intimacy
    return {
      component_name: comp.component_name,
      component_role: comp.component_role,
      locked_canonical_material_id: comp.locked_canonical_material_id,
      locked_resolved_material_taxonomy_id: comp.locked_resolved_material_taxonomy_id,
      hazard_used: comp.material_hazard,
      base_migration: comp.base_migration_potential,
      adjusted_migration_used: comp.adjusted_migration_potential,
      contact_intimacy: comp.contact_intimacy,
      exposure_severity: comp.exposure_severity,
      exposure_duration: comp.exposure_duration,
      non_detect_mitigation_applied: comp.locked_non_detect_mitigation_applied,
      mitigation_factor: comp.locked_non_detect_mitigation_factor,
      component_weight: weight,
      inert_protection_applied: result.inert_protection_applied ?? false,
      npr_before_escalator: round4(result.npr_after_category ?? result.base_npr ?? 0),
      escalator_multiplier: result.escalator_multiplier ?? 1,
      escalator_applied: result.escalator_applied ?? null,
      npr_after_escalator: round4(result.final_npr ?? 0),
    }
  })
}

function buildWeightedNprBreakdown(componentBreakdown) {
  const sumCi = componentBreakdown.reduce((acc, c) => acc + c.component_weight, 0)
  if (sumCi <= 0) return { method: 'contact_intimacy_weighted', sum_ci: 0, weighted_npr: 0, rows: [] }
  const rows = componentBreakdown.map((c) => ({
    component_name: c.component_name,
    npr_after_escalator: c.npr_after_escalator,
    contact_intimacy: c.component_weight,
    weighted_contribution: round4((c.npr_after_escalator * c.component_weight) / sumCi),
  }))
  const weightedNpr = rows.reduce((acc, r) => acc + r.weighted_contribution, 0)
  return {
    method: 'sum(npr_after_escalator × contact_intimacy) / sum(contact_intimacy)',
    sum_ci: round4(sumCi),
    weighted_npr: round4(weightedNpr),
    rows,
  }
}

/** Plain-text math breakdown tables for Phase 6 reporting. */
export function formatLockedInputMathBreakdownTables(result) {
  const lines = []
  const productLabel = result.product_label ?? 'Locked fixture'
  lines.push(`## ${productLabel} locked-input math breakdown`)
  lines.push('')
  lines.push('| Component | Canonical ID | Resolved taxonomy | Hazard | Base mig | Adj mig used | CI | Severity | Duration | ND mit? | Factor | NPR pre-esc | Esc mult | NPR post-esc |')
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |')
  for (const c of result.component_math_breakdown ?? []) {
    lines.push(
      `| ${c.component_name} | ${c.locked_canonical_material_id} | ${c.locked_resolved_material_taxonomy_id ?? '—'} | ${c.hazard_used} | ${c.base_migration} | ${c.adjusted_migration_used} | ${c.contact_intimacy} | ${c.exposure_severity} | ${c.exposure_duration} | ${c.non_detect_mitigation_applied ? 'yes' : 'no'} | ${c.mitigation_factor ?? '—'} | ${c.npr_before_escalator} | ${c.escalator_multiplier} | ${c.npr_after_escalator} |`,
    )
  }
  lines.push('')
  lines.push('### Product-level weighted math')
  lines.push(`| Field | Value |`)
  lines.push(`| --- | --- |`)
  lines.push(`| Weighting method | ${result.weighted_npr_breakdown?.method ?? '—'} |`)
  lines.push(`| Sum contact intimacy | ${result.weighted_npr_breakdown?.sum_ci ?? '—'} |`)
  lines.push(`| Weighted NPR | ${result.weighted_npr} |`)
  lines.push(`| Raw score before Layer 4A | ${result.raw_score_before_layer_4a} |`)
  lines.push(`| Raw score formula | ${result.raw_score_formula} |`)
  lines.push(`| Layer 4A total applied | ${result.layer_4a_total_applied} |`)
  lines.push(`| Score after Layer 4A | ${result.score_after_layer_4a} |`)
  lines.push(`| Cap triggered? | ${result.cap_triggered ? 'yes' : 'no'} |`)
  lines.push(`| Cap value | ${result.cap_value ?? '—'} |`)
  lines.push(`| Score after cap | ${result.score_after_cap} |`)
  lines.push(`| Final rounded score | ${result.final_score} |`)
  lines.push(`| Tier | ${result.tier} |`)
  lines.push(`| Transparency badge | ${result.transparency_badge ?? '—'} |`)
  lines.push('')
  return lines.join('\n')
}

export { formatCalculationTrace }
