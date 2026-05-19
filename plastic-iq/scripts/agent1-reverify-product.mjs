#!/usr/bin/env node
/**
 * Re-run in-memory certification verification on approved evidence (no model call, no HTTP).
 *
 * Usage:
 *   node scripts/agent1-reverify-product.mjs --name "Blueland Powder Dish Soap Refillable System"
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { loadEnv, projectRoot } from './lib/env.mjs'
import {
  enforceCertificationVerification,
  formatCertificationsVerified,
} from './agent1/certification-verify.mjs'

function parseArgs(argv) {
  const args = argv.slice(2)
  let productName
  let productId
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--name' && args[i + 1]) productName = args[++i]
    else if (args[i] === '--id' && args[i + 1]) productId = args[++i]
  }
  return { productName, productId }
}

async function main() {
  const { productName, productId } = parseArgs(process.argv)
  if (!productName && !productId) {
    console.error('Usage: node scripts/agent1-reverify-product.mjs --name "Product Name"')
    process.exit(1)
  }

  const env = loadEnv()
  const sb = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

  let productQuery = sb.from('products').select('*')
  if (productId) productQuery = productQuery.eq('product_id', productId)
  else productQuery = productQuery.eq('product_name', productName)

  const { data: product, error: productError } = await productQuery.single()
  if (productError) throw productError

  const { data: evidence, error: evidenceError } = await sb
    .from('product_evidence')
    .select('*')
    .eq('product_id', product.product_id)
    .eq('review_status', 'approved')
    .order('bundle_version', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (evidenceError) throw evidenceError
  if (!evidence) {
    console.error('No approved evidence for this product.')
    process.exit(1)
  }

  console.log(`\nRe-verifying certifications (in-memory): ${product.product_name}\n`)

  const packet = {
    sources: evidence.sources,
    facts: evidence.facts,
    agent_metadata: evidence.agent_metadata,
  }

  const verified = enforceCertificationVerification(packet)

  const { error: updateError } = await sb
    .from('product_evidence')
    .update({
      sources: verified.sources,
      facts: verified.facts,
      agent_metadata: verified.agent_metadata,
    })
    .eq('evidence_id', evidence.evidence_id)

  if (updateError) throw updateError

  console.log(formatCertificationsVerified(verified.certifications_verified))
  console.log(`\nverified: ${verified.verified_count}, removed: ${verified.removed_count}`)

  const ewgVerified = verified.certifications_verified.filter((r) =>
    /ewg\s*verified/i.test(r.certification_name),
  )
  console.log('\nEWG Verified rows:')
  if (!ewgVerified.length) console.log('  (none — EWG Verified not in verification list)')
  for (const row of ewgVerified) {
    console.log(`  - ${row.certification_name}: found=${row.found_in_page_content} → ${row.action_taken}`)
  }

  const outDir = join(projectRoot, 'scripts/output')
  mkdirSync(outDir, { recursive: true })
  const outPath = join(outDir, `agent1-reverify-${product.product_id}.json`)
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        product_id: product.product_id,
        product_name: product.product_name,
        evidence_id: evidence.evidence_id,
        certifications_verified: verified.certifications_verified,
        verified_count: verified.verified_count,
        removed_count: verified.removed_count,
      },
      null,
      2,
    ),
    'utf8',
  )
  console.log(`\nWrote ${outPath}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
