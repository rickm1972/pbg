/**
 * File-based durable store for description overrides and approved snapshot versions.
 * Used in dev/tests and when Supabase is unavailable. Survives process restart.
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type {
  ApprovedSnapshotDurableIndex,
  DescriptionOverrideDurableIndex,
  SaveApprovedSnapshotInput,
  StoredApprovedSnapshotVersion,
} from './durableStoreTypes'
import type { DescriptionOverrideRecord } from '../descriptionOverride'

const OVERRIDES_FILE = 'description-overrides.json'
const SNAPSHOT_INDEX_FILE = join('approved-snapshots', 'index.json')
const SNAPSHOT_DIR = join('approved-snapshots', 'records')

function ensureDir(path: string): void {
  mkdirSync(path, { recursive: true })
}

function readJson<T>(path: string, fallback: T): T {
  if (!existsSync(path)) return fallback
  return JSON.parse(readFileSync(path, 'utf8')) as T
}

function writeJson(path: string, data: unknown): void {
  ensureDir(dirname(path))
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
}

export class FileDurableStore {
  constructor(readonly rootDir: string) {}

  private overridesPath(): string {
    return join(this.rootDir, OVERRIDES_FILE)
  }

  private snapshotIndexPath(): string {
    return join(this.rootDir, SNAPSHOT_INDEX_FILE)
  }

  private snapshotRecordPath(snapshotId: string): string {
    return join(this.rootDir, SNAPSHOT_DIR, `${snapshotId}.json`)
  }

  loadOverridesIndex(): DescriptionOverrideDurableIndex {
    return readJson<DescriptionOverrideDurableIndex>(this.overridesPath(), { overrides: [] })
  }

  saveOverride(record: DescriptionOverrideRecord): void {
    const index = this.loadOverridesIndex()
    const next = index.overrides.filter((r) => r.override_id !== record.override_id)
    next.push({ ...record, updated_at: record.updated_at ?? new Date().toISOString() })
    writeJson(this.overridesPath(), { overrides: next })
  }

  findOverrideById(overrideId: string): DescriptionOverrideRecord | null {
    return this.loadOverridesIndex().overrides.find((r) => r.override_id === overrideId) ?? null
  }

  listOverrides(productId: string): DescriptionOverrideRecord[] {
    return this.loadOverridesIndex().overrides.filter((r) => r.product_id === productId)
  }

  loadSnapshotIndex(): ApprovedSnapshotDurableIndex {
    return readJson<ApprovedSnapshotDurableIndex>(this.snapshotIndexPath(), {
      latest_by_product: {},
      versions: [],
    })
  }

  saveApprovedSnapshotVersion(input: SaveApprovedSnapshotInput): void {
    const index = this.loadSnapshotIndex()
    const stored: StoredApprovedSnapshotVersion = {
      meta: { ...input.meta, immutable: true },
      record: input.record,
    }
    writeJson(this.snapshotRecordPath(input.record.snapshot_id), stored)

    const versions = index.versions.filter((v) => v.snapshot_id !== input.meta.snapshot_id)
    versions.push(stored.meta)
    versions.sort((a, b) => {
      if (a.product_id !== b.product_id) return a.product_id.localeCompare(b.product_id)
      return a.version_sequence - b.version_sequence
    })

    writeJson(this.snapshotIndexPath(), {
      latest_by_product: {
        ...index.latest_by_product,
        [input.meta.product_id]: input.meta.snapshot_id,
      },
      versions,
    })
  }

  loadLatestApprovedSnapshot(productId: string): StoredApprovedSnapshotVersion | null {
    const index = this.loadSnapshotIndex()
    const latestId = index.latest_by_product[productId]
    if (!latestId) return null
    return this.loadApprovedSnapshotById(latestId)
  }

  loadApprovedSnapshotById(snapshotId: string): StoredApprovedSnapshotVersion | null {
    const path = this.snapshotRecordPath(snapshotId)
    if (!existsSync(path)) return null
    return JSON.parse(readFileSync(path, 'utf8')) as StoredApprovedSnapshotVersion
  }

  listApprovedSnapshotVersions(productId: string): StoredApprovedSnapshotVersion[] {
    const index = this.loadSnapshotIndex()
    return index.versions
      .filter((v) => v.product_id === productId)
      .map((v) => this.loadApprovedSnapshotById(v.snapshot_id))
      .filter((v): v is StoredApprovedSnapshotVersion => v != null)
  }

  resetAll(): void {
    if (existsSync(this.rootDir)) {
      rmSync(this.rootDir, { recursive: true, force: true })
    }
  }
}
