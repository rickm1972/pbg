#!/usr/bin/env node
/**
 * Applies 0035_phase5_legacy_archive_tables.sql only.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { connectPgClient } from './lib/pg-connect.mjs'
import { loadEnv, projectRoot } from './lib/env.mjs'

async function main() {
  const sql = readFileSync(
    join(projectRoot, 'supabase/migrations/0035_phase5_legacy_archive_tables.sql'),
    'utf8',
  )
  const client = await connectPgClient(loadEnv())
  try {
    console.log('=== Applying 0035_phase5_legacy_archive_tables.sql ===\n')
    await client.query(sql)
    console.log('Migration OK\n')
    const tables = await client.query(`
      select table_name from information_schema.tables
      where table_schema = 'public'
        and table_name like 'legacy_do_not_use_for_scoring_%'
      order by 1`)
    console.log('Archive tables:')
    for (const row of tables.rows) {
      console.log(`  ${row.table_name}`)
    }
  } finally {
    await client.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
