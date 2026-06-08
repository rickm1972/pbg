/**
 * Part C.1 durable persistence types.
 *
 * Snapshot semantics:
 * - Baseline snapshot: immutable Phase 0.25 JSON baseline (never raw-mutated).
 * - Approved override snapshot version: new immutable row created by displayUpdateWorkflow approval.
 * - Latest approved snapshot: what public pages render — latest override version if any, else baseline.
 * - Superseded baseline: baseline remains valid/immutable but is not latest when a newer approved version exists.
 */

import type { LowScorePublicationReview } from '../../../types/apr'
import type { DescriptionOverrideRecord } from '../descriptionOverride'
import type { PublishedDisplaySnapshotRecord } from '../publishedDisplaySnapshot'

export type ApprovedSnapshotVersionMeta = {
  snapshot_id: string
  product_id: string
  version_sequence: number
  source_snapshot_id: string
  reason: 'description_override'
  override_id: string | null
  approved_at: string
  approved_by: string | null
  low_score_publication_review?: LowScorePublicationReview | null
  immutable: true
}

export type StoredApprovedSnapshotVersion = {
  meta: ApprovedSnapshotVersionMeta
  record: PublishedDisplaySnapshotRecord
}

export type DescriptionOverrideDurableIndex = {
  overrides: DescriptionOverrideRecord[]
}

export type ApprovedSnapshotDurableIndex = {
  latest_by_product: Record<string, string>
  versions: ApprovedSnapshotVersionMeta[]
}

export type SaveApprovedSnapshotInput = {
  record: PublishedDisplaySnapshotRecord
  meta: Omit<ApprovedSnapshotVersionMeta, 'immutable'>
}
