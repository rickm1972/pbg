/**
 * Global public product-page methodology disclaimer and review date resolution.
 */

import type { AprDisplayPayload } from '../../types/apr'

export const GLOBAL_METHODOLOGY_DISCLAIMER =
  'The PAC Safety Score reflects plastic-associated-chemical exposure risk under our methodology, based on disclosed materials as of the review date. It is not an overall product safety or quality judgment.'

export function resolvePublicMethodologyDisclaimer(
  display: Pick<AprDisplayPayload, 'methodology_disclaimer'> | null | undefined,
): string {
  const fromSnapshot = display?.methodology_disclaimer?.trim()
  return fromSnapshot || GLOBAL_METHODOLOGY_DISCLAIMER
}

export function resolvePublicReviewDate(input: {
  display: Pick<AprDisplayPayload, 'low_score_last_reviewed_at' | 'last_reviewed_at'> | null | undefined
  snapshotPublishedAt?: string | null
  scoreRunTimestamp?: string | null
}): string | null {
  const lowScore = input.display?.low_score_last_reviewed_at?.trim()
  if (lowScore) return lowScore

  const lastReviewed = input.display?.last_reviewed_at?.trim()
  if (lastReviewed) return lastReviewed

  const publishedAt = input.snapshotPublishedAt?.trim()
  if (publishedAt) return publishedAt

  const runTs = input.scoreRunTimestamp?.trim()
  if (runTs) return runTs

  return null
}
