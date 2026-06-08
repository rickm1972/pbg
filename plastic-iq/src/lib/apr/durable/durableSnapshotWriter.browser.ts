/**
 * Browser-safe durable store (in-memory). Vite aliases durableSnapshotWriter.ts → this file
 * for client bundles so AdminPage never imports node:fs.
 */

import type { DescriptionOverrideRecord } from '../descriptionOverride'
import type { SaveApprovedSnapshotInput, StoredApprovedSnapshotVersion } from './durableStoreTypes'
import {
  clearDurableSnapshotLoaderCache,
  registerDurableFileStoreReader,
} from './durableSnapshotLoader'

let overrides: DescriptionOverrideRecord[] = []
let latestByProduct: Record<string, string> = {}
let storedById = new Map<string, StoredApprovedSnapshotVersion>()

function syncReader(): void {
  registerDurableFileStoreReader((productId) => {
    const latestId = latestByProduct[productId]
    if (!latestId) return null
    return storedById.get(latestId) ?? null
  })
  clearDurableSnapshotLoaderCache()
}

syncReader()

export function configureDurableStore(_options: { rootDir?: string } = {}): void {
  syncReader()
}

export function resetDurableStoreForTests(): void {
  overrides = []
  latestByProduct = {}
  storedById = new Map()
  syncReader()
}

export function getDurableStoreRootForTests(): string {
  return 'browser-memory'
}

export function saveDescriptionOverrideDurable(record: DescriptionOverrideRecord): void {
  overrides = overrides.filter((r) => r.override_id !== record.override_id)
  overrides.push({
    ...record,
    updated_at: record.updated_at ?? new Date().toISOString(),
    negative_score_gate_result: record.validation?.negative_score_gate ?? null,
  })
}

export function findDescriptionOverrideDurable(overrideId: string): DescriptionOverrideRecord | null {
  return overrides.find((r) => r.override_id === overrideId) ?? null
}

export function listDescriptionOverridesDurable(productId: string): DescriptionOverrideRecord[] {
  return overrides.filter((r) => r.product_id === productId)
}

export function saveApprovedSnapshotVersionDurable(input: SaveApprovedSnapshotInput): void {
  const stored: StoredApprovedSnapshotVersion = {
    meta: { ...input.meta, immutable: true },
    record: input.record,
  }
  storedById.set(input.meta.snapshot_id, stored)
  latestByProduct = { ...latestByProduct, [input.meta.product_id]: input.meta.snapshot_id }
  syncReader()
}
