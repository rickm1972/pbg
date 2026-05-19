import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { connectPgClient } from './lib/pg-connect.mjs'
import { projectRoot } from './lib/env.mjs'

async function main() {
  const sql = readFileSync(
    join(projectRoot, 'supabase/migrations/0011_scoring_review_pending.sql'),
    'utf8',
  )
  const client = await connectPgClient()
  try {
    await client.query(sql)
    console.log('Applied 0011_scoring_review_pending.sql')
  } finally {
    await client.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
