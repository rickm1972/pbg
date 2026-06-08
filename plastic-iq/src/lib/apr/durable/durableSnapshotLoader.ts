/**
 * Browser-safe latest-approved snapshot loader.
 * Resolution order: optional Node file-store reader (tests/scripts) → bundled JSON registry.
 */

import type { PublishedDisplaySnapshotRecord } from '../publishedDisplaySnapshot'
import type { ApprovedSnapshotVersionMeta, StoredApprovedSnapshotVersion } from './durableStoreTypes'
import { loadBundledLatestApprovedSnapshot } from './bundledDurableRegistry'

type FileStoreReader = (productId: string) => StoredApprovedSnapshotVersion | null

let fileStoreReader: FileStoreReader | null = null
let latestSnapshotCache = new Map<string, StoredApprovedSnapshotVersion>()

export function registerDurableFileStoreReader(reader: FileStoreReader | null): void {
  fileStoreReader = reader
}

export function clearDurableSnapshotLoaderCache(): void {
  latestSnapshotCache = new Map()
}

export function simulateDurableStoreProcessRestart(): void {
  clearDurableSnapshotLoaderCache()
}

/** File-store / Supabase durable rows only — excludes bundled browser registry. */
export function loadLatestApprovedSnapshotFromPersistentStore(
  productId: string,
): StoredApprovedSnapshotVersion | null {
  if (!fileStoreReader) return null
  try {
    return fileStoreReader(productId)
  } catch {
    return null
  }
}

export function loadLatestApprovedSnapshotStored(
  productId: string,
): StoredApprovedSnapshotVersion | null {
  const cached = latestSnapshotCache.get(productId)
  if (cached) return cached

  let stored: StoredApprovedSnapshotVersion | null = null
  if (fileStoreReader) {
    try {
      stored = fileStoreReader(productId)
    } catch {
      stored = null
    }
    if (stored) {
      latestSnapshotCache.set(productId, stored)
      return stored
    }
  }
  stored = loadBundledLatestApprovedSnapshot(productId)
  if (stored) latestSnapshotCache.set(productId, stored)
  return stored
}

export function loadLatestApprovedSnapshotDurable(
  productId: string,
): PublishedDisplaySnapshotRecord | null {
  return loadLatestApprovedSnapshotStored(productId)?.record ?? null
}

export function loadApprovedSnapshotMetaDurable(
  productId: string,
): ApprovedSnapshotVersionMeta | null {
  return loadLatestApprovedSnapshotStored(productId)?.meta ?? null
}

export function listApprovedSnapshotVersionsDurable(
  productId: string,
): StoredApprovedSnapshotVersion[] {
  const latest = loadLatestApprovedSnapshotStored(productId)
  return latest ? [latest] : []
}
