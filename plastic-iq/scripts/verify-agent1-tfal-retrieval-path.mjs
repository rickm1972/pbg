#!/usr/bin/env node
/**
 * Verify Agent 1 runner Step 4b retrieval path on T-Fal pending evidence (no Anthropic re-research).
 * Usage: node scripts/verify-agent1-tfal-retrieval-path.mjs [--apply]
 */
import { createClient } from '@supabase/supabase-js'
import { loadEnv } from './lib/env.mjs'
import { bridgeLegacyFacts } from './agent1/bridge-legacy.mjs'
import { buildFieldProvenance } from './agent1/field-provenance.mjs'
import { applyCanonicalMappings } from '../src/shared/canonical-taxonomy/map-structured-evidence.mjs'
import {
  assertRequiredExternalRetrievalComplete,
  invokeRequiredCheckRetrieval,
} from './agent1/required-check-retrieval/invoke.mjs'
import { detectPatternTriggers } from '../src/shared/required-evidence-matrix/pattern-triggers.mjs'

const TFAL_ID = '7a457a86-ab62-4cbf-90b9-ccaeafe06896'
const apply = process.argv.includes('--apply')

const env = loadEnv()
const sb = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const { data: row, error: loadErr } = await sb
  .from('product_evidence')
  .select('*')
  .eq('product_id', TFAL_ID)
  .eq('review_status', 'pending_review')
  .order('bundle_version', { ascending: false })
  .limit(1)
  .maybeSingle()

if (loadErr) throw loadErr
if (!row) {
  console.error('No pending_review T-Fal evidence')
  process.exit(1)
}

const { data: product } = await sb
  .from('products')
  .select('product_id, product_name, brand, subcategory')
  .eq('product_id', TFAL_ID)
  .maybeSingle()

const meta = row.agent_metadata ?? {}
const structured = meta.structured_evidence
if (!structured) {
  console.error('No structured_evidence')
  process.exit(1)
}

console.log('Agent 1 Step 4b path (apply=%s)\n', apply)

applyCanonicalMappings(structured, row.sources ?? [], { facts: row.facts ?? [] })

process.env.AGENT1_RELOAD_MODULES = '1'
const retrieval = await invokeRequiredCheckRetrieval({
  structured,
  sources: row.sources ?? [],
  facts: row.facts ?? [],
  product: product ?? { product_id: TFAL_ID },
  env,
})
const triggers = detectPatternTriggers(structured, structured.canonical_mappings, retrieval.sources)
assertRequiredExternalRetrievalComplete(structured, triggers)

const m = structured.canonical_mappings
const v = structured.required_evidence_validation?.summary
console.log('primary:', m?.primary_contact_material_id?.canonical_id)
console.log('pfas_status:', m?.pfas_status_id?.canonical_id)
console.log('active_triggers:', v?.active_triggers)
for (const r of structured.required_check_results ?? []) {
  console.log(r.check_id, r.status, (r.detail ?? '').slice(0, 90))
}
console.log('\napproval_blocked:', v?.approval_blocked, 'score_blocking_gaps:', v?.score_blocking_gaps)

const pfoa = structured.required_check_results?.find(
  (r) => r.check_id === 'external.pfoa_vs_pfas_free_distinction',
)
if (!pfoa || pfoa.status !== 'passed') {
  console.error('\nFAIL: PFOA-vs-PFAS check did not pass')
  process.exit(1)
}
if (/No retrieval runner registered/i.test(pfoa.detail ?? '')) {
  console.error('\nFAIL: stale runner stub')
  process.exit(1)
}

if (!apply) {
  console.log('\nPass --apply to persist.')
  process.exit(0)
}

const sources = retrieval.sources
const facts = bridgeLegacyFacts(structured, sources)
const field_provenance = buildFieldProvenance(structured, sources)

const { error: updErr } = await sb
  .from('product_evidence')
  .update({
    sources,
    facts,
    field_provenance,
    agent_metadata: { ...meta, structured_evidence: structured },
    updated_at: new Date().toISOString(),
  })
  .eq('evidence_id', row.evidence_id)

if (updErr) throw updErr
console.log('\nOK: updated', row.evidence_id)
