#!/usr/bin/env node
/**
 * GreenPan Gate 1 v7 — approvable after acknowledgments when lab evidence is optional.
 * Run: npm run test:greenpan-gate1-approval-eligibility
 */
import assert from 'node:assert/strict'
import { validateRequiredEvidence } from '../src/shared/required-evidence-matrix/validate-required-evidence.mjs'
import { computeGate1ApprovalBlockers } from '../src/shared/agent1/gate1-approval-eligibility.mjs'
import { getGate1ContradictionBlockers } from '../src/shared/agent1/gate1-contradiction-blockers.mjs'
import { extractManufacturerPublishedLabTesting } from '../src/shared/agent2/manufacturer-lab-testing-evidence.mjs'
import {
  buildGate1ApprovalEligibilityGreenPanV7Sources,
  buildGate1ApprovalEligibilityGreenPanV7Structured,
} from '../src/shared/agent1/fixtures/gate1ApprovalEligibilityGreenPanV7.fixture.mjs'

const sources = buildGate1ApprovalEligibilityGreenPanV7Sources()
const structured = buildGate1ApprovalEligibilityGreenPanV7Structured()
const validation = validateRequiredEvidence(structured, sources)
structured.required_evidence_validation = validation

assert.equal(validation.subcategory_key, 'cookware')
assert.equal(validation.summary.score_blocking_gaps, 0)
assert.equal(validation.summary.approval_blocked, false)
assert.ok(validation.summary.required_fields_complete)
assert.ok(validation.summary.required_external_checks_complete)
assert.ok(validation.summary.product_identity_verified)

const labItem = validation.checklist_items.find((i) => i.id === 'external.coated_product_lab_results')
assert.equal(labItem?.status, 'review_required')
assert.match(labItem?.detail ?? '', /LAB_RESULTS_LINK_NOT_RETRIEVED/i)
console.log('✓ GreenPan matrix complete with visible LAB_RESULTS_LINK_NOT_RETRIEVED warning')

const contradictionBlockers = getGate1ContradictionBlockers(structured)
assert.ok(!contradictionBlockers.some((b) => /LAB_RESULTS_LINK_NOT_RETRIEVED/i.test(b)))
console.log('✓ LAB_RESULTS_LINK_NOT_RETRIEVED is not a hidden contradiction blocker')

const evidence = {
  evidence_id: 'fixture',
  product_id: 'fixture',
  bundle_version: 7,
  review_status: 'pending_review',
  sources,
  facts: [],
  agent_metadata: {
    structured_evidence: structured,
    warnings: structured.agent1_source_validation.warnings,
  },
}

const blockedNoAck = computeGate1ApprovalBlockers({
  structured,
  sources,
  warnings: evidence.agent_metadata.warnings,
  warningsAcknowledged: false,
  requiredEvidenceReviewsAcknowledged: true,
  allFieldsConfirmed: true,
  canonicalReviewConfirmed: true,
})
assert.equal(blockedNoAck.canApprove, false)
assert.ok(blockedNoAck.reasons.some((r) => /acknowledge validation warnings/i.test(r)))
console.log('✓ without warning acknowledgment, approval blocked with explicit reason')

const eligible = computeGate1ApprovalBlockers({
  structured,
  sources,
  warnings: evidence.agent_metadata.warnings,
  warningsAcknowledged: true,
  requiredEvidenceReviewsAcknowledged: true,
  allFieldsConfirmed: true,
  canonicalReviewConfirmed: true,
})
assert.equal(eligible.canApprove, true, eligible.reasons.join('; '))
console.log('✓ GreenPan-like Gate 1 approvable after warnings + canonical acknowledgment')

const gate2Lab = extractManufacturerPublishedLabTesting({
  sources,
  agent_metadata: { structured_evidence: structured },
})
assert.equal(gate2Lab.testing_evidence_present, false)
console.log('✓ no lab evidence carries forward to Gate 2')

console.log('\nGreenPan Gate 1 approval eligibility tests passed.')
