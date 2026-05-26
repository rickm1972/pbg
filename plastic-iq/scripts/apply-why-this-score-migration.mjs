/**
 * Applies 0015_why_this_score_fields.sql
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { connectPgClient } from './lib/pg-connect.mjs'
import { projectRoot } from './lib/env.mjs'

async function main() {
  const sql = readFileSync(
    join(projectRoot, 'supabase/migrations/0015_why_this_score_fields.sql'),
    'utf8',
  )
  const client = await connectPgClient()
  try {
    console.log('=== Applying 0015_why_this_score_fields.sql ===\n')
    await client.query(sql)
    const { rows } = await client.query(
      `select column_name
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'scoring_inputs'
         and column_name like '%_summary'
       order by column_name`,
    )
    console.log('scoring_inputs summary columns:', rows.map((r) => r.column_name).join(', '))
  } finally {
    await client.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
