/**
 * Node-only durable snapshot writer (fs). Import this path from scripts/tests — not from browser UI.
 */

import { join } from 'node:path'
import type { DescriptionOverrideRecord } from '../descriptionOverride'
import type { SaveApprovedSnapshotInput } from './durableStoreTypes'
import { FileDurableStore } from './fileDurableStore'
import {
  clearDurableSnapshotLoaderCache,
  registerDurableFileStoreReader,
} from './durableSnapshotLoader'

let configuredRoot: string | null = null
let fileStore: FileDurableStore | null = null
let overrideCache: DescriptionOverrideRecord[] | null = null

function defaultRoot(): string {
  return process.env.DURABLE_STORE_ROOT ?? join(process.cwd(), 'data', 'durable-published')
}

function getFileStore(): FileDurableStore {
  if (!fileStore) {
    const root = configuredRoot ?? defaultRoot()
    fileStore = new FileDurableStore(root)
    registerDurableFileStoreReader((productId) => fileStore!.loadLatestApprovedSnapshot(productId))
  }
  return fileStore
}

export function configureDurableStore(options: { rootDir?: string } = {}): void {
  configuredRoot = options.rootDir ?? null
  fileStore = options.rootDir ? new FileDurableStore(options.rootDir) : null
  registerDurableFileStoreReader(
    fileStore ? (productId) => fileStore!.loadLatestApprovedSnapshot(productId) : null,
  )
  clearDurableSnapshotLoaderCache()
  overrideCache = null
}

export function resetDurableStoreForTests(): void {
  getFileStore().resetAll()
  clearDurableSnapshotLoaderCache()
  overrideCache = null
}

export function getDurableStoreRootForTests(): string {
  return configuredRoot ?? defaultRoot()
}

function loadAllOverrides(): DescriptionOverrideRecord[] {
  if (!overrideCache) {
    overrideCache = getFileStore().loadOverridesIndex().overrides
  }
  return overrideCache
}

function invalidateOverrideCache(): void {
  overrideCache = null
}

export function saveDescriptionOverrideDurable(record: DescriptionOverrideRecord): void {
  const withUpdated: DescriptionOverrideRecord = {
    ...record,
    updated_at: new Date().toISOString(),
    negative_score_gate_result: record.validation?.negative_score_gate ?? null,
  }
  getFileStore().saveOverride(withUpdated)
  invalidateOverrideCache()
}

export function findDescriptionOverrideDurable(overrideId: string): DescriptionOverrideRecord | null {
  return loadAllOverrides().find((r) => r.override_id === overrideId) ?? getFileStore().findOverrideById(overrideId)
}

export function listDescriptionOverridesDurable(productId: string): DescriptionOverrideRecord[] {
  return loadAllOverrides().filter((r) => r.product_id === productId)
}

export function saveApprovedSnapshotVersionDurable(input: SaveApprovedSnapshotInput): void {
  getFileStore().saveApprovedSnapshotVersion(input)
  clearDurableSnapshotLoaderCache()
}
