/** Fields exempt from source-grounding — always filled as creative labels. */
export const PERSONA_LABEL_EXEMPT_KEYS = ['persona_name', 'persona_nickname']

/**
 * @param {string} targetSegment
 */
function fallbackNicknameFromSegment(targetSegment) {
  const s = String(targetSegment ?? '').trim()
  if (/kitchen|non-?toxic|household/i.test(s)) return 'the Health-First Home Keeper'
  if (/baby|parent|kid/i.test(s)) return 'the Cautious Parent Shopper'
  if (/environment|eco/i.test(s)) return 'the Conscious Household Buyer'
  const short = s.length > 48 ? `${s.slice(0, 45).trim()}…` : s
  return short ? `the ${short} Buyer` : 'the Primary Segment Buyer'
}

/**
 * Safety net if the model leaves labels blank (should be rare).
 * @param {Record<string, string>} content
 * @param {string} targetSegment
 */
export function ensurePersonaLabels(content, targetSegment) {
  const out = { ...content }
  if (!out.persona_name?.trim()) {
    out.persona_name = 'Maya'
  }
  if (!out.persona_nickname?.trim()) {
    out.persona_nickname = fallbackNicknameFromSegment(targetSegment)
  }
  return out
}

/**
 * @param {{ persona_name?: string, persona_nickname?: string }} content
 */
export function formatPersonaDisplayName(content) {
  const name = content.persona_name?.trim() ?? ''
  const nick = content.persona_nickname?.trim() ?? ''
  if (name && nick) return `${name}, ${nick}`
  return name || nick || ''
}
