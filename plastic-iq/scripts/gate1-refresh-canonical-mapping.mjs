#!/usr/bin/env node
/**
 * Lightweight Gate 1 refresh: re-apply canonical mappings on pending evidence (no Agent 1 rerun).
 *
 * Usage:
 *   node scripts/gate1-refresh-canonical-mapping.mjs --name "Lodge 10.25 Inch Cast Iron Skillet"
 *   node scripts/gate1-refresh-canonical-mapping.mjs --id <product_uuid> --apply
 */
import { createClient } from '@supabase/supabase-js'
import { loadEnv } from './lib/env.mjs'
import { bridgeLegacyFacts } from './agent1/bridge-legacy.mjs'
import { buildFieldProvenance } from './agent1/field-provenance.mjs'
import { fetchProductById, fetchProductByName } from './agent1/supabase.mjs'
import { applyCanonicalMappings } from '../src/shared/canonical-taxonomy/map-structured-evidence.mjs'
import { applyRequiredEvidenceValidation } from '../src/shared/required-evidence-matrix/index.mjs'

function parseArgs(argv) {
  const args = argv.slice(2)
  let productId
  let productName
  let apply = false
  let syncAlgorithm = false
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--id' && args[i + 1]) productId = args[++i]
    else if (args[i] === '--name' && args[i + 1]) productName = args[++i]
    else if (args[i] === '--apply') apply = true
    else if (args[i] === '--sync-algorithm') syncAlgorithm = true
  }
  return { productId, productName, apply, syncAlgorithm }
}

async function main() {
  const { productId, productName, apply, syncAlgorithm } = parseArgs(process.argv)
  if (!productId && !productName) {
    console.error('Usage: node scripts/gate1-refresh-canonical-mapping.mjs --id <uuid> | --name "..." [--apply]')
    process.exit(1)
  }

  const env = loadEnv()
  const sb = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
  const product = productId
    ? await fetchProductById(sb, productId)
    : await fetchProductByName(sb, productName)

  const { data: row, error: loadErr } = await sb
    .from('product_evidence')
    .select('*')
    .eq('product_id', product.product_id)
    .eq('review_status', 'pending_review')
    .order('bundle_version', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (loadErr) throw loadErr
  if (!row) {
    console.error('No pending_review evidence for product')
    process.exit(1)
  }

  const meta = row.agent_metadata ?? {}
  const structured = meta.structured_evidence
  if (!structured) {
    console.error('No structured_evidence on bundle')
    process.exit(1)
  }

  console.log('Refresh canonical mappings (dry-run=%s)\n', !apply)
  console.log(product.product_name, row.evidence_id)

  applyCanonicalMappings(structured, row.sources ?? [], { facts: row.facts ?? [] })
  applyRequiredEvidenceValidation(structured, row.sources ?? [], { facts: row.facts ?? [] })

  const m = structured.canonical_mappings
  console.log('\n--- safety_claim_ids ---')
  for (const [k, v] of Object.entries(m?.safety_claim_ids ?? {})) {
    console.log(`  ${k}: ${v?.canonical_id} (${v?.confidence_label ?? '—'})`)
  }
  console.log('pfas_status:', m?.pfas_status_id?.canonical_id)
  console.log(
    'approval_blocked:',
    structured.required_evidence_validation?.summary?.approval_blocked ?? 'n/a',
  )

  if (!apply) {
    console.log('\nPass --apply to persist (no Agent 1 rerun).')
    return
  }

  const facts = bridgeLegacyFacts(structured, row.sources ?? [])
  const field_provenance = buildFieldProvenance(structured, row.sources ?? [])
  const patch = {
    facts,
    field_provenance,
    agent_metadata: { ...meta, structured_evidence: structured },
    updated_at: new Date().toISOString(),
  }
  if (syncAlgorithm) patch.algorithm_version = ALGORITHM_VERSION

  const { error: updErr } = await sb.from('product_evidence').update(patch).eq('evidence_id', row.evidence_id)

  if (updErr) throw updErr
  console.log('\nPersisted', row.evidence_id)
}

main().catch((err) => {
  console.error(err.message ?? err)
  process.exit(1)
})
