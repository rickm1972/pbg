#!/usr/bin/env node
/**
 * Pause Lodge public readiness: unpublish + supersede Gate 2/3/4 (preserve approved Gate 1).
 *
 * Usage:
 *   node scripts/pause-lodge-public-readiness.mjs           # dry-run + retailer report
 *   node scripts/pause-lodge-public-readiness.mjs --apply
 */
import { createServiceClient } from './agent1/supabase.mjs'

const LODGE_NAME = 'Lodge 10.25 Inch Cast Iron Skillet'
const STALE_NOTES =
  'Stale after global public display / Agent 2 description template fixes — rerun Agents 2–4 manually from admin.'

const apply = process.argv.includes('--apply')

function normalizeUrlKey(url) {
  try {
    const u = new URL(url)
    u.hash = ''
    const path = u.pathname.replace(/\/+$/, '') || '/'
    return `${u.protocol}//${u.host.toLowerCase()}${path}${u.search}`
  } catch {
    return String(url ?? '').trim().toLowerCase()
  }
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./i, '').toLowerCase()
  } catch {
    return ''
  }
}

function reportRetailerCtas(product, evidence) {
  const urls = {
    amazon: (product.affiliate_link || product.amazon_url || '').trim(),
    target: (product.target_url || '').trim(),
    walmart: (product.walmart_url || '').trim(),
  }
  const sources = evidence?.sources ?? []
  const warnings = evidence?.agent_metadata?.warnings ?? []

  console.log('\nRetailer CTA audit:')
  for (const [retailer, url] of Object.entries(urls)) {
    if (!url) {
      console.log(`  ${retailer}: (no URL on product row)`)
      continue
    }
    const key = normalizeUrlKey(url)
    const source = sources.find((s) => s.url && normalizeUrlKey(s.url) === key)
    const warnHit = warnings.some((w) => {
      const text = typeof w === 'string' ? w : JSON.stringify(w)
      return text.includes(url) || text.toLowerCase().includes(hostOf(url))
    })
    console.log(`  ${retailer}: ${url}`)
    console.log(`    in evidence.sources: ${source ? `yes (${source.source_type})` : 'no'}`)
    if (warnHit) console.log('    Gate 1 warning mentions this URL/host (may be mismatch)')
    if (!source && (retailer === 'target' || retailer === 'walmart')) {
      console.log(
        '    likely cause: URL not in Gate 1 sources — publicRetailerLinks hid CTA (over-filter before fix if not in audit rows)',
      )
    }
  }
}

async function supersedeApproved(sb, table, productId) {
  const { data: rows, error } = await sb
    .from(table)
    .select('review_status')
    .eq('product_id', productId)
    .eq('review_status', 'approved')

  if (error) throw error
  if (!rows?.length) return 0

  // Immutability triggers allow approved → superseded only when payload fields are unchanged.
  const { error: updErr } = await sb
    .from(table)
    .update({ review_status: 'superseded' })
    .eq('product_id', productId)
    .eq('review_status', 'approved')

  if (updErr) throw updErr
  return rows.length
}

async function main() {
  const sb = createServiceClient()
  const { data: product, error } = await sb
    .from('products')
    .select(
      'product_id, product_name, agent_status, publish_status, active_evidence_id, amazon_url, affiliate_link, target_url, walmart_url',
    )
    .eq('product_name', LODGE_NAME)
    .maybeSingle()

  if (error) throw error
  if (!product) throw new Error(`Product not found: ${LODGE_NAME}`)

  let evidence = null
  if (product.active_evidence_id) {
    const { data: ev, error: evErr } = await sb
      .from('product_evidence')
      .select('evidence_id, review_status, sources, agent_metadata')
      .eq('evidence_id', product.active_evidence_id)
      .maybeSingle()
    if (evErr) throw evErr
    evidence = ev
  }

  console.log(apply ? 'APPLY — pause Lodge public readiness\n' : 'DRY RUN (pass --apply)\n')
  console.log(`${product.product_name} (${product.product_id})`)
  console.log(`  publish_status: ${product.publish_status}`)
  console.log(`  agent_status: ${product.agent_status}`)
  console.log(`  active_evidence_id: ${product.active_evidence_id ?? '(none)'}`)
  if (evidence) {
    console.log(`  Gate 1: ${evidence.review_status} (will NOT modify)`)
  }

  reportRetailerCtas(product, evidence)

  const { data: inputs } = await sb
    .from('scoring_inputs')
    .select('input_id, review_status')
    .eq('product_id', product.product_id)
  const { data: scores } = await sb
    .from('product_scores')
    .select('score_id, review_status')
    .eq('product_id', product.product_id)
  const { data: qa } = await sb
    .from('product_qa')
    .select('qa_id, review_status')
    .eq('product_id', product.product_id)

  console.log('\nDownstream rows:')
  for (const row of inputs ?? []) console.log(`  scoring_inputs ${row.input_id}: ${row.review_status}`)
  for (const row of scores ?? []) console.log(`  product_scores ${row.score_id}: ${row.review_status}`)
  for (const row of qa ?? []) console.log(`  product_qa ${row.qa_id}: ${row.review_status}`)

  if (!apply) {
    console.log('\nWould: publish_status → draft; supersede approved Gate 2/3/4; agent_status → evidence_approved')
    return
  }

  const nInputs = await supersedeApproved(sb, 'scoring_inputs', product.product_id)
  const nScores = await supersedeApproved(sb, 'product_scores', product.product_id)
  const nQa = await supersedeApproved(sb, 'product_qa', product.product_id)

  const { error: pubErr } = await sb
    .from('products')
    .update({
      publish_status: 'draft',
      published_at: null,
      agent_status: 'evidence_approved',
    })
    .eq('product_id', product.product_id)

  if (pubErr) throw pubErr

  console.log(`\nSuperseded: ${nInputs} scoring_inputs, ${nScores} product_scores, ${nQa} product_qa`)
  console.log('publish_status → draft; agent_status → evidence_approved')
}

main().catch((err) => {
  console.error(err.message ?? err)
  process.exit(1)
})
