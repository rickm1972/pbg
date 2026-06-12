/**
 * Phase 7 — opt-in Agent 4 audit for agent3_locked_outputs (parallel to scripts/agent4/runner.mjs).
 * Default: dry-run only; does not write product_qa or mutate locked outputs.
 */
import { buildAgent4LockedAudit } from './build-locked-audit.mjs'

/**
 * Audit an in-memory Agent 3 locked-output row (fixtures/tests). Never mutates locked output.
 * @param {object} params
 * @param {import('../../src/types/agent3LockedOutput.ts').Agent3LockedOutputRow} params.lockedOutput
 * @param {import('../../src/types/lockedInput.ts').LockedInputPayload} [params.lockedPayload]
 * @param {string} [params.lockHashFromInput]
 * @param {boolean} [params.persist=false]
 */
export function runAgent4LockedAuditFromOutput({
  lockedOutput,
  lockedPayload = null,
  lockHashFromInput = null,
  persist = false,
}) {
  const audit = buildAgent4LockedAudit(lockedOutput, { lockedPayload, lockHashFromInput })

  return {
    ok: audit.audit_status === 'passed',
    dry_run: !persist,
    persist_requested: persist,
    input_source: 'agent3_locked_output',
    audited_agent3_input_source: lockedOutput.input_source,
    locked_output_id: lockedOutput.locked_output_id,
    audit,
    wrote_product_qa: false,
    wrote_product_scores: false,
    wrote_scoring_inputs: false,
    wrote_agent4_locked_audits: false,
    wrote_snapshots: false,
    updated_products: false,
    locked_audit_id: null,
  }
}

/**
 * Score locked output and optionally persist audit to agent4_locked_audits (explicit opt-in).
 * @param {object} params
 * @param {import('../../src/types/agent3LockedOutput.ts').Agent3LockedOutputRow} params.lockedOutput
 * @param {import('../../src/types/lockedInput.ts').LockedInputPayload} [params.lockedPayload]
 * @param {string} [params.lockHashFromInput]
 * @param {boolean} [params.persist=false]
 */
export async function runAgent4LockedAuditForOutput({
  lockedOutput,
  lockedPayload = null,
  lockHashFromInput = null,
  persist = false,
}) {
  const run = runAgent4LockedAuditFromOutput({
    lockedOutput,
    lockedPayload,
    lockHashFromInput,
    persist: false,
  })

  if (!persist) {
    return run
  }

  const { audit } = run

  try {
    const { persistAgent4LockedAuditPg } = await import('./agent4-locked-audit-pg.mjs')
    const row = await persistAgent4LockedAuditPg({
      product_id: audit.product_id,
      locked_output_id: audit.locked_output_id,
      locked_input_id: audit.locked_input_id,
      lock_hash: audit.lock_hash,
      methodology_version: audit.methodology_version,
      material_lookup_version: audit.material_lookup_version,
      audit_status: audit.audit_status,
      audit_payload: audit.audit_payload,
      blockers: audit.blockers,
      warnings: audit.warnings,
      consistency_checks: audit.consistency_checks,
    })

    return {
      ...run,
      dry_run: false,
      wrote_agent4_locked_audits: true,
      locked_audit_id: row.locked_audit_id,
      locked_audit: row,
    }
  } catch (pgErr) {
    try {
      const { createAgent4LockedAudit, getLatestAgent4LockedAuditForOutput, supersedeAgent4LockedAudit } =
        await import('../../src/lib/agent4LockedAudit/agent4LockedAuditStore.ts')

      const prior = await getLatestAgent4LockedAuditForOutput(audit.locked_output_id)
      const row = await createAgent4LockedAudit({
        product_id: audit.product_id,
        locked_output_id: audit.locked_output_id,
        locked_input_id: audit.locked_input_id,
        lock_hash: audit.lock_hash,
        methodology_version: audit.methodology_version,
        material_lookup_version: audit.material_lookup_version,
        audit_status: audit.audit_status,
        audit_payload: audit.audit_payload,
        blockers: audit.blockers,
        warnings: audit.warnings,
        consistency_checks: audit.consistency_checks,
        supersedes_audit_id: prior?.locked_audit_id ?? null,
      })

      if (prior && prior.audit_status !== 'superseded') {
        await supersedeAgent4LockedAudit({
          locked_audit_id: prior.locked_audit_id,
          superseded_by_audit_id: row.locked_audit_id,
        })
      }

      return {
        ...run,
        dry_run: false,
        wrote_agent4_locked_audits: true,
        locked_audit_id: row.locked_audit_id,
        locked_audit: row,
      }
    } catch (storeErr) {
      return {
        ...run,
        ok: false,
        persist_error: `PG: ${pgErr instanceof Error ? pgErr.message : pgErr}; Supabase: ${storeErr instanceof Error ? storeErr.message : storeErr}`,
      }
    }
  }
}

/**
 * Build a minimal Agent3LockedOutputRow shape from dry-run Agent 3 output (fixtures).
 */
export function lockedOutputRowFromAgent3Run(agent3Run, overrides = {}) {
  const payloads = agent3Run.output_payloads
  return {
    locked_output_id: overrides.locked_output_id ?? '00000000-0000-4000-8000-000000000101',
    product_id: overrides.product_id ?? agent3Run.result?.product_id ?? '00000000-0000-4000-8000-000000000001',
    locked_input_id: overrides.locked_input_id ?? agent3Run.locked_input_id ?? '00000000-0000-4000-8000-000000000201',
    lock_hash: overrides.lock_hash ?? agent3Run.lock_hash ?? 'fixture-lock-hash',
    input_source: 'locked_input_package',
    methodology_version: overrides.methodology_version ?? 'v2.3.5',
    material_lookup_version: overrides.material_lookup_version ?? 'code_material_taxonomy_current',
    score_payload: payloads.score_payload,
    math_breakdown: payloads.math_breakdown,
    display_payload: payloads.display_payload,
    review_status: overrides.review_status ?? 'pending_review',
    created_by_system: 'system:agent3-locked-input',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    reviewed_at: null,
    reviewed_by: null,
    review_notes: null,
    supersedes_output_id: null,
    superseded_by_output_id: null,
  }
}
