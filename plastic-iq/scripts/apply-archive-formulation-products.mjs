#!/usr/bin/env node
/**
 * Apply 0019_archive_formulation_products.sql (hide Dish Soap / formulation products).
 */
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { loadEnv } from './lib/env.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
loadEnv()

const sql = readFileSync(
  join(__dirname, '../supabase/migrations/0019_archive_formulation_products.sql'),
  'utf8',
)

const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
await client.connect()
try {
  await client.query(sql)
  const { rows } = await client.query(
    `select count(*)::int as n from products where active = false and trim(coalesce(subcategory, '')) = 'Dish Soap'`,
  )
  console.log(`Archived Dish Soap products (inactive): ${rows[0]?.n ?? 0}`)
} finally {
  await client.end()
}
