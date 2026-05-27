/**
 * Applies 0023_quiz_responses_first_name.sql
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { connectPgClient } from './lib/pg-connect.mjs'
import { projectRoot } from './lib/env.mjs'

async function main() {
  const sql = readFileSync(
    join(projectRoot, 'supabase/migrations/0023_quiz_responses_first_name.sql'),
    'utf8',
  )

  const client = await connectPgClient()
  try {
    console.log('=== Applying 0023_quiz_responses_first_name.sql ===\n')
    await client.query(sql)

    const { rows } = await client.query(
      `select column_name
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'quiz_responses'
         and column_name = 'first_name'`,
    )
    console.log('first_name column exists:', rows.length > 0)
  } finally {
    await client.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
