#!/usr/bin/env node
/**
 * One-off: set reviewer_notes on approved evidence for a product (by name substring).
 * Usage: node scripts/set-reviewer-notes.mjs "Berglander" "note text..."
 */
import { connectPgClient } from './lib/pg-connect.mjs'

const nameMatch = process.argv[2]
const notes = process.argv.slice(3).join(' ').trim()

if (!nameMatch || !notes) {
  console.error('Usage: node scripts/set-reviewer-notes.mjs "<name substring>" "<notes>"')
  process.exit(1)
}

const client = await connectPgClient()
try {
  const { rows } = await client.query(
    `
    update public.product_evidence pe
    set
      reviewer_notes = $2,
      updated_at = now()
    from public.products p
    where pe.product_id = p.product_id
      and p.product_name ilike '%' || $1 || '%'
      and pe.review_status = 'approved'
      and pe.bundle_version = (
        select max(pe2.bundle_version)
        from public.product_evidence pe2
        where pe2.product_id = pe.product_id
          and pe2.review_status = 'approved'
      )
    returning pe.evidence_id, p.product_name, pe.bundle_version, pe.reviewer_notes
    `,
    [nameMatch, notes],
  )

  if (!rows.length) {
    console.error(`No approved evidence found for product matching "${nameMatch}".`)
    process.exit(1)
  }

  for (const row of rows) {
    console.log('Updated:', row.product_name, `(bundle v${row.bundle_version})`)
    console.log('Notes:', row.reviewer_notes)
  }
} finally {
  await client.end()
}
