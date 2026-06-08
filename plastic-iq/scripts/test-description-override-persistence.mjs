#!/usr/bin/env node
/**
 * Part C.1 — restart-survival persistence test for description overrides + approved snapshots.
 * Run: npm run test:description-override:persistence
 */
import assert from 'node:assert/strict'
import { mkdtempSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  approveDescriptionOverride,
  getPublicProductDescriptionFromSnapshot,
  saveDescriptionOverrideDraft,
  submitDescriptionOverrideForReview,
} from '../src/lib/apr/descriptionOverride.ts'
import {
  hashPublishedDisplaySnapshot,
  assertPublishedSnapshotIntegrity,
} from '../src/lib/apr/publishedDisplaySnapshot.ts'
import {
  loadPublishedBaselineSnapshotImmutable,
  loadPublishedDisplaySnapshot,
  registerTestPublishedSnapshot,
  resetPublishedSnapshotOverlayForTests,
} from '../src/lib/apr/publishedBaselineRegistry.ts'
import { mergePublishedRenderPayload } from '../src/lib/apr/publishedRenderPayload.ts'
import { listLatestApprovedSnapshotsForDiffGate } from '../src/lib/apr/publishedBaselineRegistry.ts'
import {
  configureDurableStore,
  getDurableStoreRootForTests,
} from '../src/lib/apr/durable/durableSnapshotWriter.node.ts'
import { simulateDurableStoreProcessRestart } from '../src/lib/apr/durable/durableSnapshotLoader.ts'
import { simulateDurableStoreProcessRestart as simulateFromOverrideStore } from '../src/lib/apr/descriptionOverrideStore.ts'
import {
  FIXTURE_DESC_OVERRIDE_PTFE_PRODUCT_ID,
  PTFE_SAFE_OVERRIDE_TEXT,
  buildPtfeDescriptionOverrideFixtureSnapshot,
} from '../src/lib/apr/fixtures/descriptionOverride.fixture.ts'
import { buildApprovedLowScoreReview } from '../src/lib/apr/fixtures/lowScoreReview.ts'

const durableRoot = mkdtempSync(join(tmpdir(), 'pbg-durable-persist-'))
configureDurableStore({ rootDir: durableRoot })

function seedFixtureBaseline() {
  const snap = buildPtfeDescriptionOverrideFixtureSnapshot()
  registerTestPublishedSnapshot(snap)
  return snap
}

// 1–5: create, approve, confirm public render
const baseline = seedFixtureBaseline()
const baselineHash = hashPublishedDisplaySnapshot(baseline)
const baselineDesc = baseline.display.product_description

const draft = saveDescriptionOverrideDraft({
  product_id: FIXTURE_DESC_OVERRIDE_PTFE_PRODUCT_ID,
  proposed_override_text: PTFE_SAFE_OVERRIDE_TEXT,
  created_by: 'persistence-test',
})
submitDescriptionOverrideForReview(draft.override_id)

const review = buildApprovedLowScoreReview({
  score: baseline.score.pac_safety_score,
  primary_score_driving_concern: 'PTFE nonstick coating',
})

const { new_snapshot } = approveDescriptionOverride(draft.override_id, {
  reviewer_id: 'persistence-test-reviewer',
  low_score_publication_review: review,
})

assert.equal(getPublicProductDescriptionFromSnapshot(FIXTURE_DESC_OVERRIDE_PTFE_PRODUCT_ID), PTFE_SAFE_OVERRIDE_TEXT)
assert.notEqual(new_snapshot.snapshot_id, baseline.snapshot_id)

const renderBefore = mergePublishedRenderPayload(
  loadPublishedDisplaySnapshot(FIXTURE_DESC_OVERRIDE_PTFE_PRODUCT_ID),
  [],
)
assert.equal(renderBefore.display.product_description, PTFE_SAFE_OVERRIDE_TEXT)
console.log('✓ steps 1–5: draft → approve → public render shows override')

// 6–7: simulate restart — clear memory caches, reload durable files
simulateDurableStoreProcessRestart()
simulateFromOverrideStore()

// Re-seed fixture baseline only (simulates immutable JSON surviving restart)
registerTestPublishedSnapshot(baseline)

assert.ok(existsSync(join(getDurableStoreRootForTests(), 'description-overrides.json')))
assert.ok(existsSync(join(getDurableStoreRootForTests(), 'approved-snapshots', 'index.json')))

// 8: public render still shows override after reload
const publicAfterRestart = getPublicProductDescriptionFromSnapshot(FIXTURE_DESC_OVERRIDE_PTFE_PRODUCT_ID)
assert.equal(publicAfterRestart, PTFE_SAFE_OVERRIDE_TEXT)

const renderAfter = mergePublishedRenderPayload(
  loadPublishedDisplaySnapshot(FIXTURE_DESC_OVERRIDE_PTFE_PRODUCT_ID),
  [],
)
assert.equal(renderAfter.display.product_description, PTFE_SAFE_OVERRIDE_TEXT)
console.log('✓ steps 6–8: restart simulation — override survives, public render unchanged')

// 9: baseline immutable
const immutable = loadPublishedBaselineSnapshotImmutable(FIXTURE_DESC_OVERRIDE_PTFE_PRODUCT_ID)
assert.equal(hashPublishedDisplaySnapshot(immutable), baselineHash)
assert.equal(immutable.display.product_description, baselineDesc)
console.log('✓ step 9: baseline snapshot content hash unchanged')

// 10: latest-approved resolution + integrity (same path diff-gate uses for baseline products)
const latest = loadPublishedDisplaySnapshot(FIXTURE_DESC_OVERRIDE_PTFE_PRODUCT_ID)
assert.equal(assertPublishedSnapshotIntegrity(latest).valid, true)
assert.equal(latest.display.product_description, PTFE_SAFE_OVERRIDE_TEXT)
assert.equal(listLatestApprovedSnapshotsForDiffGate().length, 4)
console.log('✓ step 10: latest-approved integrity valid after reload; baseline list unchanged')

// Cleanup temp durable root
resetPublishedSnapshotOverlayForTests()

console.log('\nPart C.1 persistence tests passed.')
