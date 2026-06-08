/**
 * Phase 0.25 — frozen published display snapshot (product truth at publish time).
 * Commerce/affiliate URLs are excluded; see productCommerceLinks.ts.
 */

import type { AprDisplayPayload, AprPublicRenderInput } from '../../types/apr'
import { contentHash } from './contentHash'

/** Bump when frozen snapshot shape or semantics change. */
export const PUBLISHED_DISPLAY_CONTRACT_VERSION = '0.25.0'

export type PublishedDisplaySnapshotScore = AprPublicRenderInput['score']

/** Display payload frozen at publish — no buy_cta (commerce layer). */
export type PublishedDisplaySnapshotDisplay = Omit<AprDisplayPayload, 'buy_cta'>

export type PublishedDisplaySnapshotPayload = {
  contract_version: string
  published_at: string
  product_id: string
  evidence_content_hash: string
  normalization_content_hash: string
  display_content_hash: string
  score_content_hash: string
  assembled_content_hash: string
  display: PublishedDisplaySnapshotDisplay
  score: PublishedDisplaySnapshotScore
}

export type PublishedDisplaySnapshotRecord = PublishedDisplaySnapshotPayload & {
  snapshot_id: string
  content_hash: string
}

export function stripCommerceFromRenderInput(
  input: AprPublicRenderInput,
  productId: string,
  meta: {
    published_at: string
    evidence_content_hash?: string
    normalization_content_hash?: string
    display_content_hash?: string
    score_content_hash?: string
    assembled_content_hash?: string
  },
): PublishedDisplaySnapshotPayload {
  const { buy_cta: _buyCta, ...displayWithoutCommerce } = input.display
  return {
    contract_version: PUBLISHED_DISPLAY_CONTRACT_VERSION,
    published_at: meta.published_at,
    product_id: productId,
    evidence_content_hash: meta.evidence_content_hash ?? '',
    normalization_content_hash: meta.normalization_content_hash ?? '',
    display_content_hash: meta.display_content_hash ?? '',
    score_content_hash: meta.score_content_hash ?? '',
    assembled_content_hash: meta.assembled_content_hash ?? '',
    display: displayWithoutCommerce,
    score: { ...input.score },
  }
}

export function hashPublishedDisplaySnapshot(
  payload: PublishedDisplaySnapshotPayload | PublishedDisplaySnapshotRecord,
): string {
  const {
    snapshot_id: _snapshotId,
    content_hash: _contentHash,
    ...payloadOnly
  } = payload as PublishedDisplaySnapshotRecord
  return contentHash(payloadOnly)
}

export function createPublishedDisplaySnapshotRecord(
  payload: PublishedDisplaySnapshotPayload,
  snapshotId: string,
): PublishedDisplaySnapshotRecord {
  const content_hash = hashPublishedDisplaySnapshot(payload)
  return {
    ...payload,
    snapshot_id: snapshotId,
    content_hash,
  }
}

export function assertPublishedSnapshotIntegrity(
  record: PublishedDisplaySnapshotRecord,
): { valid: boolean; reason?: string } {
  const expected = hashPublishedDisplaySnapshot(record)
  if (record.content_hash !== expected) {
    return {
      valid: false,
      reason: 'Published display snapshot content_hash mismatch — record may have been mutated.',
    }
  }
  if ('buy_cta' in (record.display as object)) {
    return {
      valid: false,
      reason: 'Published display snapshot must not contain buy_cta — commerce layer only.',
    }
  }
  return { valid: true }
}
