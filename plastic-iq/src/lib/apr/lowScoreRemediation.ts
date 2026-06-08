/**
 * Phase 4.5 remediation — T-Fal + Caraway via durable description override workflow.
 */

import type { LowScorePublicationReview } from '../../types/apr'
import {
  approveDescriptionOverride,
  saveDescriptionOverrideDraft,
  submitDescriptionOverrideForReview,
} from './descriptionOverride'
import { LOW_SCORE_GATE_VERSION, runNegativeScorePublicationGate, validateDescriptionOverrideForApproval } from './negativeScoreGate'
import { loadPublishedBaselineSnapshotImmutable, loadPublishedDisplaySnapshot } from './publishedBaselineRegistry'
import { hashPublishedDisplaySnapshot } from './publishedDisplaySnapshot'
import type { PublishedDisplaySnapshotRecord } from './publishedDisplaySnapshot'
import {
  REMEDIATION_REVIEWER_ID,
  REMEDIATION_TARGETS,
  STANDARD_METHODOLOGY_DISCLAIMER,
  TFAL_NEUTRAL_DESCRIPTION_OVERRIDE,
} from './lowScoreRemediationConstants'
import { mergePublishedRenderPayload } from './publishedRenderPayload'
import {
  loadLatestApprovedSnapshotFromPersistentStore,
  loadLatestApprovedSnapshotStored,
} from './durable/durableSnapshotLoader'

export type LowScoreRemediationTarget = keyof typeof REMEDIATION_TARGETS

export function buildRickLowScoreReview(input: {
  score: number
  primary_score_driving_concern: string
  reviewer_notes: string
  reviewed_at?: string
}): LowScorePublicationReview {
  return {
    reviewer_id: REMEDIATION_REVIEWER_ID,
    reviewed_at: input.reviewed_at ?? new Date().toISOString(),
    low_score_gate_version: LOW_SCORE_GATE_VERSION,
    score_at_review: input.score,
    primary_score_driving_concern: input.primary_score_driving_concern,
    evidence_sufficiency: 'passed',
    language_safety: 'passed',
    approval_status: 'approved',
    reviewer_notes: input.reviewer_notes,
  }
}

function resolveDescriptionOverride(
  target: (typeof REMEDIATION_TARGETS)[LowScoreRemediationTarget],
  baseline: PublishedDisplaySnapshotRecord,
): string {
  if (target.description_override) return target.description_override
  return baseline.display.product_description?.trim() ?? ''
}

export function isLowScoreProductRemediated(
  targetKey: LowScoreRemediationTarget,
): boolean {
  const target = REMEDIATION_TARGETS[targetKey]
  const baseline = loadPublishedBaselineSnapshotImmutable(target.product_id)
  const latest =
    loadLatestApprovedSnapshotFromPersistentStore(target.product_id)?.record ??
    baseline
  if (!baseline || !latest) return false
  if (latest.snapshot_id === baseline.snapshot_id) return false
  if (latest.display.methodology_disclaimer !== STANDARD_METHODOLOGY_DISCLAIMER) return false
  if (target.description_override && latest.display.product_description !== target.description_override) {
    return false
  }
  const gate = validateRemediatedSnapshot(latest, targetKey)
  return gate.ok
}

export function validateRemediatedSnapshot(
  snapshot: PublishedDisplaySnapshotRecord,
  targetKey: LowScoreRemediationTarget,
  review?: LowScorePublicationReview,
): ReturnType<typeof runNegativeScorePublicationGate> {
  const target = REMEDIATION_TARGETS[targetKey]
  const resolvedReview =
    review ??
    loadLatestApprovedSnapshotStored(target.product_id)?.meta.low_score_publication_review ??
    buildRickLowScoreReview({
      score: target.expected_score,
      primary_score_driving_concern: target.primary_score_driving_concern,
      reviewer_notes: target.reviewer_notes,
    })

  return validateDescriptionOverrideForApproval(
    snapshot,
    snapshot.display.product_description ?? '',
    { low_score_publication_review: resolvedReview },
  )
}

