/**
 * Phase 8 — build locked-chain snapshot draft payload (read-only; never publishes).
 */
import { tierForScore } from '../agent3/algorithm.mjs'
import {
  METHODOLOGY_VERSION,
  MATERIAL_LOOKUP_VERSION,
} from '../../src/lib/lockedInput/buildLockedInputPackage.ts'

const PUBLISH_DISABLED_NOTICE =
  'Locked snapshot draft is unpublished. Publishing is not enabled from this draft yet.'

/**
 * @param {object} ctx
 * @param {import('../../src/types/agent4LockedAudit.ts').Agent4LockedAuditRow} ctx.audit
 * @param {import('../../src/types/agent3LockedOutput.ts').Agent3LockedOutputRow} ctx.lockedOutput
 * @param {import('../../src/types/lockedInput.ts').LockedInputPayload | Record<string, unknown>} ctx.lockedInput
 * @param {Record<string, unknown> | null} [ctx.productMeta]
 */
export function validateLockedSnapshotDraftGates(ctx) {
  /** @type {Array<{ code: string; message: string }>} */
  const blockers = []
  const { audit, lockedOutput, lockedInput } = ctx

  if (!audit) blockers.push({ code: 'audit.missing', message: 'agent4_locked_audits row required' })
  if (!lockedOutput) blockers.push({ code: 'output.missing', message: 'agent3_locked_outputs row required' })
  if (!lockedInput) blockers.push({ code: 'input.missing', message: 'agent1_locked_inputs row required' })

  if (audit) {
    if (audit.audit_status !== 'passed') {
      blockers.push({
        code: 'audit.status',
        message: `audit_status must be passed (got ${audit.audit_status})`,
      })
    }
    if ((audit.blockers ?? []).length > 0) {
      blockers.push({
        code: 'audit.blockers',
        message: `audit has ${audit.blockers.length} blocker(s)`,
      })
    }
    if (audit.input_source !== 'agent3_locked_output') {
      blockers.push({
        code: 'audit.input_source',
        message: `audit input_source must be agent3_locked_output`,
      })
    }
  }

  if (lockedOutput) {
    if (lockedOutput.input_source !== 'locked_input_package') {
      blockers.push({
        code: 'output.input_source',
        message: 'agent3_locked_outputs.input_source must be locked_input_package',
      })
    }
  }

  if (audit && lockedOutput) {
    if (audit.lock_hash !== lockedOutput.lock_hash) {
      blockers.push({ code: 'lock_hash.mismatch', message: 'lock_hash mismatch across audit and output' })
    }
    if (audit.methodology_version !== lockedOutput.methodology_version) {
      blockers.push({ code: 'methodology_version.mismatch', message: 'methodology_version mismatch' })
    }
    if (audit.material_lookup_version !== lockedOutput.material_lookup_version) {
      blockers.push({ code: 'material_lookup_version.mismatch', message: 'material_lookup_version mismatch' })
    }
    if (audit.locked_output_id !== lockedOutput.locked_output_id) {
      blockers.push({ code: 'locked_output_id.mismatch', message: 'locked_output_id mismatch' })
    }
  }

  if (lockedInput && lockedOutput) {
    const liHash = lockedInput.lock_hash ?? lockedInput.locked_lock_hash
    if (liHash && lockedOutput.lock_hash !== liHash) {
      blockers.push({ code: 'lock_hash.input_mismatch', message: 'lock_hash mismatch with locked input' })
    }
    if (lockedInput.methodology_version && lockedOutput.methodology_version !== lockedInput.methodology_version) {
      blockers.push({ code: 'methodology_version.input_mismatch', message: 'methodology_version mismatch with locked input' })
    }
  }

  if (lockedOutput) {
    if (lockedOutput.methodology_version !== METHODOLOGY_VERSION) {
      blockers.push({
        code: 'methodology_version.expected',
        message: `expected ${METHODOLOGY_VERSION}`,
      })
    }
    if (lockedOutput.material_lookup_version !== MATERIAL_LOOKUP_VERSION) {
      blockers.push({
        code: 'material_lookup_version.expected',
        message: `expected ${MATERIAL_LOOKUP_VERSION}`,
      })
    }
  }

  return { ok: blockers.length === 0, blockers }
}

/**
 * @param {object} ctx
 */
