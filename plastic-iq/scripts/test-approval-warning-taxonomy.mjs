#!/usr/bin/env node
/**
 * Gate 1 approval gating contract — hard blockers vs acknowledgment warnings.
 * Run: npm run test:approval-warning-taxonomy
 */
import assert from 'node:assert/strict'
import {
  ACKNOWLEDGMENT_WARNING_CODES,
  HARD_APPROVAL_BLOCKER_CODES,
  collectGate1AcknowledgmentWarnings,
  filterHardApprovalBlockers,
  isAcknowledgmentWarningMessage,
  isHardApprovalBlockerMessage,
} from '../src/shared/agent1/approval-gating-contract.mjs'
import { getAgent1SourceValidationBlockers } from '../src/shared/agent1/gate1-source-validation.mjs'
import { getGate1ContradictionBlockers } from '../src/shared/agent1/gate1-contradiction-blockers.mjs'
import { buildGate1ApprovalEligibilityGreenPanV7Structured } from '../src/shared/agent1/fixtures/gate1ApprovalEligibilityGreenPanV7.fixture.mjs'

for (const code of [
  'LAB_RESULTS_LINK_NOT_RETRIEVED',
  'NO_THIRD_PARTY_TESTING_FOUND',
  'MANUFACTURER_PDP_NOT_VALIDATED',
]) {
  assert.ok(ACKNOWLEDGMENT_WARNING_CODES.has(code), `${code} is acknowledgment-only`)
  assert.ok(
    isAcknowledgmentWarningMessage(`${code}: example detail`),
    `${code} classified as acknowledgment`,
  )
  assert.equal(
    isHardApprovalBlockerMessage(`${code}: example detail`),
    false,
    `${code} must not hard-block`,
  )
}
console.log('✓ optional lab / PDP codes are acknowledgment warnings, not hard blockers')

for (const code of ['MANUFACTURER_MATERIAL_EVIDENCE_MISSING', 'category_config_required']) {
  assert.ok(HARD_APPROVAL_BLOCKER_CODES.has(code), `${code} is hard blocker`)
  assert.ok(
    isHardApprovalBlockerMessage(`${code}: example detail`),
    `${code} classified as hard blocker`,
  )
}
assert.ok(
  isHardApprovalBlockerMessage('Required evidence: Primary contact material (canonical) — missing'),
)
assert.ok(isHardApprovalBlockerMessage('Contradiction: PTFE vs PFAS-free'))
assert.ok(isHardApprovalBlockerMessage('category config required: no registry config'))
console.log('✓ required canonical / category / contradiction messages remain hard blockers')

const mixed = [
  'LAB_RESULTS_LINK_NOT_RETRIEVED: linked report not retrieved',
  'MANUFACTURER_MATERIAL_EVIDENCE_MISSING: no validated PDP',
  'NO_THIRD_PARTY_TESTING_FOUND: targeted search found nothing',
]
assert.deepEqual(filterHardApprovalBlockers(mixed), [mixed[1]])
console.log('✓ filterHardApprovalBlockers keeps only hard blockers')

const greenPan = buildGate1ApprovalEligibilityGreenPanV7Structured()
const gateBlockers = getGate1ContradictionBlockers(greenPan)
assert.ok(
  !gateBlockers.some((b) => b.includes('LAB_RESULTS_LINK_NOT_RETRIEVED')),
  'legacy stored LAB_RESULTS blocker must not surface as Gate 1 contradiction blocker',
)
assert.equal(getAgent1SourceValidationBlockers(greenPan).length, 0)

const ackWarnings = collectGate1AcknowledgmentWarnings({
  warnings: [],
  structured_evidence: greenPan,
})
assert.ok(ackWarnings.some((w) => w.includes('LAB_RESULTS_LINK_NOT_RETRIEVED')))
assert.ok(ackWarnings.some((w) => w.includes('NO_THIRD_PARTY_TESTING_FOUND')))
console.log('✓ legacy GreenPan v7 lab warnings collected for acknowledgment UI')

console.log('\nApproval warning taxonomy tests passed.')
