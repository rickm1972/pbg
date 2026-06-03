/**
 * Pipeline catalog run rules — keep in sync with src/lib/pipelineCatalog.ts
 */

export const PIPELINE_CATALOG_EXPECTED_COUNT = 25

/** @param {string} agentStatus */
export function canRunAgent2Sequential(agentStatus) {
  if (agentStatus === 'evidence_awaiting_review' || agentStatus === 'evidence_in_progress') {
    return false
  }
  return (
    agentStatus === 'evidence_approved' ||
    agentStatus === 'normalization_rejected' ||
    agentStatus === 'normalization_in_progress'
  )
}

export const AGENT3_SEQUENTIAL_RUN_STATUSES = new Set([
  'normalization_approved',
  'scoring_review_pending',
  'scoring_rejected',
])

export const AGENT3_VALIDATION_RERUN_STATUSES = new Set([
  'normalization_approved',
  'scoring_review_pending',
  'scoring_approved',
])

export const AGENT4_SEQUENTIAL_RUN_STATUSES = new Set(['scoring_approved', 'qa_rejected'])
