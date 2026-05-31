/**
 * Hard audience rules: basis text that admits no quantitative signal → unverified only.
 */

export const NO_QUANTITATIVE_AUDIENCE_BASIS_RE =
  /no\s+(?:exact\s+)?figure(?:s)?\s+in\s+source|no\s+subscriber\s+count|no\s+listener\s+count|no\s+member\s+count|no\s+follower\s+count|no\s+quantitative|not\s+provided\s+in\s+source|not\s+available\s+in\s+source|no\s+count\s+provided|no\s+public\s+count|could\s+not\s+(?:be\s+)?verified|without\s+(?:a\s+)?(?:specific\s+)?(?:subscriber|listener|follower|member)\s+count|estimate\s+inferred\s+from|inferred\s+from\s+(?:the\s+)?(?:channel\s+)?description(?:\s+only)?|description\s+only|basis\s+not\s+specified|no\s+signal|zero\s+quantitative/i

/**
 * @param {string} [basis]
 */
export function basisAdmitsNoQuantitativeSignal(basis) {
  const b = String(basis ?? '').trim()
  if (!b) return false
  return NO_QUANTITATIVE_AUDIENCE_BASIS_RE.test(b)
}

/**
 * @param {object} channel
 */
export function fixAudienceContradictions(channel) {
  const basisText = String(channel.audience_basis ?? '').trim()
  if (!basisAdmitsNoQuantitativeSignal(basisText)) {
    return channel
  }
  return {
    ...channel,
    audience_verified: false,
    audience_size: 'unverified',
    score_note: channel.score_note
      ? `${channel.score_note}; audience forced unverified (basis admits no quantitative source)`
      : 'Audience unverified — basis admits no quantitative source',
  }
}
