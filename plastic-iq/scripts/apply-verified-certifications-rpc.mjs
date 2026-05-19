#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { connectPgClient } from './lib/pg-connect.mjs'
import { projectRoot } from './lib/env.mjs'

const sql = readFileSync(
  join(projectRoot, 'supabase/migrations/0013_public_verified_certifications_rpc.sql'),
  'utf8',
)

async function main() {
  const client = await connectPgClient()
  try {
    console.log('=== Applying 0013_public_verified_certifications_rpc.sql ===\n')
    await client.query(sql)
    console.log('Done.')
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
