#!/usr/bin/env node
/**
 * Phase 8 fixture proof — create locked snapshot drafts from passed Lodge/HexClad audits.
 * Pairs active Agent 3 output with matching Agent 4 audit (same locked_output_id).
 * Run: npx tsx scripts/locked-pipeline/run-fixture-locked-snapshot-drafts.mjs [--dry-run]
 */
import { connectPgClient } from '../lib/pg-connect.mjs'
import { loadEnv } from '../lib/env.mjs'
import { CANONICAL_LOCKED_PIPELINE_PRODUCT_IDS } from '../../src/lib/lockedPipeline/displayDedupe.ts'
import { buildAgent4LockedAudit } from '../agent4/build-locked-audit.mjs'
import { persistAgent4LockedAuditPg } from '../agent4/agent4-locked-audit-pg.mjs'
import { runLockedSnapshotDraftForAudit } from './run-locked-snapshot-draft.mjs'

const dryRun = process.argv.includes('--dry-run')

const client = await connectPgClient(loadEnv())
try {
  const outputs = await client.query(
    `select o.*, p.product_name, p.brand
     from public.agent3_locked_outputs o
     join public.products p on p.product_id = o.product_id
     where o.review_status <> 'superseded'
     order by o.created_at desc`,
  )

  const targets = []
  for (const pid of CANONICAL_LOCKED_PIPELINE_PRODUCT_IDS) {
    const row = outputs.rows.find((o) => o.product_id === pid)
    if (row) targets.push(row)
  }
  for (const brand of ['lodge', 'hexclad']) {
    if (targets.some((t) => (t.brand ?? '').toLowerCase() === brand)) continue
    const row = outputs.rows.find((o) => (o.brand ?? '').toLowerCase() === brand)
    if (row) targets.push(row)
  }

  if (!targets.length) {
    console.log('No active Lodge/HexClad locked outputs found.')
    process.exit(0)
  }

  for (const lockedOutput of targets) {
    let auditRes = await client.query(
      `select * from public.agent4_locked_audits
       where locked_output_id = $1 and audit_status = 'passed'
       order by created_at desc limit 1`,
      [lockedOutput.locked_output_id],
    )

    const lockedInputRes = await client.query(
      `select locked_payload from public.agent1_locked_inputs where locked_input_id = $1`,
      [lockedOutput.locked_input_id],
    )
    const productRes = await client.query(
      `select product_id, product_name, brand, category, subcategory from public.products where product_id = $1`,
      [lockedOutput.product_id],
    )

    if (!lockedInputRes.rows[0]) {
      console.log(`Skip ${lockedOutput.brand}: missing locked input`)
      continue
    }

    let audit = auditRes.rows[0]
    if (!audit || audit.lock_hash !== lockedOutput.lock_hash) {
      const built = buildAgent4LockedAudit(lockedOutput, {
        lockedPayload: lockedInputRes.rows[0].locked_payload,
        lockHashFromInput: lockedOutput.lock_hash,
      })
      built.product_id = lockedOutput.product_id
      built.locked_output_id = lockedOutput.locked_output_id
      built.locked_input_id = lockedOutput.locked_input_id
      if (built.audit_status !== 'passed' || built.blockers.length > 0) {
        console.log(JSON.stringify({ brand: lockedOutput.brand, ok: false, blockers: built.blockers }))
        continue
      }
      if (!dryRun) {
        audit = await persistAgent4LockedAuditPg(built, client)
      } else {
        audit = built
      }
    }

    const run = await runLockedSnapshotDraftForAudit({
      audit,
      lockedOutput,
      lockedInput: lockedInputRes.rows[0].locked_payload,
      productMeta: productRes.rows[0] ?? null,
      persist: !dryRun,
    })

    console.log(
      JSON.stringify({
        brand: lockedOutput.brand,
        dry_run: run.dry_run,
        ok: run.ok,
        draft_id: run.locked_snapshot_draft_id,
        score: run.payloads?.snapshot_payload?.pac_safety_score,
        tier: run.payloads?.snapshot_payload?.tier,
        badge: run.payloads?.snapshot_payload?.transparency_badge,
        weighted_npr: run.payloads?.score_payload?.weighted_npr,
        raw_score: run.payloads?.score_payload?.raw_score_before_layer_4a,
        layer_4a: run.payloads?.score_payload?.layer_4a_total_applied,
        publish_enabled: run.payloads?.snapshot_payload?.publish_enabled,
        public_visible: run.payloads?.snapshot_payload?.public_visible,
        blockers: run.blockers,
      }),
    )
  }
} finally {
  await client.end()
}
