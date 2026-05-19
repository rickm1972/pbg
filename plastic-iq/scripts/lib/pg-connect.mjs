import pg from 'pg'
import { loadEnv } from './env.mjs'

function supabaseRefFromViteUrl(url) {
  try {
    const host = new URL(url).hostname
    const m = host.match(/^([a-z0-9]+)\.supabase\.co$/i)
    return m ? m[1] : null
  } catch {
    return null
  }
}

function sessionPoolerConnectionString(ref, password, region = 'us-east-1') {
  const enc = encodeURIComponent(password)
  return `postgresql://postgres.${ref}:${enc}@aws-1-${region}.pooler.supabase.com:5432/postgres`
}

export function buildPgConnectionCandidates(env = loadEnv()) {
  const candidates = []
  const explicit = env.DATABASE_URL || env.SUPABASE_DB_URL
  if (explicit) candidates.push(explicit)

  const viteUrl = env.VITE_SUPABASE_URL
  const password = env.SUPABASE_DB_PASSWORD
  const ref = viteUrl ? supabaseRefFromViteUrl(viteUrl) : null
  if (ref && password) {
    const enc = encodeURIComponent(password)
    candidates.push(sessionPoolerConnectionString(ref, password))
    candidates.push(
      `postgresql://postgres:${enc}@db.${ref}.supabase.co:5432/postgres`,
    )
  }
  return [...new Set(candidates)]
}

export async function connectPgClient(env = loadEnv()) {
  const candidates = buildPgConnectionCandidates(env)
  if (!candidates.length) {
    throw new Error('Missing DATABASE_URL or SUPABASE_DB_PASSWORD in plastic-iq/.env')
  }

  let lastError
  for (const connectionString of candidates) {
    const client = new pg.Client({
      connectionString,
      ssl: { rejectUnauthorized: false },
    })
    try {
      await client.connect()
      return client
    } catch (e) {
      lastError = e
      await client.end().catch(() => {})
    }
  }
  throw lastError
}
