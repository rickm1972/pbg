#!/usr/bin/env node
/**
 * In-memory certification re-check on approved evidence (no Agent 1 API calls, no HTTP).
 *
 * Usage:
 *   node scripts/agent1-batch-cert-rerun.mjs
 *   node scripts/agent1-batch-cert-rerun.mjs --name "Blueland Powder Dish Soap Refillable System"
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadEnv, projectRoot } from './lib/env.mjs'
import { createClient } from '@supabase/supabase-js'
import {
  enforceCertificationVerification,
  extractCertificationNamesFromPacket,
  formatCertificationsVerified,
} from './agent1/certification-verify.mjs'

function parseArgs(argv) {
  const args = argv.slice(2)
  let productName
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--name' && args[i + 1]) productName = args[++i]
  }
  return { productName }
}

function parseCertList(value) {
  if (value == null) return []
  if (Array.isArray(value)) return value.map(String)
  const s = String(value).trim()
  if (s.startsWith('[')) {
    try {
      return JSON.parse(s)
    } catch {
      return []
    }
  }
  if (/^no third.party|^none found/i.test(s)) return []
  return [s]
}

function certSetFromFacts(facts) {
  const fact = facts?.find((f) => f.fact_key === 'certifications_found')
  return new Set(parseCertList(fact?.fact_value).map((x) => x.trim()).filter(Boolean))
}

function setsEqual(a, b) {
  if (a.size !== b.size) return false
  for (const x of a) if (!b.has(x)) return false
  return true
}

async function loadPipelineProducts(supabase) {
  const { data: products, error } = await supabase
    .from('products')
    .select('product_id, product_name, agent_status')
    .not('agent_status', 'eq', 'unscored')
    .order('product_name')

  if (error) throw error
  return products ?? []
}

async function loadLatestApprovedEvidence(supabase, productId) {
  const { data, error } = await supabase
    .from('product_evidence')
    .select('evidence_id, sources, facts, agent_metadata, bundle_version, review_status')
    .eq('product_id', productId)
    .eq('review_status', 'approved')
    .order('bundle_version', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data
}

async function main() {
  const { productName } = parseArgs(process.argv)
  const env = loadEnv()
  const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

  let products = await loadPipelineProducts(supabase)
  if (productName) {
    products = products.filter((p) => p.product_name === productName)
    if (!products.length) {
      console.error(`Product not found in pipeline: ${productName}`)
      process.exit(1)
    }
  }

  console.log(
    `\nAgent 1 in-memory cert re-check (no API, no HTTP) — ${products.length} product(s)\n`,
  )

  const results = []
  const changed = []

  for (let i = 0; i < products.length; i++) {
    const product = products[i]
    console.log(`\n[${i + 1}/${products.length}] ${product.product_name}`)

    const prior = await loadLatestApprovedEvidence(supabase, product.product_id)
    if (!prior) {
      console.log('  (no approved evidence — skipped)')
      results.push({
        product_id: product.product_id,
        product_name: product.product_name,
        skipped: true,
        reason: 'no approved evidence',
      })
      continue
    }

    const priorCerts = certSetFromFacts(prior.facts)

    const verified = enforceCertificationVerification({
      sources: prior.sources,
      facts: prior.facts,
      agent_metadata: prior.agent_metadata,
    })

    const newCerts = new Set(extractCertificationNamesFromPacket({ facts: verified.facts }))
    const certsChanged = !setsEqual(priorCerts, newCerts)

    const row = {
      product_id: product.product_id,
      product_name: product.product_name,
      agent_status: product.agent_status,
      prior_bundle_version: prior.bundle_version,
      prior_certifications: [...priorCerts].sort(),
      new_certifications: [...newCerts].sort(),
      certifications_changed: certsChanged,
      certifications_verified: verified.certifications_verified,
      removed_count: verified.removed_count,
      verified_count: verified.verified_count,
    }

    results.push(row)
    if (certsChanged) changed.push(row)

    console.log(`  prior (${priorCerts.size}): ${[...priorCerts].join('; ') || '(none)'}`)
    console.log(`  new  (${newCerts.size}): ${[...newCerts].join('; ') || '(none)'}`)
    console.log(`  changed: ${certsChanged ? 'YES' : 'no'}`)
    console.log(formatCertificationsVerified(row.certifications_verified))
  }

  const outDir = join(projectRoot, 'scripts', 'output')
  mkdirSync(outDir, { recursive: true })
  const summaryPath = join(outDir, 'agent1-cert-batch-summary.json')
  writeFileSync(
    summaryPath,
    JSON.stringify(
      { run_at: new Date().toISOString(), total: results.length, changed_count: changed.length, results, changed },
      null,
      2,
    ),
    'utf8',
  )

  console.log('\n=== SUMMARY ===')
  console.log(`Products processed: ${results.length}`)
  console.log(`Certifications changed vs approved evidence: ${changed.length}`)
  if (changed.length) {
    console.log('\nFLAGGED (certifications changed):')
    for (const c of changed) {
      console.log(`  • ${c.product_name}`)
      console.log(`      was: ${c.prior_certifications.join('; ') || '(none)'}`)
      console.log(`      now: ${c.new_certifications.join('; ') || '(none)'}`)
    }
  }
  console.log(`\nFull report: ${summaryPath}`)
  console.log('\nNote: This script does not write to the database or call Agent 1 research.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
