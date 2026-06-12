/**
 * Phase 5 — build immutable Agent 1 locked input package from reviewed + validated inputs.
 */
import type {
  Agent1ProposedInput,
  Agent1SystemValidation,
  LockedComponentInput,
  LockedInputPayload,
  ReviewedComponentInput,
  ReviewedInputPayload,
} from '../../types/lockedInput'
import { LOCKED_PAYLOAD_SCHEMA_VERSION } from '../../types/lockedInput'
import {
  METHODOLOGY_VERSION,
  MATERIAL_LOOKUP_VERSION,
} from './buildSystemValidation'
import { assertReviewedPayloadHasNoLockedFields } from './reviewPayloadValidation'
import { assertValidationPayloadHasNoLockedFields } from './validationPayloadValidation'

export { METHODOLOGY_VERSION, MATERIAL_LOOKUP_VERSION }

export class LockEligibilityError extends Error {
  blockers: string[]

  constructor(message: string, blockers: string[]) {
    super(message)
    this.name = 'LockEligibilityError'
    this.blockers = blockers
  }
}

function canonicalIdForComponent(component: ReviewedComponentInput): string | null {
  return (
    component.confirmed_canonical_material_id ??
    component.reviewed_canonical_material_id ??
    null
  )
}

function collectSourceIds(reviewed: ReviewedInputPayload): string[] {
  const ids = new Set<string>()
  for (const id of reviewed.reviewed_lab_source_ids ?? []) ids.add(String(id))
  for (const id of reviewed.reviewed_layer_4a_source_ids ?? []) ids.add(String(id))
  for (const id of reviewed.reviewed_badge_source_ids ?? []) ids.add(String(id))
  for (const id of reviewed.reviewed_cap_escalator_source_ids ?? []) ids.add(String(id))
  for (const id of reviewed.reviewed_use_condition_source_ids ?? []) ids.add(String(id))
  for (const comp of reviewed.reviewed_components ?? []) {
    for (const ref of comp.evidence_support_refs ?? []) {
      if (ref.source_url) ids.add(ref.source_url)
      if (ref.field_path) ids.add(ref.field_path)
    }
  }
  return [...ids]
}

function assertNoForbiddenScoreFields(payload: LockedInputPayload): void {
  const walk = (value: unknown, path = '') => {
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) walk(value[i], `${path}[${i}]`)
      return
    }
    if (value && typeof value === 'object') {
      for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        if (key === 'proposed_canonical_material_id' || key === 'confirmed_canonical_material_id') {
          throw new LockEligibilityError(
            `locked_payload must not contain ${key} at ${path}.${key}`,
            ['FORBIDDEN_REVIEW_FIELD_IN_LOCKED_PAYLOAD'],
          )
        }
        walk(child, path ? `${path}.${key}` : key)
      }
    }
  }
  walk(payload)
}

export function checkLockEligibility(params: {
  proposed: Agent1ProposedInput
  validation: Agent1SystemValidation
}): { eligible: boolean; blockers: string[] } {
  try {
    buildLockedInputPackage({
      proposed: params.proposed,
      validation: params.validation,
      dryRun: true,
    })
    return { eligible: true, blockers: [] }
  } catch (err) {
    if (err instanceof LockEligibilityError) {
      return { eligible: false, blockers: err.blockers }
    }
    throw err
  }
}

export type BuildLockedInputPackageParams = {
  proposed: Agent1ProposedInput
  validation: Agent1SystemValidation
  locked_by?: string | null
  locked_at?: string
  /** Internal — eligibility check only, skips forbidden-field assert on partial build */
  dryRun?: boolean
}

