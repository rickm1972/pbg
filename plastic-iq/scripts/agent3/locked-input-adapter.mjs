/**
 * Phase 6 — adapt Agent 1 locked_payload to Agent 3 algorithm input shape (no mutation, no re-lookup).
 */
import {
  METHODOLOGY_VERSION,
  MATERIAL_LOOKUP_VERSION,
} from '../agent2/deterministic/material-lookup-versions.mjs'

export { METHODOLOGY_VERSION, MATERIAL_LOOKUP_VERSION }

export class LockedInputAdapterError extends Error {
  constructor(message, code = 'LOCKED_INPUT_ADAPTER_ERROR') {
    super(message)
    this.name = 'LockedInputAdapterError'
    this.code = code
  }
}

/**
 * Validate locked package before scoring. Does not repair malformed input.
 * @param {import('../../src/types/lockedInput.ts').LockedInputPayload} lockedPayload
 */
export function validateLockedPayloadForScoring(lockedPayload) {
  const blockers = []
  if (!lockedPayload || typeof lockedPayload !== 'object') {
    throw new LockedInputAdapterError('locked_payload is required', 'MISSING_PAYLOAD')
  }
  if (lockedPayload.methodology_version !== METHODOLOGY_VERSION) {
    blockers.push(
      `methodology_version must be ${METHODOLOGY_VERSION} (got ${lockedPayload.methodology_version ?? 'missing'})`,
    )
  }
  if (lockedPayload.material_lookup_version !== MATERIAL_LOOKUP_VERSION) {
    blockers.push(
      `material_lookup_version must be ${MATERIAL_LOOKUP_VERSION} (got ${lockedPayload.material_lookup_version ?? 'missing'})`,
    )
  }
  const scoreDriving = (lockedPayload.locked_components ?? []).filter(
    (c) => c.locked_is_score_driving,
  )
  if (!scoreDriving.length) {
    blockers.push('no score-driving locked_components')
  }
  for (const comp of scoreDriving) {
    const prefix = comp.locked_component_id ?? comp.locked_component_role
    if (!comp.locked_canonical_material_id?.trim()) {
      blockers.push(`${prefix}: missing locked_canonical_material_id`)
    }
    if (comp.locked_material_hazard_value == null) {
      blockers.push(`${prefix}: missing locked_material_hazard_value`)
    }
    if (comp.locked_adjusted_migration_value == null) {
      blockers.push(`${prefix}: missing locked_adjusted_migration_value`)
    }
    if (comp.locked_contact_intimacy == null) {
      blockers.push(`${prefix}: missing locked_contact_intimacy`)
    }
    if (comp.locked_exposure_severity == null) {
      blockers.push(`${prefix}: missing locked_exposure_severity`)
    }
    if (comp.locked_exposure_duration == null) {
      blockers.push(`${prefix}: missing locked_exposure_duration`)
    }
  }
  if (lockedPayload.locked_layer_4a_total == null) {
    blockers.push('locked_layer_4a_total is required')
  }
  if (typeof lockedPayload.locked_cap_triggered !== 'boolean') {
    blockers.push('locked_cap_triggered must be boolean')
  }
  if (blockers.length) {
    throw new LockedInputAdapterError(
      `Locked payload not score-ready: ${blockers.join('; ')}`,
      'VALIDATION_FAILED',
    )
  }
}

/**
 * Map locked_payload → algorithm input (pure conversion; no MATERIAL_TAXONOMY lookup).
 * @param {import('../../src/types/lockedInput.ts').LockedInputPayload} lockedPayload
 */
export function adaptLockedPayloadToScoringInputs(lockedPayload) {
  validateLockedPayloadForScoring(lockedPayload)

  const scoreDriving = lockedPayload.locked_components.filter((c) => c.locked_is_score_driving)

  const components = scoreDriving.map((comp) => ({
    component_name: comp.locked_component_name,
    component_role: comp.locked_component_role,
    component_structure: comp.locked_component_structure ?? null,
    contact_pathway: comp.locked_contact_pathway ?? null,
    material_id: comp.locked_canonical_material_id,
    material: comp.locked_canonical_material_name ?? comp.locked_canonical_material_id,
    material_hazard: comp.locked_material_hazard_value,
    base_migration_potential: comp.locked_base_migration_value,
    adjusted_migration_potential: comp.locked_adjusted_migration_value,
    contact_intimacy: comp.locked_contact_intimacy,
    exposure_severity: comp.locked_exposure_severity,
    exposure_duration: comp.locked_exposure_duration,
    locked_escalator_multiplier: comp.locked_escalator_multiplier ?? 1,
    locked_canonical_material_id: comp.locked_canonical_material_id,
    locked_resolved_material_taxonomy_id: comp.locked_resolved_material_taxonomy_id ?? null,
    locked_non_detect_mitigation_applied: Boolean(comp.locked_non_detect_mitigation_applied),
    locked_non_detect_mitigation_factor: comp.locked_non_detect_mitigation_factor ?? null,
    locked_lab_evidence_status: comp.locked_lab_evidence_status ?? null,
    locked_lab_applies_to: comp.locked_lab_applies_to ?? null,
    locked_proprietary_status: comp.locked_proprietary_status ?? null,
    locked_pfas_ptfe_status: comp.locked_pfas_ptfe_status ?? null,
    locked_source_support_ids: comp.locked_source_support_ids ?? [],
  }))

  return {
    input_source: 'locked_input_package',
    product_id: lockedPayload.locked_product_id,
    product_category_default: lockedPayload.locked_subcategory ?? lockedPayload.locked_category,
    locked_category: lockedPayload.locked_category,
    locked_subcategory: lockedPayload.locked_subcategory,
    locked_product_type: lockedPayload.locked_product_type ?? null,
    methodology_version: lockedPayload.methodology_version,
    material_lookup_version: lockedPayload.material_lookup_version,
    is_formulation_product: false,
    components,
    layer_4a: {
      net_adjustment: lockedPayload.locked_layer_4a_total,
      unknown_coating_cap_applies: lockedPayload.locked_cap_triggered,
      locked_layer_4a_flags: lockedPayload.locked_layer_4a_flags ?? null,
      locked_cap_reason: lockedPayload.locked_cap_reason ?? null,
    },
    locked_escalator_multiplier: lockedPayload.locked_escalator_multiplier ?? 1,
    locked_escalator_reason: lockedPayload.locked_escalator_reason ?? null,
    locked_transparency_badge: lockedPayload.locked_transparency_badge,
    locked_badge_basis: lockedPayload.locked_badge_basis ?? null,
    locked_badge_notes: lockedPayload.locked_badge_notes ?? null,
    locked_input_package_id: lockedPayload.locked_input_package_id ?? null,
    evidence_id: lockedPayload.evidence_id ?? null,
    validation_id: lockedPayload.validation_id ?? null,
    proposed_input_id: lockedPayload.proposed_input_id ?? null,
  }
}
