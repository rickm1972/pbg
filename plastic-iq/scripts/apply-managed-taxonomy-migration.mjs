#!/usr/bin/env node
/**
 * Applies 0046_managed_taxonomy.sql and 0047_seed_kitchen_taxonomy.sql
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { connectPgClient } from './lib/pg-connect.mjs'
import { loadEnv, projectRoot } from './lib/env.mjs'

const MIGRATIONS = [
  '0046_managed_taxonomy.sql',
  '0047_seed_kitchen_taxonomy.sql',
]

async function main() {
  const client = await connectPgClient(loadEnv())
  try {
    for (const file of MIGRATIONS) {
      const sql = readFileSync(join(projectRoot, 'supabase/migrations', file), 'utf8')
      console.log(`=== Applying ${file} ===\n`)
      await client.query(sql)
      console.log(`Migration OK: ${file}\n`)
    }
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
