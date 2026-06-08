/**
 * In-memory registry of backfilled published display snapshots (Phase 0.25 baselines).
 * Production reads from published_display_snapshots table via RPC (future); file baselines for diff gate.
 */

import type { PublishedDisplaySnapshotRecord } from './publishedDisplaySnapshot'
import { assertPublishedSnapshotIntegrity } from './publishedDisplaySnapshot'
import { PUBLISHED_BASELINE_PRODUCT_IDS } from './publishedBaselineIds'

import lodgeBaseline from './published-baselines/lodge.json'
import allCladBaseline from './published-baselines/all-clad.json'
import carawayBaseline from './published-baselines/caraway.json'
import tfalBaseline from './published-baselines/t-fal.json'

export { PUBLISHED_BASELINE_PRODUCT_IDS } from './publishedBaselineIds'

const REGISTRY: Record<string, PublishedDisplaySnapshotRecord> = {
  [PUBLISHED_BASELINE_PRODUCT_IDS.lodge]: lodgeBaseline as PublishedDisplaySnapshotRecord,
  [PUBLISHED_BASELINE_PRODUCT_IDS.allClad]: allCladBaseline as PublishedDisplaySnapshotRecord,
  [PUBLISHED_BASELINE_PRODUCT_IDS.caraway]: carawayBaseline as PublishedDisplaySnapshotRecord,
  [PUBLISHED_BASELINE_PRODUCT_IDS.tfal]: tfalBaseline as PublishedDisplaySnapshotRecord,
}

export function loadPublishedDisplaySnapshot(
  productId: string,
): PublishedDisplaySnapshotRecord | null {
  const record = REGISTRY[productId]
  if (!record) return null
  const integrity = assertPublishedSnapshotIntegrity(record)
  if (!integrity.valid) {
    throw new Error(integrity.reason ?? 'Invalid published baseline snapshot')
  }
  return record
}

export function listPublishedBaselineSnapshots(): PublishedDisplaySnapshotRecord[] {
  return Object.values(REGISTRY)
}

export function hasPublishedDisplaySnapshot(productId: string): boolean {
  return productId in REGISTRY
}
