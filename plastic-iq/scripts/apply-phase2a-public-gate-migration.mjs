#!/usr/bin/env node
/**
 * Applies 0032_phase2a_public_publish_gate.sql
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { connectPgClient } from './lib/pg-connect.mjs'
import { loadEnv, projectRoot } from './lib/env.mjs'

async function main() {
  const sql = readFileSync(
    join(projectRoot, 'supabase/migrations/0032_phase2a_public_publish_gate.sql'),
    'utf8',
  )
  const client = await connectPgClient(loadEnv())
  try {
    console.log('=== Applying 0032_phase2a_public_publish_gate.sql ===\n')
    await client.query(sql)
    console.log('OK\n')

    const pub = await client.query(`
      select publish_status, count(*)::int n from public.products group by 1 order by 1`)
    console.log('publish_status counts:')
    console.table(pub.rows)

    const sample = await client.query(`
      select product_id from public.products where publish_status = 'draft' and active = true limit 1`)
    if (sample.rows[0]) {
      const id = sample.rows[0].product_id
      const score = await client.query(
        `select public.get_product_page_score($1::uuid) as score`,
        [id],
      )
      console.log('get_product_page_score(draft product):', score.rows[0]?.score ?? 'null')
    }
  } finally {
    await client.end()
  }
}

main().catch((e) => {
  console.error(e.message ?? e)
  process.exit(1)
})
