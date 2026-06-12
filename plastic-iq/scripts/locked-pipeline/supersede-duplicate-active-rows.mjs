/**
 * Supersede duplicate active Agent 3 outputs / Agent 4 audits (non-destructive).
 * Run: npx tsx scripts/locked-pipeline/supersede-duplicate-active-rows.mjs [--dry-run]
 */
import { connectPgClient } from '../lib/pg-connect.mjs'
import { loadEnv } from '../lib/env.mjs'
import {
  CANONICAL_LOCKED_PIPELINE_PRODUCT_IDS,
  catalogDisplayKey,
  shouldReplaceLockedQueueCandidate,
} from '../../src/lib/lockedPipeline/displayDedupe.ts'

const dryRun = process.argv.includes('--dry-run')

async function loadProductNames(db, productIds) {
  if (!productIds.length) return new Map()
  const res = await db.query(
    `select product_id, product_name, brand from public.products where product_id = any($1::uuid[])`,
    [productIds],
  )
  return new Map(res.rows.map((r) => [r.product_id, r]))
}

function pickWinners(rows, names) {
  const byDisplay = new Map()
  for (const row of rows) {
    const p = names.get(row.product_id)
    const key = catalogDisplayKey(p?.product_name ?? null, p?.brand ?? null)
    if (!key) continue
    const existing = byDisplay.get(key)
    if (!existing || shouldReplaceLockedQueueCandidate(existing, row)) {
      byDisplay.set(key, row)
    }
  }
  return [...byDisplay.values()]
}

export async function supersedeDuplicateActiveRows(db, { dryRun: simulate = false } = {}) {
  const ts = new Date().toISOString()
  const report = { agent3: {}, agent4: {} }

  const a3 = await db.query(
    `select locked_output_id, product_id, locked_input_id, review_status, created_at
     from public.agent3_locked_outputs
     where review_status <> 'superseded'
     order by created_at desc`,
  )
  const a3Names = await loadProductNames(db, [...new Set(a3.rows.map((r) => r.product_id))])
  const a3Winners = pickWinners(a3.rows, a3Names)
  const a3WinnerIds = new Set(a3Winners.map((w) => w.locked_output_id))
  const a3Stale = a3.rows.filter((r) => !a3WinnerIds.has(r.locked_output_id))

  for (const stale of a3Stale) {
    const winner = a3Winners.find((w) => {
      const p = a3Names.get(w.product_id)
      const s = a3Names.get(stale.product_id)
      return catalogDisplayKey(p?.product_name, p?.brand) === catalogDisplayKey(s?.product_name, s?.brand)
    })
    if (!winner) continue
    if (!simulate) {
      await db.query(
        `update public.agent3_locked_outputs
         set review_status = 'superseded', superseded_by_output_id = $1, updated_at = $2
         where locked_output_id = $3`,
        [winner.locked_output_id, ts, stale.locked_output_id],
      )
    }
  }

  const a4 = await db.query(
    `select locked_audit_id, product_id, locked_output_id, audit_status, created_at
     from public.agent4_locked_audits
     where audit_status <> 'superseded'
     order by created_at desc`,
  )
  const a4Names = await loadProductNames(db, [...new Set(a4.rows.map((r) => r.product_id))])
  const a4Winners = pickWinners(a4.rows, a4Names)
  const a4WinnerIds = new Set(a4Winners.map((w) => w.locked_audit_id))
  const a4Stale = a4.rows.filter((r) => !a4WinnerIds.has(r.locked_audit_id))

  for (const stale of a4Stale) {
    const winner = a4Winners.find((w) => {
      const p = a4Names.get(w.product_id)
      const s = a4Names.get(stale.product_id)
      return catalogDisplayKey(p?.product_name, p?.brand) === catalogDisplayKey(s?.product_name, s?.brand)
    })
    if (!winner) continue
    if (!simulate) {
      await db.query(
        `update public.agent4_locked_audits
         set audit_status = 'superseded', superseded_by_audit_id = $1, updated_at = $2
         where locked_audit_id = $3`,
        [winner.locked_audit_id, ts, stale.locked_audit_id],
      )
    }
  }

  for (const pid of CANONICAL_LOCKED_PIPELINE_PRODUCT_IDS) {
    const p = a3Names.get(pid) ?? (await db.query(`select product_name, brand from public.products where product_id = $1`, [pid])).rows[0]
    const key = catalogDisplayKey(p?.product_name, p?.brand)
    report.agent3[key ?? pid] = {
      total_active: a3.rows.filter((r) => catalogDisplayKey(a3Names.get(r.product_id)?.product_name, a3Names.get(r.product_id)?.brand) === key).length,
      visible_after: a3Winners.filter((w) => catalogDisplayKey(a3Names.get(w.product_id)?.product_name, a3Names.get(w.product_id)?.brand) === key).length,
      superseded: a3Stale.filter((r) => catalogDisplayKey(a3Names.get(r.product_id)?.product_name, a3Names.get(r.product_id)?.brand) === key).length,
    }
    report.agent4[key ?? pid] = {
      total_active: a4.rows.filter((r) => catalogDisplayKey(a4Names.get(r.product_id)?.product_name, a4Names.get(r.product_id)?.brand) === key).length,
      visible_after: a4Winners.filter((w) => catalogDisplayKey(a4Names.get(w.product_id)?.product_name, a4Names.get(w.product_id)?.brand) === key).length,
      superseded: a4Stale.filter((r) => catalogDisplayKey(a4Names.get(r.product_id)?.product_name, a4Names.get(r.product_id)?.brand) === key).length,
    }
  }

  return report
}

import { fileURLToPath } from 'node:url'

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const client = await connectPgClient(loadEnv())
  try {
    const report = await supersedeDuplicateActiveRows(client, { dryRun })
    console.log(dryRun ? 'DRY RUN — no rows updated' : 'Superseded duplicate active rows')
    console.log(JSON.stringify(report, null, 2))
  } finally {
    await client.end()
  }
}
