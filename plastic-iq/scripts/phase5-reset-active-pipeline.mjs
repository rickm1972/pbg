#!/usr/bin/env node
/**
 * Phase 5: archive legacy pipeline rows for active products, wipe pipeline tables,
 * reset products to clean Agent 1 starting state (unscored, draft publish).
 *
 * Usage:
 *   node scripts/phase5-reset-active-pipeline.mjs           # dry-run counts only
 *   node scripts/phase5-reset-active-pipeline.mjs --apply   # execute wipe
 *
 * Requires: migration 0035 applied, SUPABASE_DB_PASSWORD in .env
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { connectPgClient } from './lib/pg-connect.mjs'
import { loadEnv, projectRoot } from './lib/env.mjs'

const ARCHIVE_REASON = 'phase5_pipeline_reset'
const APPLY = process.argv.includes('--apply')

const PIPELINE_TABLES = [
  { source: 'product_evidence', archive: 'legacy_do_not_use_for_scoring_product_evidence' },
  { source: 'scoring_inputs', archive: 'legacy_do_not_use_for_scoring_scoring_inputs' },
  { source: 'product_scores', archive: 'legacy_do_not_use_for_scoring_product_scores' },
  { source: 'product_qa', archive: 'legacy_do_not_use_for_scoring_product_qa' },
]

const IMMUTABLE_TRIGGERS = [
  'trg_product_evidence_immutable',
  'trg_scoring_inputs_immutable',
  'trg_product_scores_immutable',
]

async function tableExists(client, name) {
  const r = await client.query(
    `select 1 from information_schema.tables
     where table_schema = 'public' and table_name = $1`,
    [name],
  )
  return r.rowCount > 0
}

async function countForActiveProducts(client, table) {
  const r = await client.query(
    `select count(*)::int as n
     from public.${table} t
     inner join public.products p on p.product_id = t.product_id
     where p.active = true`,
  )
  return r.rows[0].n
}

async function getSourceColumns(client, table) {
  const r = await client.query(
    `select column_name
     from information_schema.columns
     where table_schema = 'public' and table_name = $1
     order by ordinal_position`,
    [table],
  )
  return r.rows.map((row) => row.column_name)
}

async function archiveTable(client, source, archive) {
  const cols = await getSourceColumns(client, source)
  const colList = cols.map((c) => `t.${c}`).join(', ')
  const insertCols = [...cols, 'archived_at', 'archive_reason'].join(', ')

  const r = await client.query(
    `insert into public.${archive} (${insertCols})
     select ${colList}, now(), $1
     from public.${source} t
     inner join public.products p on p.product_id = t.product_id
     where p.active = true`,
    [ARCHIVE_REASON],
  )
  return r.rowCount
}

async function deleteForActiveProducts(client, table) {
  const r = await client.query(
    `delete from public.${table} t
     using public.products p
     where t.product_id = p.product_id and p.active = true`,
  )
  return r.rowCount
}

async function countArchive(client, archive) {
  const r = await client.query(
    `select count(*)::int as n from public.${archive} where archive_reason = $1`,
    [ARCHIVE_REASON],
  )
  return r.rows[0].n
}

async function triggerEnabled(client, name) {
  const r = await client.query(
    `select tgenabled
     from pg_trigger tr
     join pg_class c on c.oid = tr.tgrelid
     join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and tr.tgname = $1
     limit 1`,
    [name],
  )
  if (!r.rows[0]) return null
  return r.rows[0].tgenabled === 'O'
}

async function main() {
  const env = loadEnv()

  const migrationPath = join(
    projectRoot,
    'supabase/migrations/0035_phase5_legacy_archive_tables.sql',
  )
  const migrationSql = readFileSync(migrationPath, 'utf8')

  const client = await connectPgClient(env)

  const report = {
    mode: APPLY ? 'apply' : 'dry-run',
    before: {},
    archived: {},
    deleted: {},
    after: {},
    products: {},
    issues: [],
  }

  try {
    if (!APPLY) {
      console.log('DRY RUN — pass --apply to archive, wipe, and reset\n')
    } else {
      console.log('Applying migration 0035 (archive tables)…')
      await client.query(migrationSql)
      console.log('Migration OK\n')
    }

    for (const { source } of PIPELINE_TABLES) {
      report.before[source] = await countForActiveProducts(client, source)
    }

    const { rows: activeProducts } = await client.query(
      `select product_id, product_name, agent_status, publish_status,
              active_evidence_id, pac_safety_score, tier, score_basis,
              testing_queue_reason, primary_material, secondary_material, published_at
       from public.products where active = true order by product_name`,
    )
    report.products.active_count = activeProducts.length

    console.log('Active products:', activeProducts.length)
    console.log('Before wipe (active products only):')
    for (const [k, v] of Object.entries(report.before)) {
      console.log(`  ${k}: ${v}`)
    }
    console.log('')

    if (!APPLY) {
      console.log('No changes made. Re-run with --apply to execute Phase 5 reset.')
      return
    }

    await client.query('begin')

    for (const name of IMMUTABLE_TRIGGERS) {
      const rel =
        name === 'trg_product_evidence_immutable'
          ? 'product_evidence'
          : name === 'trg_scoring_inputs_immutable'
            ? 'scoring_inputs'
            : 'product_scores'
      await client.query(`alter table public.${rel} disable trigger ${name}`)
    }

    await client.query(
      `update public.products set active_evidence_id = null where active = true`,
    )

    for (const { source, archive } of PIPELINE_TABLES) {
      const exists = await tableExists(client, archive)
      if (!exists) {
        throw new Error(`Archive table ${archive} missing — run migration 0035 first`)
      }
      report.archived[source] = await archiveTable(client, source, archive)
    }

    const deleteOrder = ['product_qa', 'product_scores', 'scoring_inputs', 'product_evidence']
    for (const table of deleteOrder) {
      report.deleted[table] = await deleteForActiveProducts(client, table)
    }

    const productReset = await client.query(
      `update public.products set
         agent_status = 'unscored',
         active_evidence_id = null,
         pac_safety_score = null,
         tier = null,
         score_basis = null,
         testing_queue_reason = null,
         primary_material = null,
         secondary_material = null,
         publish_status = 'draft',
         published_at = null
       where active = true`,
    )
    report.products.reset_rows = productReset.rowCount

    for (const name of IMMUTABLE_TRIGGERS) {
      const rel =
        name === 'trg_product_evidence_immutable'
          ? 'product_evidence'
          : name === 'trg_scoring_inputs_immutable'
            ? 'scoring_inputs'
            : 'product_scores'
      await client.query(`alter table public.${rel} enable trigger ${name}`)
    }

    await client.query('commit')
    console.log('Transaction committed.\n')

    for (const { source } of PIPELINE_TABLES) {
      report.after[source] = await countForActiveProducts(client, source)
    }

    for (const { archive } of PIPELINE_TABLES) {
      report.archived[`${archive}_total`] = await countArchive(client, archive)
    }

    const pub = await client.query(
      `select publish_status, count(*)::int n from public.products where active = true group by 1`,
    )
    report.products.publish_status = Object.fromEntries(
      pub.rows.map((r) => [r.publish_status, r.n]),
    )

    const agent = await client.query(
      `select agent_status, count(*)::int n from public.products where active = true group by 1`,
    )
    report.products.agent_status = Object.fromEntries(
      agent.rows.map((r) => [r.agent_status, r.n]),
    )

    const legacyFields = await client.query(
      `select count(*)::int n from public.products where active = true
       and (
         active_evidence_id is not null
         or pac_safety_score is not null
         or tier is not null
         or score_basis is not null
         or testing_queue_reason is not null
         or primary_material is not null
         or secondary_material is not null
         or published_at is not null
         or publish_status <> 'draft'
         or agent_status <> 'unscored'
       )`,
    )
    report.products.non_clean_rows = legacyFields.rows[0].n

    const publicPublished = await client.query(
      `select count(*)::int n from public.products where active = true and publish_status = 'published'`,
    )
    report.public_published_active = publicPublished.rows[0].n

    report.triggers = {}
    for (const name of IMMUTABLE_TRIGGERS) {
      report.triggers[name] = await triggerEnabled(client, name)
    }

    const allTriggersOn = IMMUTABLE_TRIGGERS.every((n) => report.triggers[n] === true)
    if (!allTriggersOn) {
      report.issues.push('One or more immutability triggers not re-enabled')
    }

    console.log('Archive row counts (this batch):')
    for (const [k, v] of Object.entries(report.archived)) {
      console.log(`  ${k}: ${v}`)
    }
    console.log('\nDeleted:')
    for (const [k, v] of Object.entries(report.deleted)) {
      console.log(`  ${k}: ${v}`)
    }
    console.log('\nAfter wipe (active products only):')
    for (const [k, v] of Object.entries(report.after)) {
      console.log(`  ${k}: ${v}`)
    }
    console.log('\nProducts:', JSON.stringify(report.products, null, 2))
    console.log('\nTriggers enabled:', report.triggers)
    console.log('\nPublic published (active):', report.public_published_active)
    if (report.issues.length) {
      console.log('\nIssues:', report.issues)
    }

    const failed =
      Object.values(report.after).some((n) => n > 0) ||
      report.products.non_clean_rows > 0 ||
      report.public_published_active > 0 ||
      report.issues.length > 0

    if (failed) {
      console.error('\nVERIFICATION FAILED — see report above')
      process.exit(1)
    }
    console.log('\nPhase 5 reset complete — all active products in clean unscored/draft state.')
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
