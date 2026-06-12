/**
 * Active-row semantics for locked pipeline tables (Agent 3 output, Agent 4 audit, snapshot drafts).
 * Non-destructive: supersede stale rows; never delete history.
 */
import type { Agent3LockedOutputRow } from '../../types/agent3LockedOutput'
import type { Agent4LockedAuditRow } from '../../types/agent4LockedAudit'
import type { LockedSnapshotDraftRow } from '../../types/lockedSnapshotDraft'
import {
  CANONICAL_LOCKED_PIPELINE_PRODUCT_IDS,
  catalogDisplayKey,
  shouldReplaceLockedQueueCandidate,
} from './displayDedupe'

export type ProductNameRow = { product_id: string; product_name: string | null; brand: string | null }

function isNewer(isoA: string, isoB: string): boolean {
  return new Date(isoA).getTime() > new Date(isoB).getTime()
}

export function pickLatestAgent3OutputPerLockedInput(
  rows: Agent3LockedOutputRow[],
): Agent3LockedOutputRow[] {
  const latest = new Map<string, Agent3LockedOutputRow>()
  for (const row of rows) {
    if (row.review_status === 'superseded') continue
    const existing = latest.get(row.locked_input_id)
    if (!existing || isNewer(row.created_at, existing.created_at)) {
      latest.set(row.locked_input_id, row)
    }
  }
  return [...latest.values()]
}

export function pickLatestAgent4AuditPerLockedOutput(
  rows: Agent4LockedAuditRow[],
): Agent4LockedAuditRow[] {
  const latest = new Map<string, Agent4LockedAuditRow>()
  for (const row of rows) {
    if (row.audit_status === 'superseded') continue
    const existing = latest.get(row.locked_output_id)
    if (!existing || isNewer(row.created_at, existing.created_at)) {
      latest.set(row.locked_output_id, row)
    }
  }
  return [...latest.values()]
}

/** Collapse multiple active rows that share the same catalog display to one winner. */
export function pickCanonicalActiveWinners<T extends { product_id: string; created_at: string }>(
  rows: T[],
  productNames: Map<string, ProductNameRow>,
): T[] {
  const byDisplay = new Map<string, T>()
  for (const row of rows) {
    const p = productNames.get(row.product_id)
    const key = catalogDisplayKey(p?.product_name ?? null, p?.brand ?? null)
    if (!key) continue
    const existing = byDisplay.get(key)
    if (!existing || shouldReplaceLockedQueueCandidate(existing, row)) {
      byDisplay.set(key, row)
    }
  }
  return [...byDisplay.values()]
}

export function idsToSupersedeForCanonicalDisplay<T extends { product_id: string; created_at: string }>(
  rows: T[],
  winners: T[],
  productNames: Map<string, ProductNameRow>,
): string[] {
  const winnerIds = new Set(
    winners.map((w) => (w as { locked_output_id?: string; locked_audit_id?: string }).locked_output_id ?? (w as { locked_audit_id?: string }).locked_audit_id ?? ''),
  )
  const winnerByDisplay = new Map<string, T>()
  for (const w of winners) {
    const p = productNames.get(w.product_id)
    const key = catalogDisplayKey(p?.product_name ?? null, p?.brand ?? null)
    if (key) winnerByDisplay.set(key, w)
  }

  const staleIds: string[] = []
  for (const row of rows) {
    const rowId =
      (row as { locked_output_id?: string }).locked_output_id ??
      (row as { locked_audit_id?: string }).locked_audit_id
    if (!rowId || winnerIds.has(rowId)) continue
    const p = productNames.get(row.product_id)
    const key = catalogDisplayKey(p?.product_name ?? null, p?.brand ?? null)
    if (!key) continue
    if (winnerByDisplay.has(key)) staleIds.push(rowId)
  }
  return staleIds
}

export function isCanonicalLockedPipelineProduct(productId: string): boolean {
  return CANONICAL_LOCKED_PIPELINE_PRODUCT_IDS.has(productId)
}

/** One queue row per locked_audit_id (newest non-superseded). */
export function pickLatestDraftPerLockedAudit(rows: LockedSnapshotDraftRow[]): LockedSnapshotDraftRow[] {
  const latest = new Map<string, LockedSnapshotDraftRow>()
  for (const row of rows) {
    if (row.draft_status === 'superseded') continue
    const existing = latest.get(row.locked_audit_id)
    if (!existing || isNewer(row.created_at, existing.created_at)) {
      latest.set(row.locked_audit_id, row)
    }
  }
  return [...latest.values()]
}
