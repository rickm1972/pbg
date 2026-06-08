/**
 * Published display snapshot resolution (Phase 0.25 baselines + Part C.1 durable approved versions).
 *
 * Snapshot semantics:
 * - Baseline snapshot: immutable Phase 0.25 JSON import — never raw-mutated.
 * - Approved override snapshot version: durable row created by displayUpdateWorkflow approval.
 * - Latest approved snapshot: public render truth — durable latest override if exists, else baseline.
 * - Superseded baseline: baseline stays immutable/valid but is not latest when a newer approved version exists.
 *
 * Production may also read published_display_snapshots via Supabase (migration 0038/0039).
 */

import type { PublishedDisplaySnapshotRecord } from './publishedDisplaySnapshot'
import { assertPublishedSnapshotIntegrity } from './publishedDisplaySnapshot'
import { PUBLISHED_BASELINE_PRODUCT_IDS } from './publishedBaselineIds'
import {
  listApprovedSnapshotVersionsDurable,
  loadLatestApprovedSnapshotDurable,
} from './durable/durableSnapshotLoader'
import { loadBundledLatestApprovedSnapshot } from './durable/bundledDurableRegistry'

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

/** Test-only seed snapshots (fixture baselines not in JSON files). */
const TEST_SNAPSHOT_REGISTRY: Record<string, PublishedDisplaySnapshotRecord> = {}

function assertIntegrityOrThrow(record: PublishedDisplaySnapshotRecord): PublishedDisplaySnapshotRecord {
  const integrity = assertPublishedSnapshotIntegrity(record)
  if (!integrity.valid) {
    throw new Error(integrity.reason ?? 'Invalid published display snapshot')
  }
  return record
}

/** Immutable baseline from JSON files or test seed — never mutated by override workflow. */
export function loadPublishedBaselineSnapshotImmutable(
  productId: string,
): PublishedDisplaySnapshotRecord | null {
  const record = REGISTRY[productId] ?? TEST_SNAPSHOT_REGISTRY[productId] ?? null
  if (!record) return null
  return assertIntegrityOrThrow(record)
}

/**
 * Latest approved snapshot for public render:
 * 1) durable approved override version (if any)
 * 2) otherwise immutable baseline JSON / test seed
 */
export function loadPublishedDisplaySnapshot(
  productId: string,
): PublishedDisplaySnapshotRecord | null {
  const durableLatest = loadLatestApprovedSnapshotDurable(productId)
  if (durableLatest) return assertIntegrityOrThrow(durableLatest)

  const bundledRender = loadBundledLatestApprovedSnapshot(productId)?.record
  if (bundledRender) return assertIntegrityOrThrow(bundledRender)

  return loadPublishedBaselineSnapshotImmutable(productId)
}

export function listPublishedBaselineSnapshots(): PublishedDisplaySnapshotRecord[] {
  return Object.values(REGISTRY).map(assertIntegrityOrThrow)
}

/** Latest-approved snapshots for diff gate — same resolution path as public render. */
export function listLatestApprovedSnapshotsForDiffGate(): PublishedDisplaySnapshotRecord[] {
  return listPublishedBaselineSnapshots().map((baseline) => {
    return loadPublishedDisplaySnapshot(baseline.product_id) ?? baseline
  })
}

export function hasPublishedDisplaySnapshot(productId: string): boolean {
  return (
    productId in REGISTRY ||
    productId in TEST_SNAPSHOT_REGISTRY ||
    loadLatestApprovedSnapshotDurable(productId) != null
  )
}

export function listApprovedSnapshotVersions(productId: string): PublishedDisplaySnapshotRecord[] {
  return listApprovedSnapshotVersionsDurable(productId).map((v) => v.record)
}

export function registerTestPublishedSnapshot(record: PublishedDisplaySnapshotRecord): void {
  TEST_SNAPSHOT_REGISTRY[record.product_id] = assertIntegrityOrThrow(record)
}

export function resetPublishedSnapshotOverlayForTests(): void {
  for (const key of Object.keys(TEST_SNAPSHOT_REGISTRY)) delete TEST_SNAPSHOT_REGISTRY[key]
}
