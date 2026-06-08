/**
 * Browser-safe bundled latest-approved snapshots (synced from data/durable-published on remediation).
 */

import type { StoredApprovedSnapshotVersion } from './durableStoreTypes'
import { BUNDLED_BY_PRODUCT, BUNDLED_MANIFEST } from '../durable-approved/bundledSnapshots.generated'

export function loadBundledLatestApprovedSnapshot(
  productId: string,
): StoredApprovedSnapshotVersion | null {
  const latestId = BUNDLED_MANIFEST.latest_by_product[productId as keyof typeof BUNDLED_MANIFEST.latest_by_product]
  if (!latestId) return null
  const stored = BUNDLED_BY_PRODUCT[productId]
  if (!stored || stored.meta.snapshot_id !== latestId) return null
  return stored
}

export function listBundledLatestApprovedProductIds(): string[] {
  return Object.keys(BUNDLED_MANIFEST.latest_by_product)
}
