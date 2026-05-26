/**
 * Applies 0016_why_this_score_options.sql
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { connectPgClient } from './lib/pg-connect.mjs'
import { projectRoot } from './lib/env.mjs'

async function main() {
  const sql = readFileSync(
    join(projectRoot, 'supabase/migrations/0016_why_this_score_options.sql'),
    'utf8',
  )
  const client = await connectPgClient()
  try {
    console.log('=== Applying 0016_why_this_score_options.sql ===\n')
    await client.query(sql)
    const { rows } = await client.query(
      `select column_name, data_type
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'scoring_inputs'
         and column_name like '%_options'
       order by column_name`,
    )
    for (const r of rows) console.log(`${r.column_name}: ${r.data_type}`)
  } finally {
    await client.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
