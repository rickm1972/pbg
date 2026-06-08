#!/usr/bin/env node
/**
 * Inspect score-sanity peers for a product (current vs legacy chain).
 * Usage: node scripts/agent4/inspect-score-sanity-peers.mjs --name "Lodge 10.25 Inch Cast Iron Skillet"
 */
import { createServiceClient, fetchProductByName } from '../agent1/supabase.mjs'
import { fetchSubcategoryPeerScores } from './supabase.mjs'

function parseArgs(argv) {
  let productName
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--name' && argv[i + 1]) productName = argv[++i]
  }
  return { productName }
}

async function loadProductChain(sb, productId) {
  const { data: product } = await sb
    .from('products')
    .select(
      'product_id, product_name, category, subcategory, agent_status, publish_status, active, active_evidence_id, created_at, updated_at',
    )
    .eq('product_id', productId)
    .maybeSingle()

  const { data: evidenceRows } = await sb
    .from('product_evidence')
    .select('evidence_id, review_status, bundle_version, algorithm_version, approved_at, created_at')
    .eq('product_id', productId)
    .order('bundle_version', { ascending: false })

  const { data: inputRows } = await sb
    .from('scoring_inputs')
    .select('input_id, evidence_id, review_status, bundle_version, approved_at, created_at')
    .eq('product_id', productId)
    .order('bundle_version', { ascending: false })

  const { data: scoreRows } = await sb
    .from('product_scores')
    .select('score_id, input_id, review_status, pac_safety_score, tier, run_timestamp, created_at')
    .eq('product_id', productId)
    .order('run_timestamp', { ascending: false })

  const { data: qaRows } = await sb
    .from('product_qa')
    .select('qa_id, score_id, review_status, run_timestamp')
    .eq('product_id', productId)
    .order('run_timestamp', { ascending: false })
    .limit(3)

  return { product, evidenceRows, inputRows, scoreRows, qaRows }
}

function chainValid(product, evidenceRows, inputRows, scoreRow) {
  const activeEvidenceId = product?.active_evidence_id
  const approvedEvidence = evidenceRows?.find((e) => e.review_status === 'approved')
  const activeEvidence = evidenceRows?.find((e) => e.evidence_id === activeEvidenceId)
  const input = inputRows?.find((i) => i.input_id === scoreRow?.input_id)
  const approvedInput = inputRows?.find((i) => i.review_status === 'approved')

  const issues = []
  if (!product?.active) issues.push('product inactive')
  if (scoreRow?.review_status !== 'approved') issues.push(`score ${scoreRow?.review_status}`)
  if (!input || input.review_status !== 'approved') issues.push('input not approved')
  if (activeEvidenceId && input?.evidence_id !== activeEvidenceId) {
    issues.push(`input.evidence_id ${input?.evidence_id?.slice(0, 8)} ≠ active_evidence ${activeEvidenceId?.slice(0, 8)}`)
  }
  if (activeEvidenceId && activeEvidence?.review_status !== 'approved') {
    issues.push('active_evidence not approved')
  }
  if (!activeEvidenceId && !approvedEvidence) issues.push('no approved/active evidence')

  return {
    valid: issues.length === 0,
    issues,
    activeEvidenceId,
    inputEvidenceId: input?.evidence_id,
    approvedEvidenceId: approvedEvidence?.evidence_id,
  }
}

async function main() {
  const { productName } = parseArgs(process.argv)
  if (!productName) {
    console.error('Usage: --name "Product name"')
    process.exit(1)
  }

  const sb = createServiceClient()
  const product = await fetchProductByName(sb, productName)
  const chain = await loadProductChain(sb, product.product_id)
  const scoreToAudit =
    chain.scoreRows?.find((s) => s.review_status === 'pending_review') ??
    chain.scoreRows?.find((s) => s.review_status === 'approved')

  console.log('\n=== Subject ===')
  console.log(product.product_name, product.product_id)
  console.log('subcategory:', product.subcategory)
  console.log('publish_status:', chain.product?.publish_status, 'active:', chain.product?.active)
  console.log('active_evidence_id:', chain.product?.active_evidence_id)

  const peerRows = await fetchSubcategoryPeerScores(sb, product, scoreToAudit?.score_id)
  console.log('\n=== Current fetchSubcategoryPeerScores (', peerRows.length, 'peers) ===')

  for (const row of peerRows) {
    const pid = row.score.product_id
    const detail = await loadProductChain(sb, pid)
    const p = detail.product
    const cv = chainValid(p, detail.evidenceRows, detail.inputRows, row.score)
    console.log('\n---', p?.product_name)
    console.log('  product_id:', pid)
    console.log('  score:', row.score.pac_safety_score, row.score.tier, 'score_id:', row.score.score_id)
    console.log('  score review_status:', row.score.review_status)
    console.log('  input_id:', row.score.input_id)
    console.log('  publish_status:', p?.publish_status, 'active:', p?.active)
    console.log('  agent_status:', p?.agent_status)
    console.log('  active_evidence_id:', p?.active_evidence_id)
    console.log('  chain valid (strict):', cv.valid, cv.issues.length ? cv.issues : 'ok')
  }

  const { data: qa } = await sb
    .from('product_qa')
    .select('qa_id, checks, score_id, review_status')
    .eq('product_id', product.product_id)
    .order('run_timestamp', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (qa?.checks?.score_sanity) {
    console.log('\n=== Stored QA score_sanity ===')
    console.log(JSON.stringify(qa.checks.score_sanity, null, 2))
  }
}

main().catch((e) => {
  console.error(e.message ?? e)
  process.exit(1)
})
