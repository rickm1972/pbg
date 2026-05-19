/**
 * Applies 0010_product_scores.sql (product_scores + five-tier products constraint)
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { connectPgClient } from './lib/pg-connect.mjs'
import { projectRoot } from './lib/env.mjs'

async function main() {
  const sql = readFileSync(
    join(projectRoot, 'supabase/migrations/0010_product_scores.sql'),
    'utf8',
  )
  const client = await connectPgClient()
  try {
    console.log('=== Applying 0010_product_scores.sql ===\n')
    await client.query(sql)

    const { rows: tableRows } = await client.query(
      `select exists (
        select 1 from information_schema.tables
        where table_schema = 'public' and table_name = 'product_scores'
      ) as ok`,
    )
    console.log('product_scores exists:', tableRows[0].ok)

    const { rows: tierRows } = await client.query(
      `select pg_get_constraintdef(oid) as def
       from pg_constraint
       where conname = 'products_tier_allowed'`,
    )
    console.log('products_tier_allowed:', tierRows[0]?.def ?? '(not found)')
  } finally {
    await client.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
