/**
 * Phase 7 — persist agent4_locked_audits via Postgres (Node/scripts/tests).
 * Never writes product_scores, scoring_inputs, products, or snapshots.
 */
import { connectPgClient } from '../lib/pg-connect.mjs'
import { loadEnv } from '../lib/env.mjs'

/**
 * @param {object} params
 * @param {import('pg').PoolClient} [client]
 */
export async function persistAgent4LockedAuditPg(params, client = null) {
  const ownClient = client ? null : await connectPgClient(loadEnv())
  const db = client ?? ownClient
  const ts = new Date().toISOString()

  try {
    const prior = await db.query(
      `select locked_audit_id, audit_status
       from public.agent4_locked_audits
       where locked_output_id = $1 and audit_status <> 'superseded'
       order by created_at desc
       limit 1`,
      [params.locked_output_id],
    )

    const insert = await db.query(
      `insert into public.agent4_locked_audits (
        product_id, locked_output_id, locked_input_id, lock_hash, input_source,
        methodology_version, material_lookup_version,
        audit_status, audit_payload, blockers, warnings, consistency_checks,
        created_by_system, created_at, updated_at, supersedes_audit_id
      ) values ($1,$2,$3,$4,'agent3_locked_output',$5,$6,$7,$8::jsonb,$9::jsonb,$10::jsonb,$11::jsonb,$12,$13,$13,$14)
      returning *`,
      [
        params.product_id,
        params.locked_output_id,
        params.locked_input_id,
        params.lock_hash,
        params.methodology_version,
        params.material_lookup_version,
        params.audit_status,
        JSON.stringify(params.audit_payload),
        JSON.stringify(params.blockers ?? []),
        JSON.stringify(params.warnings ?? []),
        JSON.stringify(params.consistency_checks ?? []),
        params.created_by_system ?? 'system:agent4-locked-audit',
        ts,
        prior.rows[0]?.locked_audit_id ?? null,
      ],
    )

    const row = insert.rows[0]
    await db.query(
      `update public.agent4_locked_audits
       set audit_status = 'superseded', superseded_by_audit_id = $1, updated_at = $2
       where locked_output_id = $3
         and locked_audit_id <> $1
         and audit_status <> 'superseded'`,
      [row.locked_audit_id, ts, params.locked_output_id],
    )

    return row
  } finally {
    if (ownClient) await ownClient.end()
  }
}
