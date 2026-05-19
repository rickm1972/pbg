/**
 * Applies 0012_public_read_approved_product_scores.sql
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { connectPgClient } from './lib/pg-connect.mjs'
import { projectRoot } from './lib/env.mjs'

async function main() {
  const sql = readFileSync(
    join(projectRoot, 'supabase/migrations/0012_public_read_approved_product_scores.sql'),
    'utf8',
  )
  const client = await connectPgClient()
  try {
    console.log('=== Applying 0012_public_read_approved_product_scores.sql ===\n')
    await client.query(sql)
    console.log('Done.')
  } finally {
    await client.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
