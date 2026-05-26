/**
 * Applies 0017_normalization_components_rpc.sql
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { connectPgClient } from './lib/pg-connect.mjs'
import { projectRoot } from './lib/env.mjs'

async function main() {
  const sql = readFileSync(
    join(projectRoot, 'supabase/migrations/0017_normalization_components_rpc.sql'),
    'utf8',
  )
  const client = await connectPgClient()
  try {
    console.log('=== Applying 0017_normalization_components_rpc.sql ===\n')
    await client.query(sql)
    const { rows } = await client.query(
      `select proname, proargtypes::regtype[] as args
       from pg_proc
       where proname = 'get_normalization_components'
         and pronamespace = 'public'::regnamespace`,
    )
    if (rows.length) {
      console.log('✓ get_normalization_components installed')
    } else {
      console.error('✗ function not found after apply')
      process.exit(1)
    }
  } finally {
    await client.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