export function remediateLowScorePublishedProduct(targetKey: LowScoreRemediationTarget): {
  target: (typeof REMEDIATION_TARGETS)[LowScoreRemediationTarget]
  baseline: PublishedDisplaySnapshotRecord
  previous_snapshot: PublishedDisplaySnapshotRecord
  new_snapshot: PublishedDisplaySnapshotRecord
  review: LowScorePublicationReview
  skipped: boolean
} {
  const target = REMEDIATION_TARGETS[targetKey]
  const baseline = loadPublishedBaselineSnapshotImmutable(target.product_id)
  if (!baseline) {
    throw new Error(`No baseline snapshot for ${targetKey}`)
  }

  if (isLowScoreProductRemediated(targetKey)) {
    const latest = loadPublishedDisplaySnapshot(target.product_id)!
    return {
      target,
      baseline,
      previous_snapshot: latest,
      new_snapshot: latest,
      review: buildRickLowScoreReview({
        score: target.expected_score,
        primary_score_driving_concern: target.primary_score_driving_concern,
        reviewer_notes: target.reviewer_notes,
      }),
      skipped: true,
    }
  }

  const review = buildRickLowScoreReview({
    score: baseline.score.pac_safety_score,
    primary_score_driving_concern: target.primary_score_driving_concern,
    reviewer_notes: target.reviewer_notes,
  })

  const overrideText = resolveDescriptionOverride(target, baseline)
  const reviewedAtDate = review.reviewed_at.split('T')[0]

  const draft = saveDescriptionOverrideDraft({
    product_id: target.product_id,
    proposed_override_text: overrideText,
    created_by: REMEDIATION_REVIEWER_ID,
  })
  submitDescriptionOverrideForReview(draft.override_id)

  const { previous_snapshot, new_snapshot } = approveDescriptionOverride(draft.override_id, {
    reviewer_id: REMEDIATION_REVIEWER_ID,
    low_score_publication_review: review,
    display_remediation: {
      methodology_disclaimer: STANDARD_METHODOLOGY_DISCLAIMER,
      low_score_last_reviewed_at: reviewedAtDate,
    },
    notes: `Phase 4.5 remediation — ${target.slug}`,
  })

  const gate = validateRemediatedSnapshot(new_snapshot, targetKey, review)
  if (!gate.ok) {
    throw new Error(
      `Remediation gate failed for ${targetKey}: ${gate.failures.map((f) => f.message).join('; ')}`,
    )
  }

  return {
    target,
    baseline,
    previous_snapshot,
    new_snapshot,
    review,
    skipped: false,
  }
}

export function remediateTfalAndCaraway(): {
  tfal: ReturnType<typeof remediateLowScorePublishedProduct>
  caraway: ReturnType<typeof remediateLowScorePublishedProduct>
} {
  return {
    tfal: remediateLowScorePublishedProduct('tfal'),
    caraway: remediateLowScorePublishedProduct('caraway'),
  }
}

export function assertRemediationPublicRender(targetKey: LowScoreRemediationTarget): void {
  const target = REMEDIATION_TARGETS[targetKey]
  const render = mergePublishedRenderPayload(loadPublishedDisplaySnapshot(target.product_id)!, [])
  if (targetKey === 'tfal') {
    if (render.display.product_description !== TFAL_NEUTRAL_DESCRIPTION_OVERRIDE) {
      throw new Error('T-Fal public render missing neutral PTFE override')
    }
    if (/contradicts marketing|non-toxic|markets this product/i.test(render.display.product_description)) {
      throw new Error('T-Fal public render still contains risky brand/marketing language')
    }
  }
  if (render.display.methodology_disclaimer !== STANDARD_METHODOLOGY_DISCLAIMER) {
    throw new Error(`${targetKey} public render missing standard methodology disclaimer`)
  }
  if (render.score.pac_safety_score !== target.expected_score) {
    throw new Error(`${targetKey} score changed during remediation`)
  }
  if (render.score.tier !== target.expected_tier) {
    throw new Error(`${targetKey} tier changed during remediation`)
  }
}

export function assertBaselineImmutable(targetKey: LowScoreRemediationTarget, beforeHash: string): void {
  const target = REMEDIATION_TARGETS[targetKey]
  const baseline = loadPublishedBaselineSnapshotImmutable(target.product_id)
  if (!baseline) throw new Error('Baseline missing')
  if (hashPublishedDisplaySnapshot(baseline) !== beforeHash) {
    throw new Error(`${targetKey} baseline content_hash changed — must remain immutable`)
  }
}
