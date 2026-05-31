/**
 * Applies channel_maps migrations (idempotent checks).
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { connectPgClient } from './lib/pg-connect.mjs'
import { projectRoot } from './lib/env.mjs'

async function columnExists(client, column) {
  const { rows } = await client.query(
    `select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'channel_maps' and column_name = $1
    ) as ok`,
    [column],
  )
  return rows[0].ok
}

async function tableExists(client) {
  const { rows } = await client.query(
    `select exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = 'channel_maps'
    ) as ok`,
  )
  return rows[0].ok
}

async function main() {
  const client = await connectPgClient()
  try {
    if (!(await tableExists(client))) {
      const sql = readFileSync(
        join(projectRoot, 'supabase/migrations/0025_channel_maps.sql'),
        'utf8',
      )
      console.log('=== Applying 0025_channel_maps.sql ===\n')
      await client.query(sql)
    } else {
      console.log('=== channel_maps table already exists — skip 0025 ===\n')
    }

    if (!(await columnExists(client, 'media_outlets'))) {
      const sql = readFileSync(
        join(projectRoot, 'supabase/migrations/0026_channel_maps_media_outlets.sql'),
        'utf8',
      )
      console.log('=== Applying 0026_channel_maps_media_outlets.sql ===\n')
      await client.query(sql)
    } else {
      console.log('=== media_outlets column exists — skip 0026 ===\n')
    }

    if (!(await columnExists(client, 'industry_channels'))) {
      const sql = readFileSync(
        join(projectRoot, 'supabase/migrations/0027_channel_maps_industry.sql'),
        'utf8',
      )
      console.log('=== Applying 0027_channel_maps_industry.sql ===\n')
      await client.query(sql)
    } else {
      console.log('=== industry_channels column exists — skip 0027 ===\n')
    }

    console.log('channel_maps.media_outlets:', await columnExists(client, 'media_outlets'))
    console.log('channel_maps.industry_channels:', await columnExists(client, 'industry_channels'))
  } finally {
    await client.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
