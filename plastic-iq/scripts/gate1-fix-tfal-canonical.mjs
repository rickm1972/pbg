#!/usr/bin/env node
/**
 * Re-apply Phase 3.5 canonical mapping + Phase 3.7 retrieval on T-Fal pending evidence (no full Agent 1 rerun).
 * Usage: node scripts/gate1-fix-tfal-canonical.mjs [--apply]
 */
import { createClient } from '@supabase/supabase-js'
import { loadEnv } from './lib/env.mjs'
import { bridgeLegacyFacts } from './agent1/bridge-legacy.mjs'
import { buildFieldProvenance } from './agent1/field-provenance.mjs'
import { applyCanonicalMappings } from '../src/shared/canonical-taxonomy/map-structured-evidence.mjs'
import { executeRequiredCheckRetrieval } from './agent1/required-check-retrieval/execute-required-retrieval.mjs'

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
  console.error('No pending_review evidence for T-Fal')
  process.exit(1)
}

const { data: productRow } = await sb
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

const product = productRow ?? {
  product_id: TFAL_ID,
  product_name: structured.product_identity?.product_name,
  brand: structured.product_identity?.brand,
}

console.log('Re-mapping T-Fal canonical + required-check retrieval (dry-run=%s)\n', !apply)

applyCanonicalMappings(structured, row.sources ?? [], { facts: row.facts ?? [] })

const retrieval = await executeRequiredCheckRetrieval({
  structured,
  sources: row.sources ?? [],
  facts: row.facts ?? [],
  product,
  env,
  forceCheckIds: [
    'external.pfoa_vs_pfas_free_distinction',
    'external.regulatory_pfas_minnesota_review',
  ],
})

const m = structured.canonical_mappings
console.log('\n--- canonical (score-driving) ---')
console.log('primary:', m?.primary_contact_material_id?.canonical_id)
console.log('substrate:', m?.substrate_material_id?.canonical_id)
console.log('coating:', m?.coating_modifier_id?.canonical_id)
console.log('pfas_status:', m?.pfas_status_id?.canonical_id)
console.log('safety:', Object.keys(m?.safety_claim_ids ?? {}))
console.log('\n--- required_check_results ---')
for (const r of structured.required_check_results ?? []) {
  console.log(r.check_id, r.status, r.detail?.slice(0, 80))
}
console.log('\n--- approval_blocked ---', structured.required_evidence_validation?.summary?.approval_blocked)
console.log('blockers:', structured.required_evidence_validation?.approval_blockers?.length ?? 0)

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
console.log('\nUpdated', row.evidence_id)
