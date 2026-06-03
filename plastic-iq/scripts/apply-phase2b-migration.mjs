#!/usr/bin/env node
/**
 * Applies 0033_phase2b + field_provenance backfill + publish gate smoke test.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { connectPgClient } from './lib/pg-connect.mjs'
import { loadEnv, projectRoot } from './lib/env.mjs'

function runNode(script) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script], {
      cwd: projectRoot,
      stdio: 'inherit',
    })
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${script} exited ${code}`))))
  })
}

async function main() {
  const sql = readFileSync(
    join(projectRoot, 'supabase/migrations/0033_phase2b_gates_publish_provenance.sql'),
    'utf8',
  )
  const client = await connectPgClient(loadEnv())
  try {
    console.log('=== Applying 0033_phase2b_gates_publish_provenance.sql ===\n')
    await client.query(sql)
    console.log('Migration OK\n')
  } finally {
    await client.end()
  }

  console.log('=== Backfill field_provenance ===\n')
  await runNode(join(projectRoot, 'scripts/backfill-field-provenance.mjs'))

  const client2 = await connectPgClient(loadEnv())
  try {
    const prov = await client2.query(`
      select
        count(*)::int as approved_total,
        count(*) filter (
          where field_provenance is not null
            and field_provenance <> '{}'::jsonb
            and jsonb_typeof(field_provenance) = 'object'
            and (select count(*) from jsonb_object_keys(field_provenance)) > 0
        )::int as with_provenance
      from public.product_evidence
      where review_status = 'approved'`)

    const status = await client2.query(`
      select review_status, count(*)::int n
      from public.scoring_inputs group by 1 order by 1`)

    console.log('\nProvenance backfill verification:')
    console.table(prov.rows)
    console.log('\nscoring_inputs review_status:')
    console.table(status.rows)

    const draft = await client2.query(`
      select product_id, product_name from public.products
      where publish_status = 'draft' and active = true limit 1`)

    if (draft.rows[0]) {
      const id = draft.rows[0].product_id
      try {
        await client2.query(
          `update public.products set publish_status = 'published' where product_id = $1`,
          [id],
        )
        console.log('\nPublish test: UNEXPECTED success (should have failed)')
      } catch (e) {
        console.log('\nPublish gate test (expected failure):')
        console.log(String(e.message).split('\n')[0])
      }
    }

    const pub = await client2.query(`
      select count(*)::int n from public.products where publish_status = 'published'`)
    console.log('\nPublished products (expect 0):', pub.rows[0]?.n)
  } finally {
    await client2.end()
  }
}

main().catch((e) => {
  console.error(e.message ?? e)
  process.exit(1)
})
