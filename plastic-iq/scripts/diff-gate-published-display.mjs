#!/usr/bin/env node
/**
 * Published display regression diff gate.
 * Uses latest-approved snapshot resolution (durable override version if any, else baseline JSON).
 *
 * Run: npm run diff-gate:published
 */
import { createServiceClient } from './agent1/supabase.mjs'
import { runPublishedDisplayDiffGate } from '../src/lib/apr/publishedDiffGate.ts'
import { listLatestApprovedSnapshotsForDiffGate } from '../src/lib/apr/publishedBaselineRegistry.ts'

const sb = createServiceClient()
const snapshots = listLatestApprovedSnapshotsForDiffGate()
const failures = await runPublishedDisplayDiffGate(sb)

if (failures.length > 0) {
  console.error('Published display regression gate FAILED:\n')
  console.error(JSON.stringify(failures, null, 2))
  process.exit(1)
}

console.log(
  `✓ diff gate passed — ${snapshots.length} latest-approved snapshots integrity + approved truth alignment`,
)
