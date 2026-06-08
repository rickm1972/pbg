#!/usr/bin/env node
/**
 * Phase 4.5 remediation — T-Fal + Caraway durable override workflow.
 * Run: npm run remediate:low-score-published
 */
import { execSync } from 'node:child_process'
import { remediateTfalAndCaraway } from '../src/lib/apr/lowScoreRemediation.ts'
import { getDurableStoreRootForTests } from '../src/lib/apr/durable/durableSnapshotWriter.node.ts'

const { tfal, caraway } = remediateTfalAndCaraway()
execSync('node scripts/sync-bundled-durable-snapshots.mjs', { stdio: 'inherit', cwd: process.cwd() })

console.log('Phase 4.5 low-score remediation complete')
console.log(`Durable store: ${getDurableStoreRootForTests()}`)
console.log(
  JSON.stringify(
    {
      tfal: {
        skipped: tfal.skipped,
        baseline_snapshot_id: tfal.baseline.snapshot_id,
        baseline_content_hash: tfal.baseline.content_hash,
        new_snapshot_id: tfal.new_snapshot.snapshot_id,
        new_content_hash: tfal.new_snapshot.content_hash,
        reviewer: tfal.review.reviewer_id,
      },
      caraway: {
        skipped: caraway.skipped,
        baseline_snapshot_id: caraway.baseline.snapshot_id,
        baseline_content_hash: caraway.baseline.content_hash,
        new_snapshot_id: caraway.new_snapshot.snapshot_id,
        new_content_hash: caraway.new_snapshot.content_hash,
        reviewer: caraway.review.reviewer_id,
      },
    },
    null,
    2,
  ),
)
