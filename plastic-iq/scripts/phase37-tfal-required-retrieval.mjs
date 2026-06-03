#!/usr/bin/env node
/**
 * Phase 3.7: targeted required-check retrieval for T-Fal pending evidence (no full Agent 1 rerun).
 * Usage: node scripts/phase37-tfal-required-retrieval.mjs [--apply]
 */
import { createClient } from '@supabase/supabase-js'
import { loadEnv } from './lib/env.mjs'
import { bridgeLegacyFacts } from './agent1/bridge-legacy.mjs'
import { buildFieldProvenance } from './agent1/field-provenance.mjs'
import { executeRequiredCheckRetrieval } from './agent1/required-check-retrieval/execute-required-retrieval.mjs'

const TFAL_ID = '7a457a86-ab62-4cbf-90b9-ccaeafe06896'
const apply = process.argv.includes('--apply')
const refresh = process.argv.includes('--refresh')
const checkArg = process.argv.find((a) => a.startsWith('--checks='))
const checkIds = checkArg
  ? checkArg
      .slice('--checks='.length)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  : ['external.regulatory_pfas_minnesota_review', 'external.pfoa_vs_pfas_free_distinction']
const forceCheckIds = refresh ? checkIds : []

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
  console.error('No pending_review evidence for T-Fal')
  process.exit(1)
}

const { data: productRow } = await sb
  .from('products')
  .select('product_id, product_name, brand, subcategory')
  .eq('product_id', TFAL_ID)
  .maybeSingle()

const product = productRow ?? {
  product_id: TFAL_ID,
  product_name: row.agent_metadata?.structured_evidence?.product_identity?.product_name,
  brand: row.agent_metadata?.structured_evidence?.product_identity?.brand,
  subcategory: row.agent_metadata?.structured_evidence?.product_identity?.subcategory,
}

const meta = row.agent_metadata ?? {}
const structured = meta.structured_evidence
if (!structured) {
  console.error('No structured_evidence')
  process.exit(1)
}

console.log('T-Fal required-check retrieval (dry-run=%s)', !apply)
const retrieval = await executeRequiredCheckRetrieval({
  structured,
  sources: row.sources ?? [],
  facts: row.facts ?? [],
  product,
  env,
  checkIds,
  forceCheckIds,
})

console.log('\n--- required_check_results ---')
console.log(JSON.stringify(structured.required_check_results, null, 2))
console.log('\n--- regulatory flag ---')
console.log(JSON.stringify(structured.canonical_mappings?.regulatory_flag_ids, null, 2))
console.log('\n--- approval_blockers ---')
console.log(JSON.stringify(structured.required_evidence_validation?.approval_blockers, null, 2))
console.log('\n--- approval_blocked ---', structured.required_evidence_validation?.summary?.approval_blocked)

if (!apply) {
  console.log('\nPass --apply to persist sources + validation to product_evidence.')
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
console.log('\nUpdated evidence', row.evidence_id)
