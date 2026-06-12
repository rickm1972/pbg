/**
 * Phase 8 — persist locked_snapshot_drafts via Postgres (Node/scripts/tests).
 */
import { connectPgClient } from '../lib/pg-connect.mjs'
import { loadEnv } from '../lib/env.mjs'

/**
 * @param {object} params
 * @param {import('pg').PoolClient} [client]
 */
export async function persistLockedSnapshotDraftPg(params, client = null) {
  const ownClient = client ? null : await connectPgClient(loadEnv())
  const db = client ?? ownClient
  const ts = new Date().toISOString()

  try {
    const prior = await db.query(
      `select locked_snapshot_draft_id
       from public.locked_snapshot_drafts
       where locked_audit_id = $1 and draft_status <> 'superseded'
       order by created_at desc
       limit 1`,
      [params.locked_audit_id],
    )

    const insert = await db.query(
      `insert into public.locked_snapshot_drafts (
        product_id, locked_input_id, locked_output_id, locked_audit_id, lock_hash, input_source,
        methodology_version, material_lookup_version,
        snapshot_payload, display_payload, score_payload, math_breakdown, audit_summary,
        draft_status, created_by_system, created_at, updated_at, supersedes_draft_id
      ) values ($1,$2,$3,$4,$5,'agent4_locked_audit',$6,$7,$8::jsonb,$9::jsonb,$10::jsonb,$11::jsonb,$12::jsonb,$13,$14,$15,$15,$16)
      returning *`,
      [
        params.product_id,
        params.locked_input_id,
        params.locked_output_id,
        params.locked_audit_id,
        params.lock_hash,
        params.methodology_version,
        params.material_lookup_version,
        JSON.stringify(params.snapshot_payload),
        JSON.stringify(params.display_payload),
        JSON.stringify(params.score_payload),
        JSON.stringify(params.math_breakdown),
        JSON.stringify(params.audit_summary),
        params.draft_status ?? 'draft',
        params.created_by_system ?? 'system:locked-snapshot-draft',
        ts,
        prior.rows[0]?.locked_snapshot_draft_id ?? null,
      ],
    )

    const row = insert.rows[0]
    await db.query(
      `update public.locked_snapshot_drafts
       set draft_status = 'superseded', superseded_by_draft_id = $1, updated_at = $2
       where locked_audit_id = $3
         and locked_snapshot_draft_id <> $1
         and draft_status <> 'superseded'`,
      [row.locked_snapshot_draft_id, ts, params.locked_audit_id],
    )

    return row
  } finally {
    if (ownClient) await ownClient.end()
  }
}
