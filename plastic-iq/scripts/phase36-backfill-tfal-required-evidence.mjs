#!/usr/bin/env node
/**
 * Phase 3.6: apply required_evidence_validation to T-Fal pending_review (no Agent 1 re-run).
 * Usage: node scripts/phase36-backfill-tfal-required-evidence.mjs [--apply]
 */
import { createClient } from '@supabase/supabase-js'
import { loadEnv } from './lib/env.mjs'
import { applyCanonicalMappings } from '../src/shared/canonical-taxonomy/map-structured-evidence.mjs'
import { buildFieldProvenance } from './agent1/field-provenance.mjs'

const TFAL_ID = '7a457a86-ab62-4cbf-90b9-ccaeafe06896'
const apply = process.argv.includes('--apply')

const env = loadEnv()
const sb = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const { data: row, error } = await sb
  .from('product_evidence')
  .select('*')
  .eq('product_id', TFAL_ID)
  .eq('review_status', 'pending_review')
  .order('bundle_version', { ascending: false })
  .limit(1)
  .maybeSingle()

if (error) throw error
if (!row) {
  console.error('No pending_review evidence for T-Fal')
  process.exit(1)
}

const meta = row.agent_metadata ?? {}
const structured = meta.structured_evidence
if (!structured) {
  console.error('No structured_evidence on T-Fal bundle')
  process.exit(1)
}

applyCanonicalMappings(structured, row.sources ?? [], { facts: row.facts ?? [] })
const validation = structured.required_evidence_validation

console.log('T-Fal required_evidence_validation (dry-run=%s):', !apply)
console.log(JSON.stringify(validation, null, 2))

if (!apply) {
  console.log('\nPass --apply to persist.')
  process.exit(0)
}

const field_provenance = buildFieldProvenance(structured, row.sources ?? [])
const { error: updErr } = await sb
  .from('product_evidence')
  .update({
    agent_metadata: { ...meta, structured_evidence: structured },
    field_provenance,
    updated_at: new Date().toISOString(),
  })
  .eq('evidence_id', row.evidence_id)

if (updErr) throw updErr
console.log('Updated evidence', row.evidence_id)