export function buildLockedSnapshotDraftPayload(ctx) {
  const gates = validateLockedSnapshotDraftGates(ctx)
  if (!gates.ok) {
    return { ok: false, blockers: gates.blockers, payloads: null }
  }

  const { audit, lockedOutput, lockedInput, productMeta = null } = ctx
  const score = lockedOutput.score_payload
  const math = lockedOutput.math_breakdown
  const display = lockedOutput.display_payload ?? {}
  const tier = score.tier

  const components = (math.components ?? []).map((c) => ({
    component_name: c.component_name,
    component_role: c.component_role,
    score_driving: c.score_driving !== false,
    locked_canonical_material_id: c.locked_canonical_material_id,
    locked_resolved_material_taxonomy_id: c.locked_resolved_material_taxonomy_id ?? null,
    contact_intimacy: c.contact_intimacy,
    hazard_used: c.hazard_used,
    adjusted_migration_used: c.adjusted_migration_used,
    non_detect_mitigation_applied: Boolean(c.non_detect_mitigation_applied),
    mitigation_factor: c.mitigation_factor ?? null,
    npr_after_escalator: c.npr_after_escalator,
  }))

  const supportComponents = (lockedInput.locked_components ?? [])
    .filter((c) => !c.locked_is_score_driving)
    .map((c) => ({
      component_name: c.locked_component_name,
      component_role: c.locked_component_role,
      score_driving: false,
      locked_canonical_material_id: c.locked_canonical_material_id,
      context_note: c.locked_context_note ?? null,
    }))

  /** @type {import('../../src/types/lockedSnapshotDraft.ts').LockedSnapshotDraftPayload} */
  const snapshot_payload = {
    input_source: 'agent4_locked_audit',
    source_chain: 'locked_pipeline_draft',
    publish_enabled: false,
    public_visible: false,
    product_id: lockedOutput.product_id,
    product_name:
      productMeta?.product_name ??
      display.product_name ??
      lockedInput.locked_product_name ??
      null,
    brand: productMeta?.brand ?? display.brand ?? lockedInput.locked_brand ?? null,
    category: productMeta?.category ?? null,
    subcategory: productMeta?.subcategory ?? null,
    image_url: productMeta?.image_url ?? null,
    source_url: lockedInput.locked_source_summary ?? display.source_summary ?? null,
    lock_hash: lockedOutput.lock_hash,
    locked_input_id: lockedOutput.locked_input_id,
    locked_output_id: lockedOutput.locked_output_id,
    locked_audit_id: audit.locked_audit_id,
    methodology_version: lockedOutput.methodology_version,
    material_lookup_version: lockedOutput.material_lookup_version,
    pac_safety_score: score.pac_safety_score,
    tier,
    transparency_badge: score.transparency_badge ?? null,
    tier_color_key: tierForScore(score.pac_safety_score),
    why_this_score_draft: display.why_this_score_draft ?? null,
    badge_basis: display.badge_basis ?? lockedInput.locked_badge_basis ?? null,
    source_summary: display.source_summary ?? lockedInput.locked_source_summary ?? null,
    documentation_gaps:
      score.transparency_badge === 'Documentation Incomplete'
        ? 'Documentation gaps noted in locked transparency badge.'
        : null,
    known_limitations: display.locked_input_warning ?? null,
    publish_disabled_notice: PUBLISH_DISABLED_NOTICE,
  }

  const display_payload = {
    ...display,
    components,
    support_components: supportComponents,
    publish_enabled: false,
    public_visible: false,
    source_chain: 'locked_pipeline_draft',
  }

  const audit_summary = {
    audit_status: audit.audit_status,
    blocker_count: audit.blockers?.length ?? 0,
    warning_count: audit.warnings?.length ?? 0,
    blockers: audit.blockers ?? [],
    warnings: audit.warnings ?? [],
    checks_passed: audit.audit_payload?.checks_passed ?? 0,
    checks_failed: audit.audit_payload?.checks_failed ?? 0,
    weighted_npr: score.weighted_npr,
    raw_score_before_layer_4a: score.raw_score_before_layer_4a,
    layer_4a_total_applied: score.layer_4a_total_applied,
    cap_triggered: score.cap_triggered,
    final_score: score.final_score,
  }

  const math_trace = {
    ...math,
    component_nprs: components,
  }

  return {
    ok: true,
    blockers: [],
    payloads: {
      product_id: lockedOutput.product_id,
      locked_input_id: lockedOutput.locked_input_id,
      locked_output_id: lockedOutput.locked_output_id,
      locked_audit_id: audit.locked_audit_id,
      lock_hash: lockedOutput.lock_hash,
      input_source: 'agent4_locked_audit',
      methodology_version: lockedOutput.methodology_version,
      material_lookup_version: lockedOutput.material_lookup_version,
      snapshot_payload,
      display_payload,
      score_payload: score,
      math_breakdown: math_trace,
      audit_summary,
    },
  }
}
