#!/usr/bin/env node
import { createServiceClient } from './agent1/supabase.mjs'

const HEXCLAD_ID = 'fd05c5fb-19c2-4bc0-9882-ce73a7644ef5'

async function main() {
  const sb = createServiceClient()
  const { data: product, error: pErr } = await sb
    .from('products')
    .select('*')
    .eq('product_id', HEXCLAD_ID)
    .single()
  if (pErr) throw pErr

  const { data: evidence, error: eErr } = await sb
    .from('product_evidence')
    .select('evidence_id,bundle_version,review_status,created_at,algorithm_version')
    .eq('product_id', HEXCLAD_ID)
    .order('bundle_version', { ascending: false })
  if (eErr) throw eErr

  console.log('PRODUCT:', product.product_name)
  console.log('agent_status:', product.agent_status)
  console.log('amazon_asin:', product.amazon_asin)
  console.log('sku:', product.sku)
  console.log('\nEVIDENCE VERSIONS:')
  for (const row of evidence ?? []) {
    console.log(`  v${row.bundle_version} ${row.review_status} ${row.evidence_id}`)
  }

  const target =
    evidence?.find((e) => e.review_status === 'pending_review') ??
    evidence?.[0]
  if (!target) {
    console.log('\nNo evidence rows')
    return
  }

  const { data: full, error: fErr } = await sb
    .from('product_evidence')
    .select('*')
    .eq('evidence_id', target.evidence_id)
    .single()
  if (fErr) throw fErr

  const s = full.agent_metadata?.structured_evidence
  const m = s?.canonical_mappings
  console.log('\nINSPECTING:', target.review_status, target.evidence_id)
  console.log('canonical primary:', m?.primary_contact_surface?.canonical_id)
  console.log('canonical coating:', m?.coating_modifier_id?.canonical_id)
  console.log('canonical pfas:', m?.pfas_status_id?.canonical_id)
  console.log('canonical substrate:', m?.substrate_material_id?.canonical_id)
  console.log('product_identity:', JSON.stringify(s?.product_identity, null, 2))
  console.log('material_identity:', JSON.stringify(s?.material_identity, null, 2))
  console.log(
    'approval_blocked:',
    s?.required_evidence_validation?.summary?.approval_blocked,
  )
  console.log('blockers:', s?.required_evidence_validation?.approval_blockers)
  console.log('\nSOURCES:')
  for (const src of full.sources ?? []) {
    console.log(
      `  [${src.source_role ?? src.source_type}] eligible=${src.public_source_eligible} ${src.title?.slice(0, 80)}`,
    )
    console.log(`    ${src.url}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
