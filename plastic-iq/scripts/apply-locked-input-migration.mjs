#!/usr/bin/env node
/**
 * Applies 0041_agent1_locked_inputs.sql
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { connectPgClient } from './lib/pg-connect.mjs'
import { loadEnv, projectRoot } from './lib/env.mjs'

async function main() {
  const sql = readFileSync(
    join(projectRoot, 'supabase/migrations/0041_agent1_locked_inputs.sql'),
    'utf8',
  )
  const client = await connectPgClient(loadEnv())
  try {
    console.log('=== Applying 0041_agent1_locked_inputs.sql ===\n')
    await client.query(sql)
    console.log('Migration OK\n')
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
