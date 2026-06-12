#!/usr/bin/env node
/**
 * Phase B — repoint locked-chain proof to live catalog IDs and archive test debris products.
 * Run: npx tsx scripts/locked-pipeline/phase-b-cleanup.mjs [--dry-run]
 */
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { connectPgClient } from '../lib/pg-connect.mjs'
import { loadEnv } from '../lib/env.mjs'
import {
  LIVE_HEXCLAD_PRODUCT_ID,
  LIVE_LODGE_PRODUCT_ID,
  LEGACY_FIXTURE_HEXCLAD_PRODUCT_ID,
  LEGACY_FIXTURE_LODGE_PRODUCT_ID,
} from '../lib/locked-pipeline-smoke-db.mjs'
import { stripMigrationTransactionControl } from '../lib/test-migration-sql.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '../..')
const dryRun = process.argv.includes('--dry-run')

const LIVE = {
  lodge: LIVE_LODGE_PRODUCT_ID,
  hexclad: LIVE_HEXCLAD_PRODUCT_ID,
}

const LEGACY_FIXTURES = new Set([
  LEGACY_FIXTURE_LODGE_PRODUCT_ID,
  LEGACY_FIXTURE_HEXCLAD_PRODUCT_ID,
])

async function applyArchiveMigration(client) {
  const sql = stripMigrationTransactionControl(
    readFileSync(join(root, 'supabase/migrations/0045_products_archive_fields.sql'), 'utf8'),
  )
  if (!dryRun) await client.query(sql)
}

async function findDebrisProducts(client) {
  const res = await client.query(
    `select product_id, product_name, brand, pac_safety_score, tier, publish_status
     from public.products
     where product_id <> all($1::uuid[])
       and (
         lower(coalesce(brand, '')) in ('lodge', 'hexclad')
         or product_id = any($2::uuid[])
       )
     order by brand, date_added desc`,
    [[LIVE.lodge, LIVE.hexclad], [...LEGACY_FIXTURES]],
  )
  return res.rows.filter((r) => r.publish_status !== 'published')
}

function canonicalForBrand(brand) {
  const b = (brand ?? '').toLowerCase()
  if (b === 'lodge') return LIVE.lodge
  if (b === 'hexclad') return LIVE.hexclad
  return null
}

function recordOriginFor(row) {
  if (LEGACY_FIXTURES.has(row.product_id)) return 'locked_pipeline_fixture'
  if (row.pac_safety_score === 42 && row.tier === 'Caution') return 'smoke_test_debris'
  return 'smoke_test_debris'
}

const ACTIVE_WHERE = {
  agent3_locked_outputs: `review_status <> 'superseded'`,
  agent4_locked_audits: `audit_status <> 'superseded'`,
  locked_snapshot_drafts: `draft_status <> 'superseded'`,
}

async function repointLockedChain(client, debrisRows) {
  const report = []
  for (const row of debrisRows) {
    const canonical = canonicalForBrand(row.brand)
    if (!canonical) continue
    const tables = [
      'agent3_locked_outputs',
      'agent4_locked_audits',
      'locked_snapshot_drafts',
    ]
    let total = 0
    for (const table of tables) {
      const exists = await client.query(`select to_regclass($1) as t`, [`public.${table}`])
      if (!exists.rows[0]?.t) continue
      if (dryRun) {
        const n = await client.query(
          `select count(*)::int as c from public.${table} where product_id = $1 and ${ACTIVE_WHERE[table]}`,
          [row.product_id],
        )
        total += n.rows[0].c
      } else if (table === 'locked_snapshot_drafts') {
        const upd = await client.query(
          `update public.locked_snapshot_drafts
           set product_id = $1::uuid,
               snapshot_payload = jsonb_set(snapshot_payload, '{product_id}', to_jsonb($2::text), true),
               display_payload = case
                 when display_payload is not null
                 then jsonb_set(display_payload, '{product_id}', to_jsonb($2::text), true)
                 else display_payload
               end,
               updated_at = now()
           where product_id = $3::uuid and ${ACTIVE_WHERE[table]}`,
          [canonical, canonical, row.product_id],
        )
        total += upd.rowCount ?? 0
      } else {
        const upd = await client.query(
          `update public.${table} set product_id = $1::uuid, updated_at = now() where product_id = $2::uuid and ${ACTIVE_WHERE[table]}`,
          [canonical, row.product_id],
        )
        total += upd.rowCount ?? 0
      }
    }
    report.push({
      product: row.brand,
      stage: 'locked_chain',
      before_active_product_id: row.product_id,
      after_active_product_id: canonical,
      rows_updated: total,
      action: 'repoint product_id on locked-chain tables',
      safe_because: 'No live publish/scoring path; preserves payloads and math',
    })
  }
  return report
}

async function archiveDebris(client, debrisRows) {
  const ts = new Date().toISOString()
  const archived = []
  for (const row of debrisRows) {
    if (dryRun) {
      archived.push({ product_id: row.product_id, dry_run: true })
      continue
    }
    await client.query(
      `update public.products
       set is_archived = true,
           record_origin = $2,
           archived_at = $3,
           archive_reason = $4,
           date_last_updated = $3
       where product_id = $1`,
      [
        row.product_id,
        recordOriginFor(row),
        ts,
        'Phase B: duplicate Lodge/HexClad test-debris cleanup (non-destructive archive)',
      ],
    )
    archived.push({ product_id: row.product_id, record_origin: recordOriginFor(row) })
  }
  if (!dryRun) {
    await client.query(
      `update public.products
       set record_origin = coalesce(record_origin, 'live_catalog')
       where product_id = any($1::uuid[]) and coalesce(is_archived, false) = false`,
      [[LIVE.lodge, LIVE.hexclad]],
    )
  }
  return archived
}

async function activeLockedChainProductIds(client) {
  const lodge = await client.query(
    `select distinct o.product_id
     from public.agent3_locked_outputs o
     join public.products p on p.product_id = o.product_id
     where lower(p.brand) = 'lodge' and o.review_status <> 'superseded'`,
  )
  const hex = await client.query(
    `select distinct o.product_id
     from public.agent3_locked_outputs o
     join public.products p on p.product_id = o.product_id
     where lower(p.brand) = 'hexclad' and o.review_status <> 'superseded'`,
  )
  return { lodge: lodge.rows.map((r) => r.product_id), hexclad: hex.rows.map((r) => r.product_id) }
}

const client = await connectPgClient(loadEnv())
try {
  console.log(dryRun ? 'DRY RUN — Phase B cleanup' : 'Applying Phase B cleanup')
  await client.query('begin')
  try {
    await applyArchiveMigration(client)

    const beforeActive = await activeLockedChainProductIds(client)
    const debris = await findDebrisProducts(client)
    console.log(`Found ${debris.length} debris product rows to archive`)

    const repointReport = await repointLockedChain(client, debris)
    const archived = await archiveDebris(client, debris)
    const afterActive = await activeLockedChainProductIds(client)

    if (dryRun) {
      await client.query('rollback')
    } else {
      await client.query('commit')
    }

    console.log(
      JSON.stringify(
        {
          dry_run: dryRun,
          debris_count: debris.length,
          repoint_report: repointReport,
          archived,
          active_locked_outputs_before: beforeActive,
          active_locked_outputs_after: afterActive,
          note: 'agent1_locked_inputs left on debris product_ids (immutable locked_for_agent_3 rows); historical FK preserved',
        },
        null,
        2,
      ),
    )
  } catch (err) {
    await client.query('rollback')
    throw err
  }
} finally {
  await client.end()
}
