#!/usr/bin/env node
/**
 * Published display regression diff gate.
 * A) Snapshot integrity (content hash, no commerce in freeze)
 * B) Snapshot score/tier/range/badge aligned with approved DB/Gate 3 truth
 *
 * Run: npm run diff-gate:published
 */
import assert from 'node:assert/strict'
import { createServiceClient } from './agent1/supabase.mjs'
import {
  assertPublishedSnapshotIntegrity,
} from '../src/lib/apr/publishedDisplaySnapshot.ts'
import {
  assertPublishedSnapshotMatchesApprovedTruth,
  loadApprovedPublishedScoreTruth,
} from '../src/lib/apr/approvedPublishedTruth.ts'
import { listPublishedBaselineSnapshots } from '../src/lib/apr/publishedBaselineRegistry.ts'

const sb = createServiceClient()
const snapshots = listPublishedBaselineSnapshots()
const truthErrors = []

for (const snapshot of snapshots) {
  const integrity = assertPublishedSnapshotIntegrity(snapshot)
  if (!integrity.valid) {
    console.error(`Snapshot integrity failed for ${snapshot.product_id}: ${integrity.reason}`)
    process.exit(1)
  }

  let approved
  try {
    approved = await loadApprovedPublishedScoreTruth(sb, snapshot.product_id)
  } catch (err) {
    truthErrors.push({
      product_id: snapshot.product_id,
      error: err instanceof Error ? err.message : String(err),
    })
    continue
  }

  try {
    assertPublishedSnapshotMatchesApprovedTruth(snapshot, approved)
  } catch (err) {
    truthErrors.push({
      product_id: snapshot.product_id,
      snapshot_score: snapshot.score.pac_safety_score,
      approved_score: approved.pac_safety_score,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

if (truthErrors.length > 0) {
  console.error('Published display regression gate FAILED — snapshot vs approved truth:\n')
  console.error(JSON.stringify(truthErrors, null, 2))
  process.exit(1)
}

console.log(
  `✓ diff gate passed — ${snapshots.length} published baselines integrity + approved truth alignment`,
)
