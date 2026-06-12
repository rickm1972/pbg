#!/usr/bin/env node
/**
 * Gate 1 approval eligibility — proprietary review ack + external checks summary.
 * Run: npm run test:gate1-approval-eligibility
 */
import assert from 'node:assert/strict'
import { validateRequiredEvidence } from '../src/shared/required-evidence-matrix/validate-required-evidence.mjs'
import {
  computeGate1ApprovalBlockers,
  listIncompleteScoreDrivingExternalChecks,
  listScoreDrivingReviewAcknowledgments,
} from '../src/shared/agent1/gate1-approval-eligibility.mjs'
import {
  buildGate1ApprovalEligibilityHexCladV7Evidence,
  buildGate1ApprovalEligibilityHexCladV7Sources,
  buildGate1ApprovalEligibilityHexCladV7Structured,
} from '../src/shared/agent1/fixtures/gate1ApprovalEligibilityHexCladV7.fixture.mjs'

const sources = buildGate1ApprovalEligibilityHexCladV7Sources()
const structured = buildGate1ApprovalEligibilityHexCladV7Structured()
const evidence = buildGate1ApprovalEligibilityHexCladV7Evidence()

const liveValidation = validateRequiredEvidence(structured, sources)
structured.required_evidence_validation = liveValidation

// --- Live validation: no hard approval blockers from proprietary warning alone ---
assert.equal(liveValidation.summary.score_blocking_gaps, 0)
assert.equal(liveValidation.summary.non_score_gaps, 0)
assert.equal(liveValidation.summary.required_fields_complete, true)
assert.ok(liveValidation.summary.required_external_checks_complete)
assert.equal(liveValidation.summary.approval_blocked, false)
assert.ok(
  liveValidation.checklist_items.some(
    (i) => i.id === 'external.coated_product_lab_results' && i.status === 'passed',
  ),
)
const proprietaryItem = liveValidation.checklist_items.find(
  (i) => i.id === 'external.proprietary_coating_warning',
)
assert.equal(proprietaryItem?.status, 'review_required')
assert.equal(proprietaryItem?.severity, 'warning')
console.log('✓ HexClad v7 fixture: lab check passed, proprietary review is acknowledgment-only')

// --- External checks complete lists no incomplete score-driving externals ---
assert.equal(listIncompleteScoreDrivingExternalChecks(liveValidation).length, 0)
console.log('✓ external checks complete when only acknowledgment review remains')

// --- Without acknowledgment: blocked with explicit reason ---
const blocked = computeGate1ApprovalBlockers({
  structured,
  sources,
  warningsAcknowledged: true,
  requiredEvidenceReviewsAcknowledged: false,
  allFieldsConfirmed: true,
  canonicalReviewConfirmed: true,
})
assert.equal(blocked.canApprove, false)
assert.ok(
  blocked.reasons.some((r) => /acknowledge required evidence review/i.test(r)),
)
assert.ok(blocked.reasons.some((r) => /proprietary/i.test(r)))
console.log('✓ without proprietary acknowledgment, approval blocked with explicit reason')

// --- With acknowledgment: approvable ---
const eligible = computeGate1ApprovalBlockers({
  structured,
  sources,
  warningsAcknowledged: true,
  requiredEvidenceReviewsAcknowledged: true,
  allFieldsConfirmed: true,
  canonicalReviewConfirmed: true,
})
assert.equal(eligible.canApprove, true)
assert.equal(eligible.reasons.length, 0)
console.log('✓ with proprietary acknowledgment + canonical confirmed, approval enabled')

// --- Stale stored summary does not re-block when live validation is clean ---
structured.required_evidence_validation = {
  ...liveValidation,
  summary: { ...liveValidation.summary, approval_blocked: true },
  approval_blockers: [
    'Required evidence review: Proprietary / undisclosed coating flagged for review — stale',
  ],
}
const withStale = computeGate1ApprovalBlockers({
  structured,
  sources,
  warningsAcknowledged: true,
  requiredEvidenceReviewsAcknowledged: true,
  allFieldsConfirmed: true,
  canonicalReviewConfirmed: true,
})
assert.equal(withStale.canApprove, true)
console.log('✓ live recomputation ignores stale stored approval_blocked summary')

// --- Missing lab evidence: coated-product lab check fails ---
const noLab = structuredDeepClone(structured)
noLab.required_check_results = []
const noLabValidation = validateRequiredEvidence(noLab, sources)
const labItem = noLabValidation.checklist_items.find(
  (i) => i.id === 'external.coated_product_lab_results',
)
assert.notEqual(labItem?.status, 'passed')
console.log('✓ without lab evidence, coated-product lab check does not pass')

// --- Review ack items list ---
const ackItems = listScoreDrivingReviewAcknowledgments(liveValidation)
assert.ok(ackItems.some((i) => i.id === 'external.proprietary_coating_warning'))
console.log('✓ proprietary coating appears in review acknowledgment list')

console.log('\nAll Gate 1 approval eligibility tests passed.')

function structuredDeepClone(obj) {
  return JSON.parse(JSON.stringify(obj))
}
