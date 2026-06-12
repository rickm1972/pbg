/**
 * Phase 8 — create locked snapshot draft from passed agent4_locked_audits (opt-in persist).
 */
import { buildLockedSnapshotDraftPayload } from './build-locked-snapshot-draft.mjs'

/**
 * @param {object} params
 * @param {import('../../src/types/agent4LockedAudit.ts').Agent4LockedAuditRow} params.audit
 * @param {import('../../src/types/agent3LockedOutput.ts').Agent3LockedOutputRow} params.lockedOutput
 * @param {import('../../src/types/lockedInput.ts').LockedInputPayload | Record<string, unknown>} params.lockedInput
 * @param {Record<string, unknown> | null} [params.productMeta]
 * @param {boolean} [params.persist=false]
 */
export function runLockedSnapshotDraftFromChain(params) {
  const built = buildLockedSnapshotDraftPayload(params)
  return {
    ok: built.ok,
    dry_run: !params.persist,
    persist_requested: Boolean(params.persist),
    blockers: built.blockers,
    payloads: built.payloads,
    wrote_locked_snapshot_drafts: false,
    wrote_published_snapshots: false,
    updated_products: false,
    wrote_product_scores: false,
    wrote_scoring_inputs: false,
    locked_snapshot_draft_id: null,
  }
}

/**
 * @param {object} params
 */
export async function runLockedSnapshotDraftForAudit(params) {
  const run = runLockedSnapshotDraftFromChain({ ...params, persist: false })
  if (!run.ok) return run
  if (!params.persist) return run

  try {
    const { persistLockedSnapshotDraftPg } = await import('./locked-snapshot-draft-pg.mjs')
    const row = await persistLockedSnapshotDraftPg(run.payloads)
    return {
      ...run,
      dry_run: false,
      wrote_locked_snapshot_drafts: true,
      locked_snapshot_draft_id: row.locked_snapshot_draft_id,
      locked_snapshot_draft: row,
    }
  } catch (pgErr) {
    try {
      const { createLockedSnapshotDraft } = await import(
        '../../src/lib/lockedSnapshotDraft/lockedSnapshotDraftStore.ts'
      )
      const row = await createLockedSnapshotDraft({
        ...run.payloads,
        draft_status: 'draft',
      })
      return {
        ...run,
        dry_run: false,
        wrote_locked_snapshot_drafts: true,
        locked_snapshot_draft_id: row.locked_snapshot_draft_id,
        locked_snapshot_draft: row,
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
