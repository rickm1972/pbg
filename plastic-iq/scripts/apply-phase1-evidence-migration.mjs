#!/usr/bin/env node
/**
 * Applies 0031_phase1_evidence_versions.sql
 * Requires SUPABASE_DB_PASSWORD or DATABASE_URL in plastic-iq/.env
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { connectPgClient } from './lib/pg-connect.mjs'
import { loadEnv, projectRoot } from './lib/env.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = projectRoot

async function runCheck(client, label, sql) {
  console.log(`--- ${label} ---`)
  const res = await client.query(sql)
  if (res.rows?.length) console.table(res.rows)
  else console.log(`${res.command ?? 'OK'} (rowCount: ${res.rowCount ?? 0})`)
  console.log('')
}

async function main() {
  const migrationSql = readFileSync(
    join(root, 'supabase/migrations/0031_phase1_evidence_versions.sql'),
    'utf8',
  )
  const env = loadEnv()
  const client = await connectPgClient(env)
  try {
    console.log('=== Applying 0031_phase1_evidence_versions.sql ===\n')
    await client.query(migrationSql)
    console.log('Migration applied successfully.\n')

    await runCheck(client, 'review_status values', `
      select review_status, count(*)::int as n
      from public.product_evidence
      group by 1 order by 1`);

    await runCheck(client, 'multiple approved per product (expect 0 rows)', `
      select product_id, count(*)::int as approved_count
      from public.product_evidence
      where review_status = 'approved'
      group by 1 having count(*) > 1`);

    await runCheck(client, 'publish_status distribution', `
      select publish_status, count(*)::int as n
      from public.products
      group by 1 order by 1`);

    await runCheck(client, 'active_evidence_id backfill sample', `
      select count(*)::int as products_with_active_evidence
      from public.products
      where active_evidence_id is not null`);

    await runCheck(client, 'approve_product_evidence function', `
      select proname from pg_proc
      where proname = 'approve_product_evidence'`);
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  console.error(err.message ?? err)
  process.exit(1)
})
