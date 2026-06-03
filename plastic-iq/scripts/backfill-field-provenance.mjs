#!/usr/bin/env node
/**
 * Backfill product_evidence.field_provenance from agent_metadata.structured_evidence.
 * Phase 2B — does not change review_status or other fields.
 */
import { createServiceClient } from './agent1/supabase.mjs'
import { buildFieldProvenance } from './agent1/field-provenance.mjs'
import { connectPgClient } from './lib/pg-connect.mjs'
import { loadEnv, projectRoot } from './lib/env.mjs'

async function main() {
  const pg = await connectPgClient(loadEnv())
  await pg.query(
    'alter table public.product_evidence disable trigger trg_product_evidence_immutable',
  )

  const sb = createServiceClient()
  const { data: rows, error } = await sb
    .from('product_evidence')
    .select('evidence_id, product_id, sources, agent_metadata, field_provenance')
    .eq('review_status', 'approved')

  if (error) throw error

  let updated = 0
  let skipped = 0
  let empty = 0

  for (const row of rows ?? []) {
    const structured = row.agent_metadata?.structured_evidence
    const existing = row.field_provenance ?? {}
    const hasFields =
      typeof existing === 'object' && Object.keys(existing).length > 0

    if (hasFields) {
      skipped++
      continue
    }

    if (!structured) {
      empty++
      continue
    }

    const field_provenance = buildFieldProvenance(structured, row.sources ?? [])
    const keys = Object.keys(field_provenance)
    if (keys.length === 0) {
      empty++
      continue
    }

    const { error: uErr } = await sb
      .from('product_evidence')
      .update({ field_provenance })
      .eq('evidence_id', row.evidence_id)

    if (uErr) throw uErr
    updated++
    console.log(`  backfilled ${keys.length} fields → ${row.evidence_id}`)
  }

  console.log('\nBackfill summary:')
  console.log(`  approved rows: ${rows?.length ?? 0}`)
  console.log(`  updated: ${updated}`)
  console.log(`  skipped (already had provenance): ${skipped}`)
  console.log(`  no structured_evidence / empty: ${empty}`)

  await pg.query(
    'alter table public.product_evidence enable trigger trg_product_evidence_immutable',
  )
  await pg.end()
}

main().catch(async (e) => {
  try {
    const pg = await connectPgClient(loadEnv())
    await pg.query(
      'alter table public.product_evidence enable trigger trg_product_evidence_immutable',
    )
    await pg.end()
  } catch {
    /* ignore */
  }
  console.error(e.message ?? e)
  process.exit(1)
})
