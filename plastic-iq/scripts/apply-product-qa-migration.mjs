/**
 * Applies 0014_product_qa.sql
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { connectPgClient } from './lib/pg-connect.mjs'
import { projectRoot } from './lib/env.mjs'

async function main() {
  const sql = readFileSync(
    join(projectRoot, 'supabase/migrations/0014_product_qa.sql'),
    'utf8',
  )
  const client = await connectPgClient()
  try {
    console.log('=== Applying 0014_product_qa.sql ===\n')
    await client.query(sql)

    const { rows } = await client.query(
      `select exists (
        select 1 from information_schema.tables
        where table_schema = 'public' and table_name = 'product_qa'
      ) as ok`,
    )
    console.log('product_qa exists:', rows[0].ok)
  } finally {
    await client.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
