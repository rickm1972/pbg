/**
 * Applies 0028_quiz_response_get.sql
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { connectPgClient } from './lib/pg-connect.mjs'
import { projectRoot } from './lib/env.mjs'

async function main() {
  const client = await connectPgClient()
  try {
    const { rows } = await client.query(
      `select exists (
        select 1 from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'quiz_response_get'
      ) as ok`,
    )
    if (rows[0].ok) {
      console.log('quiz_response_get already exists — skip')
      return
    }
    const sql = readFileSync(
      join(projectRoot, 'supabase/migrations/0028_quiz_response_get.sql'),
      'utf8',
    )
    console.log('=== Applying 0028_quiz_response_get.sql ===\n')
    await client.query(sql)
    console.log('quiz_response_get created')
  } finally {
    await client.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
