#!/usr/bin/env node
/**
 * Apply 0019_archive_formulation_products.sql (hide Dish Soap / formulation products).
 * Uses Supabase REST when pg is unavailable; otherwise runs SQL via pooler.
 */
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServiceClient } from './agent1/supabase.mjs'
import { connectPgClient } from './lib/pg-connect.mjs'
import { projectRoot } from './lib/env.mjs'

const BRANCH_BASICS_ID = 'a0c72167-f0f6-491e-90f7-bbb622fa5123'

async function archiveViaSupabase() {
  const supabase = createServiceClient()
  const { data: dishRows, error: listErr } = await supabase
    .from('products')
    .select('product_id')
    .eq('subcategory', 'Dish Soap')
  if (listErr) throw listErr

  const ids = new Set((dishRows ?? []).map((r) => r.product_id))
  ids.add(BRANCH_BASICS_ID)

  const { error: updateErr } = await supabase
    .from('products')
    .update({ active: false })
    .in('product_id', [...ids])
  if (updateErr) throw updateErr

  const { count, error: countErr } = await supabase
    .from('products')
    .select('product_id', { count: 'exact', head: true })
    .eq('active', false)
    .eq('subcategory', 'Dish Soap')
  if (countErr) throw countErr

  console.log(`Archived Dish Soap products (inactive): ${count ?? 0}`)
}

async function archiveViaPg() {
  const sql = readFileSync(
    join(projectRoot, 'supabase/migrations/0019_archive_formulation_products.sql'),
    'utf8',
  )
  const client = await connectPgClient()
  try {
    await client.query(sql)
    const { rows } = await client.query(
      `select count(*)::int as n from products where active = false and trim(coalesce(subcategory, '')) = 'Dish Soap'`,
    )
    console.log(`Archived Dish Soap products (inactive): ${rows[0]?.n ?? 0}`)
  } finally {
    await client.end()
  }
}

async function main() {
  try {
    await archiveViaPg()
  } catch (pgErr) {
    console.warn('PG apply failed, using Supabase REST:', pgErr.message)
    await archiveViaSupabase()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
