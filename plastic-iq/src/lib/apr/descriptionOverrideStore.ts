/**
 * Description override records — durable persistence (Part C.1).
 * Does not mutate Gate rows or baseline JSON files.
 */

import type { DescriptionOverrideRecord } from './descriptionOverride'
import { durableWriter } from './durable/durableWriterRuntime'

export function listDescriptionOverrides(productId: string): DescriptionOverrideRecord[] {
  return durableWriter.listDescriptionOverridesDurable(productId)
}

function sortOverridesNewestFirst(
  rows: DescriptionOverrideRecord[],
): DescriptionOverrideRecord[] {
  return [...rows].sort((a, b) =>
    (b.updated_at ?? b.created_at).localeCompare(a.updated_at ?? a.created_at),
  )
}

export function getActiveDescriptionOverride(productId: string): DescriptionOverrideRecord | null {
  const rows = listDescriptionOverrides(productId)
  const draftish = sortOverridesNewestFirst(
    rows.filter((r) => r.status === 'draft' || r.status === 'pending_review'),
  )[0]
  if (draftish) return draftish
  const approved = sortOverridesNewestFirst(rows.filter((r) => r.status === 'approved'))[0]
  return approved ?? null
}

export function saveDescriptionOverrideRecord(record: DescriptionOverrideRecord): void {
  durableWriter.saveDescriptionOverrideDurable(record)
}

export function findDescriptionOverrideById(overrideId: string): DescriptionOverrideRecord | null {
  return durableWriter.findDescriptionOverrideDurable(overrideId)
}

export function clearDescriptionOverrideStore(): void {
  durableWriter.resetDurableStoreForTests()
}

export function resetDurableStoreForTests(): void {
  durableWriter.resetDurableStoreForTests()
}

export { simulateDurableStoreProcessRestart } from './durable/durableSnapshotLoader'
