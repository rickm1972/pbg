#!/usr/bin/env node
/**
 * Applies 0034_phase4_publish_rpcs.sql (publish RPCs + ready_to_publish sync).
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { connectPgClient } from './lib/pg-connect.mjs'
import { loadEnv, projectRoot } from './lib/env.mjs'

async function main() {
  const sql = readFileSync(
    join(projectRoot, 'supabase/migrations/0034_phase4_publish_rpcs.sql'),
    'utf8',
  )
  const client = await connectPgClient(loadEnv())
  try {
    console.log('=== Applying 0034_phase4_publish_rpcs.sql ===\n')
    await client.query(sql)
    console.log('Migration OK\n')

    const counts = await client.query(`
      select publish_status, count(*)::int n
      from public.products
      where active = true
      group by 1
      order by 1`)
    console.log('publish_status (active products):')
    for (const row of counts.rows) {
      console.log(`  ${row.publish_status}: ${row.n}`)
    }

    const fns = await client.query(`
      select proname from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and proname in (
          'set_product_published',
          'set_product_unpublished',
          'sync_product_publish_eligibility'
        )
      order by 1`)
    console.log('\nRPCs present:', fns.rows.map((r) => r.proname).join(', '))
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
