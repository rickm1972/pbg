#!/usr/bin/env node
import { connectPgClient } from '../lib/pg-connect.mjs'
import { loadEnv } from '../lib/env.mjs'

const client = await connectPgClient(loadEnv())
try {
  const a3all = await client.query(
    `select o.review_status, p.product_name, p.brand from public.agent3_locked_outputs o
     join public.products p on p.product_id = o.product_id`,
  )
  const a4all = await client.query(
    `select a.audit_status, p.product_name, p.brand from public.agent4_locked_audits a
     join public.products p on p.product_id = a.product_id`,
  )

  for (const label of ['lodge', 'hexclad']) {
    const rows3 = a3all.rows.filter((r) => (r.brand ?? '').toLowerCase() === label)
    const rows4 = a4all.rows.filter((r) => (r.brand ?? '').toLowerCase() === label)
    console.log(
      JSON.stringify({
        product: label,
        agent3_total: rows3.length,
        agent3_active_visible: rows3.filter((r) => r.review_status !== 'superseded').length,
        agent4_total: rows4.length,
        agent4_active_visible: rows4.filter((r) => r.audit_status !== 'superseded').length,
      }),
    )
  }

  const draftExists = await client.query(`select to_regclass('public.locked_snapshot_drafts') as t`)
  console.log('locked_snapshot_drafts:', draftExists.rows[0].t ?? 'NOT MIGRATED')
} finally {
  await client.end()
}
