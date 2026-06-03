/** T-Fal — Agent 1 testing: Run tab + reset; hidden from Awaiting review until a new run finishes. */
export const AGENT1_TFAL_PRODUCT_ID = '7a457a86-ab62-4cbf-90b9-ccaeafe06896'

export function isAgent1HeldFromAwaitingReviewTab(productId: string): boolean {
  return productId === AGENT1_TFAL_PRODUCT_ID
}

export function canAgent1RetestReset(productId: string): boolean {
  return isAgent1HeldFromAwaitingReviewTab(productId)
}

/** Prior run or stalled in_progress — Run Agent 1 clears evidence first, then runs (T-Fal testing). */
export function showAgent1RetestResetButton(agentStatus: string, productId: string): boolean {
  if (!canAgent1RetestReset(productId)) return false
  return agentStatus !== 'unscored'
}
