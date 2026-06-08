#!/usr/bin/env node
/**
 * Applies 0036_public_evidence_display_pack_rpc.sql
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { connectPgClient } from './lib/pg-connect.mjs'
import { loadEnv, projectRoot } from './lib/env.mjs'

async function main() {
  const sql = readFileSync(
    join(projectRoot, 'supabase/migrations/0036_public_evidence_display_pack_rpc.sql'),
    'utf8',
  )
  const client = await connectPgClient(loadEnv())
  try {
    console.log('=== Applying 0036_public_evidence_display_pack_rpc.sql ===\n')
    await client.query(sql)
    console.log('OK\n')
  } finally {
    await client.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
