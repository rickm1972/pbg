#!/usr/bin/env node
/**
 * All six frozen published products — diff-gate list + baseline immutability.
 * Run: npm run test:published-page-freeze-invariant
 */
import assert from 'node:assert/strict'
import {
  listLatestApprovedSnapshotsForDiffGate,
  loadPublishedBaselineSnapshotImmutable,
  PUBLISHED_BASELINE_PRODUCT_IDS,
} from '../src/lib/apr/publishedBaselineRegistry.ts'
import { listAllFrozenPublishedProductIds } from '../src/lib/apr/publishedFrozenProductRegistry.ts'
import { assertPublishedSnapshotIntegrity } from '../src/lib/apr/publishedDisplaySnapshot.ts'

assert.equal(listAllFrozenPublishedProductIds().length, 6)

const gateSnapshots = listLatestApprovedSnapshotsForDiffGate()
assert.equal(gateSnapshots.length, 6)

for (const snap of gateSnapshots) {
  assert.equal(assertPublishedSnapshotIntegrity(snap).valid, true)
}

for (const id of Object.values(PUBLISHED_BASELINE_PRODUCT_IDS)) {
  const baseline = loadPublishedBaselineSnapshotImmutable(id)
  assert.ok(baseline, `baseline immutable for ${id}`)
  const latest = gateSnapshots.find((s) => s.product_id === id)
  assert.ok(latest)
  assert.ok(latest.score.pac_safety_score >= 0)
}

console.log('✓ six-product freeze invariant for diff-gate')
