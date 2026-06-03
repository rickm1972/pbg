/**
 * Applies 0029_public_product_description_rpc.sql
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { connectPgClient } from './lib/pg-connect.mjs'
import { projectRoot } from './lib/env.mjs'

async function main() {
  const sql = readFileSync(
    join(projectRoot, 'supabase/migrations/0029_public_product_description_rpc.sql'),
    'utf8',
  )
  const client = await connectPgClient()
  try {
    console.log('=== Applying 0029_public_product_description_rpc.sql ===\n')
    await client.query(sql)
    const { rows } = await client.query(
      `select p.proname
       from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = 'get_product_description'`,
    )
    if (!rows.length) throw new Error('get_product_description was not created')
    console.log('OK — public.get_product_description exists')

    const lodge = '1cf2fa4e-5cdd-4798-8f3c-6c273ae69fa8'
    const { rows: sample } = await client.query(
      `select public.get_product_description($1::uuid) as description`,
      [lodge],
    )
    const desc = sample[0]?.description
    console.log(
      'Lodge sample:',
      desc ? `${String(desc).slice(0, 80)}…` : '(null — check scoring_inputs has product_description)',
    )
  } finally {
    await client.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
