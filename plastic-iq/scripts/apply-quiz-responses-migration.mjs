/**
 * Applies 0021_quiz_responses.sql (quiz response capture + anon RPCs)
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { connectPgClient } from './lib/pg-connect.mjs'
import { projectRoot } from './lib/env.mjs'

async function main() {
  const sql = readFileSync(
    join(projectRoot, 'supabase/migrations/0021_quiz_responses.sql'),
    'utf8',
  )

  const client = await connectPgClient()
  try {
    console.log('=== Applying 0021_quiz_responses.sql ===\n')
    await client.query(sql)

    const { rows: tableRows } = await client.query(
      `select exists (
        select 1 from information_schema.tables
        where table_schema = 'public' and table_name = 'quiz_responses'
      ) as ok`,
    )
    console.log('quiz_responses exists:', tableRows[0].ok)
  } finally {
    await client.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

