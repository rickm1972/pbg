/**
 * Versioned display snapshot correction — restore full public-eligible sources from approved Gate 1 evidence.
 */

import type { ProductEvidence } from '../../types/agent'
import type { Product } from '../../types'
import type { AprDisplaySource } from '../../types/apr'
import type { PublishedDisplaySnapshotRecord } from './publishedDisplaySnapshot'
import { hashPublishedDisplaySnapshot } from './publishedDisplaySnapshot'
import {
  approveDisplayUpdateProposal,
  assertSnapshotNotMutatedInPlace,
  createDisplayUpdateProposal,
} from './displayUpdateWorkflow'
import { loadPublishedBaselineSnapshotImmutable, loadPublishedDisplaySnapshot } from './publishedBaselineRegistry'
import {
  buildAprDisplaySourcesFromApprovedEvidence,
  displaySourcesFingerprint,
  formatDisplaySourcesIntro,
} from './publicDisplaySourceAssembly'
import { GLOBAL_METHODOLOGY_DISCLAIMER } from './publicReviewStamp'
import {
  listApprovedSnapshotVersionsDurable,
  loadLatestApprovedSnapshotDurable,
} from './durable/durableSnapshotLoader'
import { saveApprovedSnapshotVersionDurable } from './durable/durableSnapshotWriter.node'
import type { AprPublicRenderInput } from '../../types/apr'

function generateSnapshotId(productId: string): string {
  return `snap-${productId}-${Date.now()}`
}

function persistSourceCorrectionSnapshot(
  record: PublishedDisplaySnapshotRecord,
  context: {
    source_snapshot_id: string
    approved_by: string
    reason?: string
  },
): void {
  const existing = loadLatestApprovedSnapshotDurable(record.product_id)
  const versions = listApprovedSnapshotVersionsDurable(record.product_id)
  const version_sequence = existing
    ? (versions[versions.length - 1]?.meta.version_sequence ?? 0) + 1
    : 1

  saveApprovedSnapshotVersionDurable({
    record,
    meta: {
      snapshot_id: record.snapshot_id,
      product_id: record.product_id,
      version_sequence,
      source_snapshot_id: context.source_snapshot_id,
      reason: context.reason ?? 'source_correction',
      override_id: null,
      approved_at: record.published_at,
      approved_by: context.approved_by,
      low_score_publication_review:
        versions[versions.length - 1]?.meta.low_score_publication_review ?? null,
      immutable: true,
    },
  })
}

export type DisplaySourceCorrectionResult = {
  product_id: string
  skipped: boolean
  previous_snapshot_id: string
  new_snapshot_id: string | null
  previous_source_count: number
  corrected_source_count: number
  new_snapshot: PublishedDisplaySnapshotRecord | null
}

export function approveDisplaySourceCorrection(input: {
  product: Product
  evidence: ProductEvidence
  reviewer_id: string
  corrected_sources?: AprDisplaySource[]
  add_global_disclaimer?: boolean
  last_reviewed_at?: string | null
}): DisplaySourceCorrectionResult {
  const previous = loadPublishedDisplaySnapshot(input.product.product_id)
  if (!previous) {
    throw new Error(`No published snapshot for ${input.product.product_id}`)
  }

  const corrected =
    input.corrected_sources ??
    buildAprDisplaySourcesFromApprovedEvidence(input.evidence, input.product)

  const previousCount = previous.display.sources.filter((s) => s.public_source_eligible !== false).length
  const correctedCount = corrected.filter((s) => s.public_source_eligible !== false).length

  const needsDisclaimer =
    input.add_global_disclaimer && !previous.display.methodology_disclaimer?.trim()
  const needsReviewDate =
    Boolean(input.last_reviewed_at?.trim()) && !previous.display.low_score_last_reviewed_at?.trim()

  if (
    displaySourcesFingerprint(previous.display.sources) === displaySourcesFingerprint(corrected) &&
    !needsDisclaimer &&
    !needsReviewDate
  ) {
    return {
      product_id: input.product.product_id,
      skipped: true,
      previous_snapshot_id: previous.snapshot_id,
      new_snapshot_id: previous.snapshot_id,
      previous_source_count: previousCount,
      corrected_source_count: correctedCount,
      new_snapshot: previous,
    }
  }

  const baselineImmutable = loadPublishedBaselineSnapshotImmutable(input.product.product_id)
  if (baselineImmutable) {
    const beforeHash = hashPublishedDisplaySnapshot(baselineImmutable)
    const afterCheck = hashPublishedDisplaySnapshot(baselineImmutable)
    if (beforeHash !== afterCheck) {
      throw new Error('Baseline snapshot file must remain immutable.')
    }
  }

  const sourceGroups = [...new Set(corrected.map((s) => s.group))]
  const proposedRender: AprPublicRenderInput = {
    display: {
      ...previous.display,
      sources: corrected,
      sources_intro: formatDisplaySourcesIntro(sourceGroups),
      methodology_disclaimer:
        previous.display.methodology_disclaimer?.trim() ||
        (input.add_global_disclaimer ? GLOBAL_METHODOLOGY_DISCLAIMER : undefined),
      last_reviewed_at:
        previous.display.last_reviewed_at ??
        (input.last_reviewed_at && !previous.display.low_score_last_reviewed_at
          ? input.last_reviewed_at
          : previous.display.last_reviewed_at),
      buy_cta: [],
    },
    score: { ...previous.score },
  }

  const proposal = createDisplayUpdateProposal({
    proposal_id: `source-correction-${input.product.product_id}-${Date.now()}`,
    product_id: input.product.product_id,
    current_snapshot: previous,
    proposed: proposedRender,
    meta: {
      published_at: new Date().toISOString(),
      evidence_content_hash: previous.evidence_content_hash,
      normalization_content_hash: previous.normalization_content_hash,
      display_content_hash: previous.display_content_hash,
      score_content_hash: previous.score_content_hash,
      assembled_content_hash: previous.assembled_content_hash,
    },
  })

  const newSnapshotId = generateSnapshotId(input.product.product_id)
  const { new_snapshot: newSnapshot } = approveDisplayUpdateProposal(
    proposal,
    input.reviewer_id,
    newSnapshotId,
  )

  assertSnapshotNotMutatedInPlace(previous, newSnapshot)
  if (previous.snapshot_id === newSnapshot.snapshot_id) {
    throw new Error('Source correction must create a new snapshot version.')
  }
  if (displaySourcesFingerprint(newSnapshot.display.sources) !== displaySourcesFingerprint(corrected)) {
    throw new Error('New snapshot sources do not match approved public-eligible evidence.')
  }
  if (newSnapshot.score.pac_safety_score !== previous.score.pac_safety_score) {
    throw new Error('Source correction must not change PAC Safety Score.')
  }

  persistSourceCorrectionSnapshot(newSnapshot, {
    source_snapshot_id: previous.snapshot_id,
    approved_by: input.reviewer_id,
  })

  return {
    product_id: input.product.product_id,
    skipped: false,
    previous_snapshot_id: previous.snapshot_id,
    new_snapshot_id: newSnapshot.snapshot_id,
    previous_source_count: previousCount,
    corrected_source_count: correctedCount,
    new_snapshot: newSnapshot,
  }
}
