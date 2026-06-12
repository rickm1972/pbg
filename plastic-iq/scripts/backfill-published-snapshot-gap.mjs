#!/usr/bin/env node
/**
 * Backfill frozen display snapshots for published products missing snapshots.
 * HexClad (78/Good) + GreenPan (69/Caution) — no agents, no score changes.
 *
 * Run: npm run backfill:published-snapshot-gap
 */
import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import { createServiceClient } from './agent1/supabase.mjs'
import {
  PUBLISHED_FROZEN_PRODUCT_IDS,
  PUBLISHED_FROZEN_PRODUCT_SPECS,
} from '../src/lib/apr/publishedFrozenProductRegistry.ts'
import {
  freezePublishedDisplaySnapshot,
  loadProductPublishContext,
} from '../src/lib/apr/publishedSnapshotPublish.ts'
import { loadPublishedDisplaySnapshot } from '../src/lib/apr/publishedBaselineRegistry.ts'
import { getDescriptionOverrideState } from '../src/lib/apr/descriptionOverride.ts'
import { loadLatestApprovedSnapshotDurable } from '../src/lib/apr/durable/durableSnapshotLoader.ts'

const BACKFILL_IDS = [
  PUBLISHED_FROZEN_PRODUCT_IDS.hexclad,
  PUBLISHED_FROZEN_PRODUCT_IDS.greenpan,
]

const sb = createServiceClient()

for (const productId of BACKFILL_IDS) {
  const spec = PUBLISHED_FROZEN_PRODUCT_SPECS.find((s) => s.product_id === productId)
  assert.ok(spec?.expected, `expected posture required for ${productId}`)

  const ctx = await loadProductPublishContext(sb, productId)
  assert.equal(
    ctx.publish_status,
    'published',
    `${spec.slug} must already be published before backfill`,
  )

  const prior = loadLatestApprovedSnapshotDurable(productId)
  const record = await freezePublishedDisplaySnapshot(
    sb,
    ctx.product,
    { evidence_id: ctx.active_evidence_id },
    {
      approved_by: 'snapshot-backfill',
      reason: 'snapshot_backfill',
      skip_if_active_snapshot: true,
    },
  )

  assert.equal(record.score.pac_safety_score, spec.expected.pac_safety_score, `${spec.slug} score`)
  assert.equal(record.score.tier, spec.expected.tier, `${spec.slug} tier`)
  assert.match(
    String(record.score.transparency_badge ?? ''),
    new RegExp(spec.expected.transparency_badge, 'i'),
    `${spec.slug} badge`,
  )

  const loaded = loadPublishedDisplaySnapshot(productId)
  assert.ok(loaded, `${spec.slug} snapshot loadable after backfill`)
  assert.equal(loaded.score.pac_safety_score, spec.expected.pac_safety_score)

  const overrideState = getDescriptionOverrideState(productId)
  assert.ok(overrideState.current_snapshot_id, `${spec.slug} description override editor unlocked`)

  console.log(
    `✓ ${spec.slug} snapshot ${record.snapshot_id} — score ${record.score.pac_safety_score} / ${record.score.tier} / ${record.score.transparency_badge}${prior ? ' (already existed)' : ''}`,
  )
}

execSync('node scripts/sync-bundled-durable-snapshots.mjs', { stdio: 'inherit' })
console.log('✓ bundled durable snapshots synced for browser render')
