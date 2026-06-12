#!/usr/bin/env node
/**
 * Gate 4 publish must create frozen display snapshots.
 * Run: npm run test:publish-auto-snapshot
 */
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  configureDurableStore,
  resetDurableStoreForTests,
} from '../src/lib/apr/durable/durableSnapshotWriter.node.ts'
import {
  buildFrozenSnapshotForProduct,
  freezePublishedDisplaySnapshot,
  persistFrozenSnapshotToDurableStore,
} from '../src/lib/apr/publishedSnapshotPublish.ts'
import { loadPublishedDisplaySnapshot } from '../src/lib/apr/publishedBaselineRegistry.ts'
import { PUBLISHED_BASELINE_PRODUCT_IDS } from '../src/lib/apr/publishedBaselineIds.ts'
import { createServiceClient, fetchProductById } from './agent1/supabase.mjs'
import { mergePublishedRenderPayload, frozenDisplayFingerprint } from '../src/lib/apr/publishedRenderPayload.ts'
import { assembleAprPublicRenderInput } from '../src/lib/apr/assembleDisplay.ts'
import { loadApprovedAssemblyInputFromDb } from '../src/lib/apr/approvedPublishedTruth.ts'
import { loadApprovedPublishedScoreTruth } from '../src/lib/apr/approvedPublishedTruth.ts'

const tmpRoot = mkdtempSync(join(tmpdir(), 'publish-snapshot-test-'))
configureDurableStore({ rootDir: tmpRoot })

try {
  const sb = createServiceClient()
  const productId = PUBLISHED_BASELINE_PRODUCT_IDS.lodge
  const product = await fetchProductById(sb, productId)
  assert.ok(product)

  const { record } = await buildFrozenSnapshotForProduct(sb, product)
  persistFrozenSnapshotToDurableStore(record, {
    source_snapshot_id: 'baseline-lodge',
    approved_by: 'test',
    reason: 'gate4_publish',
  })

  const loaded = loadPublishedDisplaySnapshot(productId)
  assert.ok(loaded, 'snapshot persisted to durable store')
  assert.equal(loaded.score.pac_safety_score, record.score.pac_safety_score)

  const approved = await loadApprovedPublishedScoreTruth(sb, productId)
  const assemblyInput = await loadApprovedAssemblyInputFromDb(sb, product, approved)
  const live = await assembleAprPublicRenderInput({
    ...assemblyInput,
    productDescription: 'LIVE MUTATION MUST NOT AFFECT PUBLISHED RENDER',
  })
  assert.ok(live)

  const publishedRender = mergePublishedRenderPayload(loaded, [])
  assert.ok(
    !publishedRender.display.product_description.includes('LIVE MUTATION'),
    'published render uses frozen snapshot only',
  )
  assert.notEqual(
    publishedRender.display.product_description,
    live.display.product_description,
    'live assembly description differs from frozen snapshot',
  )

  console.log('✓ publish snapshot creation + frozen render invariant')
} finally {
  resetDurableStoreForTests()
  rmSync(tmpRoot, { recursive: true, force: true })
}
