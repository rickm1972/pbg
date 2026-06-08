/**
 * Phase 4 extension point — negative-score publication gate (NOT enforced yet).
 *
 * Future plug-in location: runAprContractPreflight() calls assertNegativeScorePublicationPolicy
 * after assertion 11 when enabled. Score < threshold will require additional publication copy
 * review before human approval — not implemented in Phase 4.
 */

export const NEGATIVE_SCORE_PUBLICATION_GATE = {
  id: 'negative_score_publication',
  /** Set true when Phase 5+ implements publication safety for sub-75 scores. */
  enabled: false,
  threshold: 75,
  plugin_point: 'contractPreflight.assertion_11_after_published_snapshot',
} as const

export type NegativeScoreGateViolation = {
  check_id: 'negative_score.publication_copy_required'
  rule: 'negative_score_publication'
  path: string
  message: string
}

/** Placeholder — returns no violations while gate is disabled. */
export function assertNegativeScorePublicationPolicy(_record: {
  score: { payload: { pac_safety_score: number; tier: string } }
}): NegativeScoreGateViolation[] {
  if (!NEGATIVE_SCORE_PUBLICATION_GATE.enabled) {
    return []
  }
  // Phase 5+: enforce publication copy requirements when pac_safety_score < threshold
  return []
}
