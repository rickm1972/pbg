import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { projectRoot } from '../lib/env.mjs'
import { runAllQaChecks, formatQaReport } from './run-checks.mjs'
import { AGENT_VERSION, ALGORITHM_VERSION } from './constants.mjs'
import {
  createServiceClient,
  fetchApprovedEvidence,
  fetchApprovedScoringInputs,
  fetchProductById,
  fetchProductByName,
  fetchScoreToAudit,
  fetchSubcategoryPeerScores,
  findExistingQaForScore,
  insertProductQa,
  updateAgentStatus,
} from './supabase.mjs'

const CAN_RUN_STATUSES = new Set([
  'scoring_review_pending',
  'scoring_approved',
  'qa_pending',
  'qa_awaiting_review',
])

export async function runAgent4({
  productId,
  productName,
  scoreId,
  dryRun = false,
  replaceExisting = false,
}) {
  const supabase = createServiceClient()
  const product = productId
    ? await fetchProductById(supabase, productId)
    : await fetchProductByName(supabase, productName)

  const id = product.product_id
  console.log(`\n=== Agent 4 QA: ${product.product_name} (${id}) ===\n`)

  if (!CAN_RUN_STATUSES.has(product.agent_status)) {
    const reason = `Agent 4 requires scoring_review_pending, scoring_approved, qa_pending, or qa_awaiting_review (current: ${product.agent_status})`
    console.log(`Stopped: ${reason}`)
    return { ok: false, product, reason }
  }

  const evidence = await fetchApprovedEvidence(supabase, id)
  const scoringInput = await fetchApprovedScoringInputs(supabase, id)
  const score = await fetchScoreToAudit(supabase, id, scoreId)

  const existingQa = await findExistingQaForScore(supabase, score.score_id)
  if (existingQa && !replaceExisting) {
    const reason = `QA report already exists for score ${score.score_id} (qa_id ${existingQa.qa_id}). Use --replace to supersede.`
    console.log(`Stopped: ${reason}`)
    return { ok: false, product, reason, existingQa }
  }

  if (!dryRun) {
    await updateAgentStatus(supabase, id, 'qa_in_progress')
    console.log('agent_status → qa_in_progress')
  }

  const peerRows = await fetchSubcategoryPeerScores(supabase, product, score.score_id)
  const peerScores = peerRows.map((p) => ({
    score: p.score,
    inputs: p.inputs,
  }))

  console.log(
    `Loaded: evidence ${evidence.evidence_id}, input ${scoringInput.input_id}, score ${score.score_id} (${score.pac_safety_score} ${score.tier})`,
  )
  console.log(`Subcategory peers (approved): ${peerScores.length}`)

  const report = runAllQaChecks({
    product,
    evidence,
    scoringInput,
    score,
    peerScores,
  })

  console.log('\n' + formatQaReport(report))

  if (dryRun) {
    return {
      ok: true,
      product,
      evidence,
      scoringInput,
      score,
      report,
      dryRun: true,
    }
  }

  if (existingQa && replaceExisting) {
    await supabase
      .from('product_qa')
      .update({ review_status: 'superseded' })
      .eq('qa_id', existingQa.qa_id)
  }

  const qaRow = await insertProductQa(supabase, {
    product_id: id,
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
    warnings: report.warnings,
  })

  await updateAgentStatus(supabase, id, 'qa_awaiting_review')
  console.log(`\nSaved product_qa (${qaRow.qa_id}) → qa_awaiting_review`)

  const outDir = join(projectRoot, 'scripts/output')
  mkdirSync(outDir, { recursive: true })
  const outPath = join(outDir, `agent4-${id}.json`)
  writeFileSync(
    outPath,
    JSON.stringify({ product, evidence, scoringInput, score, report, qaRow }, null, 2),
    'utf8',
  )
  console.log(`  output: ${outPath}`)

  return { ok: true, product, evidence, scoringInput, score, report, qaRow }
}

export function formatQaSummary(run) {
  if (!run.ok) {
    return `Agent 4 stopped: ${run.reason ?? 'unknown error'}`
  }
  const r = run.report
  return [
    `Product: ${run.product.product_name}`,
    `Overall: ${r.overall_status}`,
    `Human review required: ${r.human_review_required}`,
    `Certifications verified: ${r.certifications_verified?.length ?? 0}`,
    ...Object.entries(r.checks).map(([k, c]) => `  ${k}: ${c.status}`),
  ].join('\n')
}
