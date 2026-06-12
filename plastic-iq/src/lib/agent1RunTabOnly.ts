import { requiresFullPipelineResetBeforeAgent1Run } from './pipelineCatalog'

/** T-Fal — validation product; may re-run from Run tab (reset + run). */
export const AGENT1_TFAL_PRODUCT_ID = '7a457a86-ab62-4cbf-90b9-ccaeafe06896'

/** Lodge cast iron — validation duo + inert-cookware calibration. */
export const AGENT1_LODGE_PRODUCT_ID = '1cf2fa4e-5cdd-4798-8f3c-6c273ae69fa8'

/** HexClad — Lodge validation duo (materials-science pair). */
export const AGENT1_HEXCLAD_PRODUCT_ID = 'fd05c5fb-19c2-4bc0-9882-ce73a7644ef5'

/** Lodge + HexClad — Agent 1 re-run batch (not T-Fal). */
export const AGENT1_VALIDATION_DUO_PRODUCT_IDS: readonly string[] = [
  AGENT1_LODGE_PRODUCT_ID,
  AGENT1_HEXCLAD_PRODUCT_ID,
] as const

/** Statuses that must reset to unscored before Agent 1 can run again — never rerun from these as-is. */
export const AGENT1_MUST_RESET_BEFORE_RERUN_STATUSES = new Set([
  'evidence_awaiting_review',
  'evidence_pending',
  'evidence_in_progress',
  'evidence_rejected',
])

/**
 * Partial Agent 1 evidence wipe before re-run (any product not requiring full pipeline reset).
 */
export function canAgent1RetestReset(agentStatus: string): boolean {
  if (requiresFullPipelineResetBeforeAgent1Run(agentStatus)) return false
  return agentStatus !== 'unscored'
}

/** True when UI must clear prior bundle and leave Awaiting review before starting Agent 1. */
export function mustResetAgent1BeforeRerun(agentStatus: string): boolean {
  return AGENT1_MUST_RESET_BEFORE_RERUN_STATUSES.has(agentStatus)
}

/** Prior run or stalled in_progress — Run Agent 1 clears evidence first, then runs. */
export function showAgent1RetestResetButton(agentStatus: string, _productId?: string): boolean {
  return canAgent1RetestReset(agentStatus)
}
