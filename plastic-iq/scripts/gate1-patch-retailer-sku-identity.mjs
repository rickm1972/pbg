#!/usr/bin/env node
/**
 * In-place Gate 1 identity patch: retailer SKU precedence (no Agent 1 rerun).
 *
 * Usage:
 *   node scripts/gate1-patch-retailer-sku-identity.mjs --id <product_uuid> [--retailer-sku 2477328] [--apply]
 */
import { createClient } from '@supabase/supabase-js'
import { loadEnv } from './lib/env.mjs'
import { fetchProductById } from './agent1/supabase.mjs'
import { buildFieldProvenance } from './agent1/field-provenance.mjs'
import {
  applyRetailerSkuPrecedence,
  reconcileProductIdentityWarnings,
} from '../src/shared/agent1/gate1-product-identity.mjs'

function parseArgs(argv) {
  const args = argv.slice(2)
  let productId
  let retailerSku
  let apply = false
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--id' && args[i + 1]) productId = args[++i]
    else if (args[i] === '--retailer-sku' && args[i + 1]) retailerSku = args[++i]
    else if (args[i] === '--apply') apply = true
  }
  return { productId, retailerSku, apply }
}

async function main() {
  const { productId, retailerSku, apply } = parseArgs(process.argv)
  if (!productId) {
    console.error(
      'Usage: node scripts/gate1-patch-retailer-sku-identity.mjs --id <uuid> [--retailer-sku N] [--apply]',
    )
    process.exit(1)
  }

  const env = loadEnv()
  const sb = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
  const product = await fetchProductById(sb, productId)

  const { data: row, error: loadErr } = await sb
    .from('product_evidence')
    .select('*')
    .eq('product_id', productId)
    .eq('review_status', 'pending_review')
    .order('bundle_version', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (loadErr) throw loadErr
  if (!row) {
    console.error('No pending_review evidence')
    process.exit(1)
  }

  const meta = row.agent_metadata ?? {}
  const structured = meta.structured_evidence
  if (!structured) {
    console.error('No structured_evidence')
    process.exit(1)
  }

  const before = structured.product_identity?.sku_or_model
  applyRetailerSkuPrecedence(structured, row.sources ?? [], {
    retailerSkuOverride: retailerSku,
  })
  const warnings = reconcileProductIdentityWarnings(meta.warnings ?? [], structured, product)

  console.log(`Bundle v${row.bundle_version} ${row.evidence_id}`)
  console.log('  sku before:', before)
  console.log('  sku after:', structured.product_identity?.sku_or_model)
  console.log('  manufacturer_context_sku:', structured.product_identity?.manufacturer_context_sku ?? '—')
  console.log(
    '  pfas_status:',
    structured.canonical_mappings?.pfas_status_id?.canonical_id ?? 'unchanged in bundle',
  )

  if (!apply) {
    console.log('\nPass --apply to persist.')
    return
  }

  const field_provenance = buildFieldProvenance(structured, row.sources ?? [])
  const { error: updErr } = await sb
    .from('product_evidence')
    .update({
      field_provenance,
      agent_metadata: { ...meta, warnings, structured_evidence: structured },
      updated_at: new Date().toISOString(),
    })
    .eq('evidence_id', row.evidence_id)

  if (updErr) throw updErr
  console.log('\nPersisted in place (no supersede).')
}

main().catch((err) => {
  console.error(err.message ?? err)
  process.exit(1)
})
