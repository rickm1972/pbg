/**
 * Applies 0008_scoring_inputs.sql
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { connectPgClient } from './lib/pg-connect.mjs'
import { projectRoot } from './lib/env.mjs'

const root = projectRoot

async function main() {
  const sql = readFileSync(
    join(root, 'supabase/migrations/0008_scoring_inputs.sql'),
    'utf8',
  )
  const client = await connectPgClient()
  try {
    console.log('=== Applying 0008_scoring_inputs.sql ===\n')
    await client.query(sql)
    const { rows } = await client.query(
      `select exists (
        select 1 from information_schema.tables
        where table_schema = 'public' and table_name = 'scoring_inputs'
      ) as ok`,
    )
    console.log('scoring_inputs exists:', rows[0].ok)
  } finally {
    await client.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
