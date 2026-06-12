/**
 * Phase 6.7 — persist agent3_locked_outputs via Postgres (Node/scripts/tests).
 * Never writes product_scores or scoring_inputs.
 */
import { connectPgClient } from '../lib/pg-connect.mjs'
import { loadEnv } from '../lib/env.mjs'
import {
  METHODOLOGY_VERSION,
  MATERIAL_LOOKUP_VERSION,
} from './locked-input-adapter.mjs'

/**
 * @param {import('pg').PoolClient} [client] — optional; owns connection when omitted
 */
export async function persistAgent3LockedOutputPg(params, client = null) {
  const ownClient = client ? null : await connectPgClient(loadEnv())
  const db = client ?? ownClient
  const ts = new Date().toISOString()

  try {
    const prior = await db.query(
      `select locked_output_id, review_status
       from public.agent3_locked_outputs
       where locked_input_id = $1 and review_status <> 'superseded'
       order by created_at desc
       limit 1`,
      [params.locked_input_id],
    )

    const insert = await db.query(
      `insert into public.agent3_locked_outputs (
        product_id, locked_input_id, lock_hash, input_source,
        methodology_version, material_lookup_version,
        score_payload, math_breakdown, display_payload,
        review_status, created_by_system, created_at, updated_at,
        supersedes_output_id
      ) values ($1,$2,$3,'locked_input_package',$4,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9,$10,$11,$11,$12)
      returning *`,
      [
        params.product_id,
        params.locked_input_id,
        params.lock_hash,
        METHODOLOGY_VERSION,
        MATERIAL_LOOKUP_VERSION,
        JSON.stringify(params.score_payload),
        JSON.stringify(params.math_breakdown),
        params.display_payload ? JSON.stringify(params.display_payload) : null,
        params.review_status ?? 'pending_review',
        params.created_by_system ?? 'system:agent3-locked-input',
        ts,
        prior.rows[0]?.locked_output_id ?? null,
      ],
    )

    const row = insert.rows[0]

    await db.query(
      `update public.agent3_locked_outputs
       set review_status = 'superseded', superseded_by_output_id = $1, updated_at = $2
       where locked_input_id = $3
         and locked_output_id <> $1
         and review_status <> 'superseded'`,
      [row.locked_output_id, ts, params.locked_input_id],
    )

    return row
  } finally {
    if (ownClient) await ownClient.end()
  }
}
