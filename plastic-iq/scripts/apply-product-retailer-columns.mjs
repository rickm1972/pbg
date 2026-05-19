/**
 * Adds target_url, walmart_url, other_retailer_* to public.products if missing.
 * Requires DB credentials (not the anon key).
 *
 * Option A — full URI (Settings → Database → Connection string → URI):
 *   DATABASE_URL="postgresql://postgres.[PROJECT]:[PASSWORD]@aws-0-....pooler.supabase.com:6543/postgres" node scripts/apply-product-retailer-columns.mjs
 *
 * Option B — .env next to this package:
 *   VITE_SUPABASE_URL="https://YOUR_REF.supabase.co"
 *   SUPABASE_DB_PASSWORD="your database password"
 *   npm run db:repair
 */
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { connectPgClient } from './lib/pg-connect.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

function loadDotEnv() {
  const path = join(root, '.env')
  if (!existsSync(path)) return {}
  const out = {}
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq <= 0) continue
    const key = t.slice(0, eq).trim()
    let val = t.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    out[key] = val
  }
  return out
}

const env = { ...loadDotEnv(), ...process.env }

function supabaseRefFromViteUrl(url) {
  try {
    const host = new URL(url).hostname
    const m = host.match(/^([a-z0-9]+)\.supabase\.co$/i)
    return m ? m[1] : null
  } catch {
    return null
  }
}

const sql = `
alter table public.products
  add column if not exists target_url text,
  add column if not exists walmart_url text,
  add column if not exists other_retailer_label text,
  add column if not exists other_retailer_url text;
`

async function main() {
  let client
  try {
    client = await connectPgClient(env)
    await client.query(sql)
    console.log('OK: retailer URL columns are present on public.products.')
  } catch (e) {
    console.error('Failed:', e instanceof Error ? e.message : e)
    if (String(e).includes('password authentication failed')) {
      console.error('\nTip: reset the database password in Supabase Dashboard if unsure.')
    }
    process.exit(1)
  } finally {
    await client?.end().catch(() => {})
  }
}

main()