export function buildLockedInputPackage(params: BuildLockedInputPackageParams): LockedInputPayload {
  const { proposed, validation } = params
  const blockers: string[] = []
  const reviewed = proposed.reviewed_payload
  const vp = validation.validation_payload

  if (!reviewed) blockers.push('reviewed_payload is missing on agent1_proposed_inputs')
  if (!vp) blockers.push('validation_payload is missing on agent1_system_validations')
  if (validation.validation_status !== 'passed') {
    blockers.push(`validation_status must be passed (got ${validation.validation_status})`)
  }
  if ((validation.blockers ?? []).length > 0) {
    blockers.push(`validation blockers present (${validation.blockers.length})`)
  }

  if (reviewed) {
    try {
      assertReviewedPayloadHasNoLockedFields(reviewed)
    } catch {
      blockers.push('reviewed_payload contains locked_* keys')
    }
  }
  if (vp) {
    try {
      assertValidationPayloadHasNoLockedFields(vp)
    } catch {
      blockers.push('validation_payload contains locked_* keys')
    }
  }

  if (vp?.methodology_version !== METHODOLOGY_VERSION) {
    blockers.push(
      `methodology_version must be ${METHODOLOGY_VERSION} (got ${vp?.methodology_version ?? 'missing'})`,
    )
  }
  if (vp?.material_lookup_version !== MATERIAL_LOOKUP_VERSION) {
    blockers.push(
      `material_lookup_version must be ${MATERIAL_LOOKUP_VERSION} (got ${vp?.material_lookup_version ?? 'missing'})`,
    )
  }
  if ((vp?.unresolved_canonical_material_ids ?? []).length > 0) {
    blockers.push(
      `unresolved canonical IDs remain: ${vp!.unresolved_canonical_material_ids!.join(', ')}`,
    )
  }
  if (vp?.layer_4a_validation_status === 'failed') {
    blockers.push('Layer 4A validation failed')
  }
  if (vp?.cap_validation && (vp.cap_validation as { cap_validation_status?: string }).cap_validation_status === 'failed') {
    blockers.push('cap validation failed')
  }
  if (vp?.escalator_validation_passed === false) {
    blockers.push('escalator validation failed')
  }
  if (vp?.transparency_badge_validation_passed === false) {
    blockers.push('transparency badge validation failed')
  }

  const scoreDriving = (reviewed?.reviewed_components ?? []).filter(
    (c) => c.reviewed_is_score_driving,
  )
  if (!scoreDriving.length) blockers.push('no score-driving reviewed components')

  for (const comp of scoreDriving) {
    const lookup = vp?.material_lookups?.find(
      (m) => m.reviewed_component_id === comp.reviewed_component_id,
    )
    const use = vp?.use_conditions?.find(
      (u) => u.reviewed_component_id === comp.reviewed_component_id,
    )
    const canonical = canonicalIdForComponent(comp)
    const prefix = comp.reviewed_component_id
    if (!canonical?.trim()) blockers.push(`${prefix}: missing confirmed/reviewed canonical material ID`)
    if (!lookup?.resolved_material_taxonomy_id && !lookup?.confirmed_canonical_material_id) {
      blockers.push(`${prefix}: canonical material not resolved in validation`)
    }
    if (lookup?.material_hazard_value == null) blockers.push(`${prefix}: missing material_hazard_value`)
    if (lookup?.base_migration_value == null) blockers.push(`${prefix}: missing base_migration_value`)
    if (lookup?.adjusted_migration_value == null) blockers.push(`${prefix}: missing adjusted_migration_value`)
    if (use?.final_contact_intimacy == null) blockers.push(`${prefix}: missing final_contact_intimacy`)
    if (use?.final_exposure_severity == null) blockers.push(`${prefix}: missing final_exposure_severity`)
    if (use?.final_exposure_duration == null) blockers.push(`${prefix}: missing final_exposure_duration`)
  }

  if (blockers.length) {
    throw new LockEligibilityError(`Lock eligibility failed: ${blockers.join('; ')}`, blockers)
  }

  const lockedAt = params.locked_at ?? new Date().toISOString()
  const ctx = reviewed!.product_context
  const capVal = vp!.cap_validation as Record<string, unknown> | null | undefined
  const escalator = vp!.escalator_validation_detail as Record<string, unknown> | null | undefined
  const badge = vp!.transparency_badge_validation_detail as Record<string, unknown> | null | undefined

  const lockedComponents: LockedComponentInput[] = scoreDriving.map((comp) => {
    const lookup = vp!.material_lookups!.find(
      (m) => m.reviewed_component_id === comp.reviewed_component_id,
    )!
    const use = vp!.use_conditions!.find(
      (u) => u.reviewed_component_id === comp.reviewed_component_id,
    )!
    const mitigation = vp!.non_detect_mitigation?.find(
      (n) => n.reviewed_component_id === comp.reviewed_component_id,
    )
    const mitigationApplied = mitigation?.non_detect_validation_status === 'applied'
    const compSourceIds = (comp.evidence_support_refs ?? [])
      .map((r) => r.source_url ?? r.field_path)
      .filter(Boolean) as string[]

    return {
      locked_component_id: comp.reviewed_component_id,
      locked_component_name: comp.reviewed_component_name,
      locked_component_role: comp.reviewed_component_role,
      locked_component_structure: comp.reviewed_component_structure ?? null,
      locked_contact_pathway: comp.reviewed_contact_pathway ?? null,
      locked_is_primary_contact: comp.reviewed_is_primary_contact,
      locked_is_score_driving: true,
      locked_canonical_material_id: canonicalIdForComponent(comp)!,
      locked_canonical_material_name: lookup.canonical_material_name ?? null,
      locked_resolved_material_taxonomy_id: lookup.resolved_material_taxonomy_id ?? null,
      locked_material_hazard_value: lookup.material_hazard_value!,
      locked_base_migration_value: lookup.base_migration_value!,
      locked_adjusted_migration_value: lookup.adjusted_migration_value!,
      locked_contact_intimacy: use.final_contact_intimacy!,
      locked_exposure_severity: use.final_exposure_severity!,
      locked_exposure_duration: use.final_exposure_duration!,
      locked_non_detect_mitigation_applied: mitigationApplied,
      locked_non_detect_mitigation_factor: mitigationApplied
        ? (mitigation?.mitigation_factor ?? null)
        : null,
      locked_lab_evidence_status: reviewed!.reviewed_lab_evidence_status ?? null,
      locked_lab_applies_to:
        reviewed!.reviewed_lab_applies_to ?? reviewed!.reviewed_lab_applies_to_scope ?? null,
      locked_proprietary_status: reviewed!.reviewed_proprietary_status ?? null,
      locked_pfas_ptfe_status: reviewed!.reviewed_pfas_ptfe_status ?? null,
      locked_source_support_ids: compSourceIds,
      locked_component_notes: comp.reviewer_notes ?? null,
      locked_escalator_multiplier:
        comp.reviewed_component_role === 'primary_food_contact'
          ? ((escalator?.escalator_multiplier as number | undefined) ?? 1)
          : 1,
    }
  })

  const anyMitigation = lockedComponents.some((c) => c.locked_non_detect_mitigation_applied)
  const sourceIds = collectSourceIds(reviewed!)

  const payload: LockedInputPayload = {
    schema_version: LOCKED_PAYLOAD_SCHEMA_VERSION,
    product_id: proposed.product_id,
    proposed_input_id: proposed.proposed_input_id,
    validation_id: validation.validation_id,
    evidence_id: proposed.evidence_id,
    methodology_version: METHODOLOGY_VERSION,
    material_lookup_version: MATERIAL_LOOKUP_VERSION,
    locked_at: lockedAt,
    locked_by: params.locked_by ?? null,
    source_reviewed_at: reviewed!.reviewed_at ?? proposed.reviewed_at ?? null,
    source_validated_at: vp!.validated_at ?? validation.validated_at ?? null,
    lock_summary: `Locked ${lockedComponents.length} score-driving component(s) for Agent 3 (not wired yet)`,
    locked_product_id: proposed.product_id,
    locked_brand: ctx?.brand ?? null,
    locked_product_name: ctx?.product_name ?? null,
    locked_category: String(ctx?.category ?? 'Kitchen'),
    locked_subcategory: String(ctx?.subcategory ?? 'Cookware'),
    locked_product_type: ctx?.product_type ?? null,
    locked_variant_or_sku: ctx?.variant_or_sku ?? null,
    locked_components: lockedComponents,
    locked_layer_4a_flags: vp!.validated_layer_4a_flags ?? vp!.reviewed_layer_4a_flags ?? null,
    locked_layer_4a_total: vp!.layer_4a_total_validated ?? 0,
    locked_cap_triggered: Boolean(
      capVal?.unknown_coating_cap_validation ?? vp!.unknown_coating_cap_validation,
    ),
    locked_cap_reason: (reviewed!.reviewed_cap_reason as string | null) ?? null,
    locked_unknown_coating_cap_validation: Boolean(vp!.unknown_coating_cap_validation),
    locked_known_category_proprietary_validation: Boolean(vp!.known_category_proprietary_validation),
    locked_escalator_candidate: reviewed!.reviewed_escalator_candidate ?? null,
    locked_escalator_multiplier: (escalator?.escalator_multiplier as number | undefined) ?? 1,
    locked_escalator_reason: reviewed!.reviewed_escalator_reason ?? null,
    locked_transparency_badge:
      (badge?.validated_transparency_badge as string | null) ??
      reviewed!.reviewed_transparency_badge ??
      null,
    locked_badge_basis: reviewed!.reviewed_badge_basis ?? null,
    locked_badge_notes: reviewed!.reviewed_badge_notes ?? null,
    locked_lab_evidence_status: reviewed!.reviewed_lab_evidence_status ?? null,
    locked_non_detect_mitigation_applied: anyMitigation,
    locked_source_support_ids: sourceIds,
    locked_evidence_claim_ids: sourceIds,
    locked_source_summary: `Frozen from evidence_id ${proposed.evidence_id}`,
    locked_input_notes: null,
  }

  if (!params.dryRun) {
    assertNoForbiddenScoreFields(payload)
  }

  return payload
}
