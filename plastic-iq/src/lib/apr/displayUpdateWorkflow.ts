/**
 * Admin-safe deliberate display snapshot update workflow (stub — Phase 0.25).
 * Never mutates snapshots in place; never reruns agents automatically.
 */

import type { AprPublicRenderInput } from '../../types/apr'
import type { PublishedDisplaySnapshotPayload, PublishedDisplaySnapshotRecord } from './publishedDisplaySnapshot'
import {
  createPublishedDisplaySnapshotRecord,
  hashPublishedDisplaySnapshot,
  stripCommerceFromRenderInput,
} from './publishedDisplaySnapshot'
import { diffPublishedDisplayAgainstAssembly } from './displayDiffGate'

export type DisplayUpdateProposal = {
  proposal_id: string
  product_id: string
  current_snapshot_id: string | null
  proposed_payload: PublishedDisplaySnapshotPayload
  diff_summary: ReturnType<typeof diffPublishedDisplayAgainstAssembly>
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  approved_at: string | null
  approved_by: string | null
}

export function createDisplayUpdateProposal(input: {
  proposal_id: string
  product_id: string
  current_snapshot: PublishedDisplaySnapshotRecord | null
  proposed: AprPublicRenderInput
  meta: {
    published_at: string
    evidence_content_hash?: string
    normalization_content_hash?: string
    display_content_hash?: string
    score_content_hash?: string
    assembled_content_hash?: string
  }
}): DisplayUpdateProposal {
  const proposed_payload = stripCommerceFromRenderInput(input.proposed, input.product_id, input.meta)
  const diff_summary = input.current_snapshot
    ? diffPublishedDisplayAgainstAssembly(input.current_snapshot, input.proposed)
    : []

  return {
    proposal_id: input.proposal_id,
    product_id: input.product_id,
    current_snapshot_id: input.current_snapshot?.snapshot_id ?? null,
    proposed_payload,
    diff_summary,
    status: 'pending',
    created_at: new Date().toISOString(),
    approved_at: null,
    approved_by: null,
  }
}

export function approveDisplayUpdateProposal(
  proposal: DisplayUpdateProposal,
  approver: string,
  newSnapshotId: string,
): { proposal: DisplayUpdateProposal; new_snapshot: PublishedDisplaySnapshotRecord } {
  if (proposal.status !== 'pending') {
    throw new Error('Only pending display update proposals can be approved.')
  }

  const new_snapshot = createPublishedDisplaySnapshotRecord(
    proposal.proposed_payload,
    newSnapshotId,
  )

  return {
    proposal: {
      ...proposal,
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: approver,
    },
    new_snapshot,
  }
}

/** Verify old snapshot row would remain unchanged after approval (immutable). */
export function assertSnapshotNotMutatedInPlace(
  before: PublishedDisplaySnapshotRecord,
  after: PublishedDisplaySnapshotRecord,
): boolean {
  if (before.snapshot_id !== after.snapshot_id) return true
  return (
    before.content_hash === after.content_hash &&
    hashPublishedDisplaySnapshot(before) === hashPublishedDisplaySnapshot(after)
  )
}
