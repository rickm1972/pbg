/**
 * Applies 0007_agent1_product_evidence.sql and prints verification output.
 * Requires SUPABASE_DB_PASSWORD or DATABASE_URL in plastic-iq/.env
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { connectPgClient } from './lib/pg-connect.mjs'
import { loadEnv, projectRoot } from './lib/env.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = projectRoot
const env = loadEnv()

async function runCheck(client, label, sql) {
  console.log(`--- ${label} ---`)
  const res = await client.query(sql)
  if (res.rows?.length) console.table(res.rows)
  else console.log(`${res.command ?? 'OK'} (rowCount: ${res.rowCount ?? 0})`)
  console.log('')
  return res
}

async function main() {
  const migrationSql = readFileSync(
    join(root, 'supabase/migrations/0007_agent1_product_evidence.sql'),
    'utf8',
  )

  let client
  try {
    client = await connectPgClient(env)
    console.log('=== Applying migration 0007_agent1_product_evidence.sql ===\n')
    await client.query(migrationSql)
    console.log('Migration applied successfully.\n')
    console.log('=== Verification ===\n')

    await runCheck(
      client,
      'product_evidence table exists',
      `select exists (
        select 1 from information_schema.tables
        where table_schema = 'public' and table_name = 'product_evidence'
      ) as product_evidence_table_exists`,
    )

    await runCheck(
      client,
      'agent_status column on products',
      `select exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'products' and column_name = 'agent_status'
      ) as agent_status_column_exists`,
    )

    await runCheck(
      client,
      'product counts by agent_status',
      `select
        count(*)::int as total_products,
        count(*) filter (where agent_status = 'unscored')::int as unscored_count,
        count(*) filter (where agent_status is distinct from 'unscored')::int as non_unscored_count
      from public.products`,
    )

    await runCheck(
      client,
      'agent_status breakdown',
      `select agent_status, count(*)::int as count
       from public.products
       group by agent_status
       order by agent_status`,
    )

    await runCheck(
      client,
      'RLS enabled on product_evidence',
      `select c.relrowsecurity as rls_enabled
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relname = 'product_evidence'`,
    )

    await runCheck(
      client,
      'product_evidence RLS policies (expect admin-only, no public SELECT)',
      `select
        pol.polname as policy_name,
        case pol.polcmd when 'r' then 'SELECT' when 'a' then 'INSERT' when 'w' then 'UPDATE'
          when 'd' then 'DELETE' when '*' then 'ALL' end as command,
        coalesce(array(
          select rolname from pg_roles r where r.oid = any (pol.polroles)
        ), array['public']::name[]) as roles
       from pg_policy pol
       join pg_class c on c.oid = pol.polrelid
       join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relname = 'product_evidence'
       order by pol.polname`,
    )

    await runCheck(
      client,
      'expected indexes',
      `select indexname, tablename
       from pg_indexes
       where schemaname = 'public'
         and (
           (tablename = 'products' and indexname = 'products_agent_status_idx')
           or (tablename = 'product_evidence' and indexname in (
             'product_evidence_product_id_idx',
             'product_evidence_review_status_idx',
             'product_evidence_product_review_idx'
           ))
         )
       order by tablename, indexname`,
    )

    await runCheck(
      client,
      'product_evidence columns',
      `select column_name, data_type, is_nullable
       from information_schema.columns
       where table_schema = 'public' and table_name = 'product_evidence'
       order by ordinal_position`,
    )

    console.log('=== All checks complete ===')
  } catch (e) {
    console.error('Failed:', e instanceof Error ? e.message : e)
    process.exit(1)
  } finally {
    await client?.end().catch(() => {})
  }
}

main()
