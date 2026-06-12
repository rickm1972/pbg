/**
 * Gate 1 approval gating contract — hard blockers vs acknowledgment warnings.
 * Single source of truth for which Agent 1 codes block approval vs require acknowledgment only.
 */

export const HARD_APPROVAL_BLOCKER_CODES = new Set([
  'MANUFACTURER_MATERIAL_EVIDENCE_MISSING',
  'category_config_required',
])

export const ACKNOWLEDGMENT_WARNING_CODES = new Set([
  'LAB_RESULTS_LINK_NOT_RETRIEVED',
  'NO_THIRD_PARTY_TESTING_FOUND',
  'MANUFACTURER_PDP_NOT_VALIDATED',
])

export const SCORE_CREDIT_WHEN_PASSED_CHECK_IDS = new Set([
  'external.coated_product_lab_results',
])

/**
 * @param {string | null | undefined} message
 */
export function extractApprovalCode(message) {
  const m = String(message ?? '').trim()
  const head = m.split(':')[0]?.trim()
  return head || null
}

/**
 * @param {string | null | undefined} message
 */
export function isHardApprovalBlockerMessage(message) {
  const code = extractApprovalCode(message)
  if (!code) return false
  if (ACKNOWLEDGMENT_WARNING_CODES.has(code)) return false
  if (HARD_APPROVAL_BLOCKER_CODES.has(code)) return true
  if (/^Required (evidence|check failed|evidence review):/i.test(String(message ?? ''))) return true
  if (/^Contradiction:/i.test(String(message ?? ''))) return true
  if (/^Canonical mappings missing/i.test(String(message ?? ''))) return true
  if (/^category config required/i.test(String(message ?? ''))) return true
  return HARD_APPROVAL_BLOCKER_CODES.has(code)
}

/**
 * @param {string | null | undefined} message
 */
export function isAcknowledgmentWarningMessage(message) {
  const code = extractApprovalCode(message)
  if (code && ACKNOWLEDGMENT_WARNING_CODES.has(code)) return true
  if (/variant mismatch|Outdated\/context third-party PTFE/i.test(String(message ?? ''))) return true
  if (/Manufacturer (homepage|collection|region_mismatch)/i.test(String(message ?? ''))) return true
  return false
}

/**
 * @param {string[]} messages
 */
export function filterHardApprovalBlockers(messages) {
  return (messages ?? []).filter((m) => isHardApprovalBlockerMessage(m))
}

/**
 * Collect acknowledgment warnings from metadata + stored source validation (incl. legacy blockers).
 * @param {object | null | undefined} metadata
 */
export function collectGate1AcknowledgmentWarnings(metadata) {
  /** @type {string[]} */
  const out = []
  const push = (msg) => {
    const s = String(msg ?? '').trim()
    if (!s || out.includes(s)) return
    out.push(s)
  }

  for (const w of metadata?.warnings ?? []) push(w)

  const sv = metadata?.structured_evidence?.agent1_source_validation
  for (const w of sv?.warnings ?? []) push(w)
  for (const b of sv?.blockers ?? []) {
    if (isAcknowledgmentWarningMessage(b)) push(b)
  }

  return out
}
