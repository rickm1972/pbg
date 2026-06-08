import type { LowScorePublicationReview } from '../../../types/apr'
import { LOW_SCORE_GATE_VERSION } from '../negativeScoreGate'

export function buildApprovedLowScoreReview(input: {
  score: number
  primary_score_driving_concern: string
  reviewer_id?: string
  reviewed_at?: string
}): LowScorePublicationReview {
  return {
    reviewer_id: input.reviewer_id ?? 'fixture-reviewer',
    reviewed_at: input.reviewed_at ?? '2026-06-05T12:00:00.000Z',
    low_score_gate_version: LOW_SCORE_GATE_VERSION,
    score_at_review: input.score,
    primary_score_driving_concern: input.primary_score_driving_concern,
    evidence_sufficiency: 'passed',
    language_safety: 'passed',
    approval_status: 'approved',
    reviewer_notes: 'Fixture-approved low-score publication review.',
  }
}

export const METHODOLOGY_DISCLAIMER_FIXTURE =
  'This score does not mean the product is unsafe; it reflects relative PAC exposure considerations under our PAC Safety Score methodology.'
