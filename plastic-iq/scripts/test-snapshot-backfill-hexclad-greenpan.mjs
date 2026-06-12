#!/usr/bin/env node
/**
 * HexClad + GreenPan frozen snapshot posture after backfill.
 * Run: npm run test:snapshot-backfill-hexclad-greenpan
 */
import assert from 'node:assert/strict'
import {
  PUBLISHED_FROZEN_PRODUCT_IDS,
  PUBLISHED_FROZEN_PRODUCT_SPECS,
} from '../src/lib/apr/publishedFrozenProductRegistry.ts'
import { loadPublishedDisplaySnapshot } from '../src/lib/apr/publishedBaselineRegistry.ts'
import { getDescriptionOverrideState } from '../src/lib/apr/descriptionOverride.ts'
import { assertPublishedSnapshotIntegrity } from '../src/lib/apr/publishedDisplaySnapshot.ts'

for (const spec of PUBLISHED_FROZEN_PRODUCT_SPECS.filter((s) =>
  [PUBLISHED_FROZEN_PRODUCT_IDS.hexclad, PUBLISHED_FROZEN_PRODUCT_IDS.greenpan].includes(
    s.product_id,
  ),
)) {
  const snap = loadPublishedDisplaySnapshot(spec.product_id)
  assert.ok(snap, `${spec.slug} must have frozen snapshot — run npm run backfill:published-snapshot-gap`)
  assert.equal(assertPublishedSnapshotIntegrity(snap).valid, true)
  const expected = spec.expected
  assert.ok(expected)
  assert.equal(snap.score.pac_safety_score, expected.pac_safety_score, spec.slug)
  assert.equal(snap.score.tier, expected.tier, spec.slug)
  assert.match(String(snap.score.transparency_badge ?? ''), new RegExp(expected.transparency_badge, 'i'))
  assert.ok(!('buy_cta' in snap.display))

  const state = getDescriptionOverrideState(spec.product_id)
  assert.ok(state.current_snapshot_id, `${spec.slug} description override editor requires snapshot`)
}

console.log('✓ HexClad + GreenPan frozen snapshots + override editor readiness')
