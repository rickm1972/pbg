#!/usr/bin/env node
/**
 * Recompute QA checks for an existing pending_review product_qa row (no full Agent 1–3 rerun).
 * Usage: node scripts/agent4/refresh-qa-checks.mjs --name "Lodge 10.25 Inch Cast Iron Skillet" --apply
 */
import { createServiceClient, fetchProductById, fetchProductByName } from '../agent1/supabase.mjs'
import {
  fetchApprovedEvidence,
  fetchApprovedScoringInputs,
  fetchScoreToAudit,
  fetchSubcategoryPeerScores,
  updateProductQa,
} from './supabase.mjs'
import { findExistingQaForScore } from './supabase.mjs'
import { runAllQaChecks } from './run-checks.mjs'
import { AGENT_VERSION, ALGORITHM_VERSION } from './constants.mjs'

function parseArgs(argv) {
  let productName
  let productId
  let apply = false
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--name' && argv[i + 1]) productName = argv[++i]
    else if (argv[i] === '--id' && argv[i + 1]) productId = argv[++i]
    else if (argv[i] === '--apply') apply = true
  }
  return { productName, productId, apply }
}

async function main() {
  const { productName, productId, apply } = parseArgs(process.argv)
  if (!productName && !productId) {
    console.error('Usage: node scripts/agent4/refresh-qa-checks.mjs --name "..." | --id <uuid> [--apply]')
    process.exit(1)
  }

  const sb = createServiceClient()
  const product = productId
    ? await fetchProductById(sb, productId)
    : await fetchProductByName(sb, productName)
  const evidence = await fetchApprovedEvidence(sb, product.product_id)
  const scoringInput = await fetchApprovedScoringInputs(sb, product.product_id)
  const score = await fetchScoreToAudit(sb, product.product_id)
  const existingQa = await findExistingQaForScore(sb, score.score_id)
  if (!existingQa) throw new Error('No product_qa row for this score')

  const peerRows = await fetchSubcategoryPeerScores(sb, product, score.score_id)
  const report = runAllQaChecks({
    product,
    evidence,
    scoringInput,
    score,
    peerScores: peerRows,
  })

  console.log('Product:', product.product_name, `(${product.product_id})`)
  console.log('Peers (current chain):', peerRows.length)
  console.log(
    'Peer filter: products.active=true, same subcategory, active_evidence_id → approved product_evidence → approved scoring_inputs → approved product_scores (excludes self score)',
  )
  for (const p of peerRows) {
    console.log(`  - ${p.product.product_name}: ${p.score.pac_safety_score} ${p.score.tier}`)
  }
  console.log('score_sanity:', JSON.stringify(report.checks.score_sanity, null, 2))
  console.log('explanation_accuracy:', report.checks.explanation_accuracy.status, report.checks.explanation_accuracy.issues ?? [])
  console.log('overall:', report.overall_status)
  const flagged = Object.entries(report.checks).filter(([, c]) => c.status === 'flag')
  if (flagged.length) {
    for (const [key, check] of flagged) {
      for (const f of check.flags ?? []) console.log(`  FLAG ${key}: [${f.code}] ${f.message}`)
    }
  }

  if (!apply) {
    console.log('\nPass --apply to update product_qa', existingQa.qa_id)
    return
  }

  await updateProductQa(sb, existingQa.qa_id, {
    evidence_id: evidence.evidence_id,
    input_id: scoringInput.input_id,
    score_id: score.score_id,
    algorithm_version: ALGORITHM_VERSION,
    agent_version: AGENT_VERSION,
    overall_status: report.overall_status,
    human_review_required: true,
    checks: report.checks,
    certifications_verified: report.certifications_verified,
    review_status: 'pending_review',
    warnings: report.warnings ?? [],
    run_timestamp: new Date().toISOString(),
  })
  console.log('Updated', existingQa.qa_id)
}

main().catch((e) => {
  console.error(e.message ?? e)
  process.exit(1)
})
