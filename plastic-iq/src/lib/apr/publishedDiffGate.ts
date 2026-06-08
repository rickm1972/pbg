/**
 * Shared published display diff-gate checks (Part C.1).
 * Uses the same latest-approved snapshot resolution as public render.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { assertPublishedSnapshotIntegrity } from './publishedDisplaySnapshot'
import type { PublishedDisplaySnapshotRecord } from './publishedDisplaySnapshot'
import {
  assertPublishedSnapshotMatchesApprovedTruth,
  loadApprovedPublishedScoreTruth,
} from './approvedPublishedTruth'
import { loadPublishedBaselineSnapshotImmutable } from './publishedBaselineRegistry'
import { listLatestApprovedSnapshotsForDiffGate } from './publishedBaselineRegistry'
import { loadLatestApprovedSnapshotDurable, loadLatestApprovedSnapshotStored } from './durable/durableSnapshotLoader'
import { validateDescriptionOverrideForApproval } from './negativeScoreGate'
import { NEGATIVE_SCORE_PUBLICATION_GATE } from './negativeScoreGate'

export type PublishedDiffGateFailure = {
  product_id: string
  check: string
  error: string
  snapshot_score?: number
  approved_score?: number
}

export function assertBaselineSnapshotsRemainImmutable(): PublishedDiffGateFailure[] {
  const failures: PublishedDiffGateFailure[] = []
  for (const snapshot of listLatestApprovedSnapshotsForDiffGate()) {
    const baseline = loadPublishedBaselineSnapshotImmutable(snapshot.product_id)
    if (!baseline) continue
    const baselineIntegrity = assertPublishedSnapshotIntegrity(baseline)
    if (!baselineIntegrity.valid) {
      failures.push({
        product_id: snapshot.product_id,
        check: 'baseline_integrity',
        error: baselineIntegrity.reason ?? 'baseline integrity failed',
      })
    }
  }
  return failures
}

export async function runPublishedDisplayDiffGate(
  sb: SupabaseClient,
): Promise<PublishedDiffGateFailure[]> {
  const failures: PublishedDiffGateFailure[] = []
  failures.push(...assertBaselineSnapshotsRemainImmutable())

  const snapshots = listLatestApprovedSnapshotsForDiffGate()

  for (const snapshot of snapshots) {
    const integrity = assertPublishedSnapshotIntegrity(snapshot)
    if (!integrity.valid) {
      failures.push({
        product_id: snapshot.product_id,
        check: 'snapshot_integrity',
        error: integrity.reason ?? 'snapshot integrity failed',
      })
      continue
    }

    if ('buy_cta' in (snapshot.display as object)) {
      failures.push({
        product_id: snapshot.product_id,
        check: 'no_commerce_in_freeze',
        error: 'Frozen snapshot must not contain buy_cta',
      })
    }

    let approved
    try {
      approved = await loadApprovedPublishedScoreTruth(sb, snapshot.product_id)
    } catch (err) {
      failures.push({
        product_id: snapshot.product_id,
        check: 'approved_truth_load',
        error: err instanceof Error ? err.message : String(err),
      })
      continue
    }

    try {
      assertPublishedSnapshotMatchesApprovedTruth(snapshot, approved)
    } catch (err) {
      failures.push({
        product_id: snapshot.product_id,
        check: 'approved_truth_alignment',
        snapshot_score: snapshot.score.pac_safety_score,
        approved_score: approved.pac_safety_score,
        error: err instanceof Error ? err.message : String(err),
      })
    }

    const durableOverride = loadLatestApprovedSnapshotDurable(snapshot.product_id)
    const baseline = loadPublishedBaselineSnapshotImmutable(snapshot.product_id)
    const isDurableOverrideVersion =
      durableOverride != null && durableOverride.snapshot_id !== baseline?.snapshot_id

    if (
      isDurableOverrideVersion &&
      snapshot.score.pac_safety_score < NEGATIVE_SCORE_PUBLICATION_GATE.threshold
    ) {
      const stored = loadLatestApprovedSnapshotStored(snapshot.product_id)
      const gate = validateDescriptionOverrideForApproval(
        snapshot,
        snapshot.display.product_description ?? '',
        {
          low_score_publication_review: stored?.meta.low_score_publication_review ?? null,
        },
      )
      if (gate.applies && !gate.ok) {
        failures.push({
          product_id: snapshot.product_id,
          check: 'negative_score_override_gate',
          error: gate.failures.map((f) => f.message).join('; '),
        })
      }
    }
  }

  return failures
}

export function resolveLatestApprovedForProduct(
  productId: string,
  snapshots: PublishedDisplaySnapshotRecord[],
): PublishedDisplaySnapshotRecord | null {
  return snapshots.find((s) => s.product_id === productId) ?? null
}
