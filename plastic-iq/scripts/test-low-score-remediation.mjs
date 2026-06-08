#!/usr/bin/env node
/**
 * Phase 4.5 remediation tests — T-Fal + Caraway only.
 * Run: npm run test:low-score-remediation
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { mkdtempSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import {
  remediateTfalAndCaraway,
  validateRemediatedSnapshot,
  assertRemediationPublicRender,
  assertBaselineImmutable,
  buildRickLowScoreReview,
} from '../src/lib/apr/lowScoreRemediation.ts'
import {
  REMEDIATION_TARGETS,
  STANDARD_METHODOLOGY_DISCLAIMER,
  TFAL_NEUTRAL_DESCRIPTION_OVERRIDE,
  REMEDIATION_REVIEWER_ID,
} from '../src/lib/apr/lowScoreRemediationConstants.ts'
import {
  configureDurableStore,
  getDurableStoreRootForTests,
} from '../src/lib/apr/durable/durableSnapshotWriter.node.ts'
import {
  clearDurableSnapshotLoaderCache,
  loadLatestApprovedSnapshotDurable,
  registerDurableFileStoreReader,
  simulateDurableStoreProcessRestart,
} from '../src/lib/apr/durable/durableSnapshotLoader.ts'
import { loadBundledLatestApprovedSnapshot } from '../src/lib/apr/durable/bundledDurableRegistry.ts'
import {
  loadPublishedBaselineSnapshotImmutable,
  loadPublishedDisplaySnapshot,
  resetPublishedSnapshotOverlayForTests,
} from '../src/lib/apr/publishedBaselineRegistry.ts'
import { hashPublishedDisplaySnapshot, assertPublishedSnapshotIntegrity } from '../src/lib/apr/publishedDisplaySnapshot.ts'
import { mergePublishedRenderPayload } from '../src/lib/apr/publishedRenderPayload.ts'
import { PUBLISHED_BASELINE_PRODUCT_IDS } from '../src/lib/apr/publishedBaselineIds.ts'
import tfalBaseline from '../src/lib/apr/published-baselines/t-fal.json' with { type: 'json' }
import carawayBaseline from '../src/lib/apr/published-baselines/caraway.json' with { type: 'json' }

const durableRoot = mkdtempSync(join(tmpdir(), 'pbg-low-score-remediation-'))
configureDurableStore({ rootDir: durableRoot })

const tfalBeforeHash = hashPublishedDisplaySnapshot(tfalBaseline)
const carawayBeforeHash = hashPublishedDisplaySnapshot(carawayBaseline)
const tfalBeforeDesc = tfalBaseline.display.product_description
const carawayBeforeDesc = carawayBaseline.display.product_description

// Remediate both products
const { tfal, caraway } = remediateTfalAndCaraway()
assert.equal(tfal.skipped, false)
assert.equal(caraway.skipped, false)

// T-Fal before/after
assert.ok(tfalBeforeDesc.includes('contradicts that marketing claim'))
assert.equal(tfal.new_snapshot.display.product_description, TFAL_NEUTRAL_DESCRIPTION_OVERRIDE)
assert.ok(!tfal.new_snapshot.display.product_description.includes('contradicts marketing'))
assert.ok(!tfal.new_snapshot.display.product_description.includes('non-toxic'))
console.log('✓ T-Fal: risky language replaced with neutral PTFE override')

// Caraway before/after
assert.equal(caraway.new_snapshot.display.product_description, carawayBeforeDesc)
assert.ok(!/confirmed chemical hazard/i.test(caraway.new_snapshot.display.product_description))
console.log('✓ Caraway: uncertainty-safe wording preserved')

// Standard disclaimer on both
for (const result of [tfal, caraway]) {
  assert.equal(result.new_snapshot.display.methodology_disclaimer, STANDARD_METHODOLOGY_DISCLAIMER)
  assert.ok(result.new_snapshot.display.low_score_last_reviewed_at?.trim())
}
console.log('✓ both: standard methodology disclaimer + review date metadata')

// Rick-approved review artifacts
for (const result of [tfal, caraway]) {
  assert.equal(result.review.reviewer_id, REMEDIATION_REVIEWER_ID)
  assert.equal(result.review.approval_status, 'approved')
  assert.equal(result.review.evidence_sufficiency, 'passed')
  assert.equal(result.review.language_safety, 'passed')
  assert.equal(result.review.low_score_gate_version, '4.5.0')
}
assert.ok(tfal.review.reviewer_notes.includes('no brand/marketing characterization'))
assert.ok(caraway.review.reviewer_notes.includes('no confirmed-hazard claim'))
console.log('✓ both: Rick-approved low-score publication review artifacts')

// Phase 4.5 gate passes
for (const [key, result] of [
  ['tfal', tfal],
  ['caraway', caraway],
]) {
  const gate = validateRemediatedSnapshot(result.new_snapshot, key, result.review)
  assert.equal(gate.applies, true, `${key} gate should apply`)
  assert.equal(gate.ok, true, `${key} gate failures: ${gate.failures.map((f) => f.message).join('; ')}`)
}
console.log('✓ both: Phase 4.5 negative-score publication gate passes')

// Scores unchanged
assert.equal(tfal.new_snapshot.score.pac_safety_score, 2)
assert.equal(caraway.new_snapshot.score.pac_safety_score, 66)
assert.equal(tfal.new_snapshot.score.tier, 'High Risk')
assert.equal(caraway.new_snapshot.score.tier, 'Caution')
console.log('✓ scores/tiers unchanged (T-Fal 2, Caraway 66)')

// Baseline immutability
assertBaselineImmutable('tfal', tfalBeforeHash)
assertBaselineImmutable('caraway', carawayBeforeHash)
assert.equal(
  hashPublishedDisplaySnapshot(loadPublishedBaselineSnapshotImmutable(REMEDIATION_TARGETS.tfal.product_id)),
  tfalBeforeHash,
)
assert.equal(
  hashPublishedDisplaySnapshot(loadPublishedBaselineSnapshotImmutable(REMEDIATION_TARGETS.caraway.product_id)),
  carawayBeforeHash,
)
assert.notEqual(tfal.new_snapshot.content_hash, tfalBeforeHash)
assert.notEqual(caraway.new_snapshot.content_hash, carawayBeforeHash)
console.log('✓ baselines immutable; new versions have distinct content_hashes')

// Latest-approved resolution
assert.notEqual(
  loadPublishedDisplaySnapshot(REMEDIATION_TARGETS.tfal.product_id).snapshot_id,
  tfalBaseline.snapshot_id,
)
assert.notEqual(
  loadPublishedDisplaySnapshot(REMEDIATION_TARGETS.caraway.product_id).snapshot_id,
  carawayBaseline.snapshot_id,
)
assertRemediationPublicRender('tfal')
assertRemediationPublicRender('caraway')
console.log('✓ public render uses latest durable approved snapshots')

// Lodge / All-Clad scores unchanged; immutable baselines preserved
const lodge = loadPublishedDisplaySnapshot(PUBLISHED_BASELINE_PRODUCT_IDS.lodge)
const allClad = loadPublishedDisplaySnapshot(PUBLISHED_BASELINE_PRODUCT_IDS.allClad)
assert.equal(lodge?.score.pac_safety_score, 99)
assert.equal(allClad?.score.pac_safety_score, 99)
assert.equal(
  loadPublishedBaselineSnapshotImmutable(PUBLISHED_BASELINE_PRODUCT_IDS.lodge)?.snapshot_id,
  'baseline-lodge',
)
assert.equal(
  loadPublishedBaselineSnapshotImmutable(PUBLISHED_BASELINE_PRODUCT_IDS.allClad)?.snapshot_id,
  'baseline-all-clad',
)
console.log('✓ Lodge and All-Clad scores unchanged; baseline JSON immutable')

// Restart survival
simulateDurableStoreProcessRestart()
assert.equal(
  loadPublishedDisplaySnapshot(REMEDIATION_TARGETS.tfal.product_id).display.product_description,
  TFAL_NEUTRAL_DESCRIPTION_OVERRIDE,
)
assert.equal(
  loadPublishedDisplaySnapshot(REMEDIATION_TARGETS.caraway.product_id).display.methodology_disclaimer,
  STANDARD_METHODOLOGY_DISCLAIMER,
)
assert.ok(existsSync(join(getDurableStoreRootForTests(), 'description-overrides.json')))
assert.ok(existsSync(join(getDurableStoreRootForTests(), 'approved-snapshots', 'index.json')))
console.log('✓ restart/cache clear — remediated snapshots reload from durable store')

// Baseline JSON files not overwritten
const tfalFile = readFileSync(join(process.cwd(), 'src/lib/apr/published-baselines/t-fal.json'), 'utf8')
const carawayFile = readFileSync(join(process.cwd(), 'src/lib/apr/published-baselines/caraway.json'), 'utf8')
assert.ok(tfalFile.includes('contradicts that marketing claim'))
assert.ok(!tfalFile.includes(STANDARD_METHODOLOGY_DISCLAIMER))
assert.ok(!carawayFile.includes(STANDARD_METHODOLOGY_DISCLAIMER))
console.log('✓ baseline JSON files not overwritten')

// Browser-safe bundled loader (no Node fs) resolves remediated snapshots
clearDurableSnapshotLoaderCache()
registerDurableFileStoreReader(null)
{
  const bundledTfal = loadBundledLatestApprovedSnapshot(REMEDIATION_TARGETS.tfal.product_id)
  assert.ok(bundledTfal)
  assert.ok(
    bundledTfal.record.display.product_description.includes('PTFE nonstick coating'),
  )
  assert.ok(
    !bundledTfal.record.display.product_description.includes('contradicts that marketing claim'),
  )
  assert.equal(
    loadLatestApprovedSnapshotDurable(REMEDIATION_TARGETS.tfal.product_id)?.snapshot_id,
    bundledTfal.meta.snapshot_id,
  )
}
console.log('✓ bundled durable registry resolves remediated snapshots without Node fs')

resetPublishedSnapshotOverlayForTests()

console.log('\nPhase 4.5 low-score remediation tests passed.')
