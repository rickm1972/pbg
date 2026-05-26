import { AGENT_VERSION, ALGORITHM_VERSION } from './constants.mjs'
import { runCertificationAudit } from './checks/certification-audit.mjs'
import { runLayer4aAudit } from './checks/layer4a-audit.mjs'
import { runScoreSanity } from './checks/score-sanity.mjs'
import { runEvidenceGaps } from './checks/evidence-gaps.mjs'
import { runExplanationAccuracy } from './checks/explanation-accuracy.mjs'

function deriveOverallStatus(checks) {
  const statuses = Object.values(checks).map((c) => c?.status)
  if (statuses.includes('error')) return 'error'
  if (statuses.includes('flag')) return 'flag'
  return 'pass'
}

/**
 * Run all five QA checks (read-only).
 * @param {{ product: object, evidence: object, scoringInput: object, score: object, peerScores: object[] }} ctx
 */
export function runAllQaChecks(ctx) {
  const { product, evidence, scoringInput, score, peerScores } = ctx
  const inputs = scoringInput.inputs

  const certification_audit = runCertificationAudit(evidence)
  const layer_4a_audit = runLayer4aAudit(inputs)
  const score_sanity = runScoreSanity({
    product,
    inputs,
    score,
    peerScores,
  })
  const evidence_gaps = runEvidenceGaps(inputs, evidence)
  const explanation_accuracy = runExplanationAccuracy(score, inputs, scoringInput)

  const checks = {
    certification_audit,
    layer_4a_audit,
    score_sanity,
    evidence_gaps,
    explanation_accuracy,
  }

  const overall_status = deriveOverallStatus(checks)
  const certifications_verified = (certification_audit.certifications_verified ?? []).map(
    (row) => ({
      certification_name: row.certification_name,
      source_url: row.source_url,
      found_in_page_content: row.found_in_page_content,
      product_level: row.product_level,
      action_taken: row.action_taken,
    }),
  )

  return {
    agent_version: AGENT_VERSION,
    algorithm_version: ALGORITHM_VERSION,
    overall_status,
    human_review_required: true,
    checks,
    certifications_verified,
    warnings: [],
  }
}

export function formatQaReport(report) {
  const lines = [
    `Overall: ${report.overall_status} (human review required: ${report.human_review_required})`,
    '',
  ]
  for (const [key, check] of Object.entries(report.checks)) {
    lines.push(`${key}: ${check.status}`)
    for (const flag of check.flags ?? []) {
      lines.push(`  - [${flag.code}] ${flag.message}`)
    }
    lines.push('')
  }
  if (report.certifications_verified?.length) {
    lines.push(`Certifications verified (pass): ${report.certifications_verified.length}`)
  }
  return lines.join('\n')
}
