import { hasQuantitativeAudienceSize } from './audience-extract.mjs'

export const NO_QUANTITATIVE_AUDIENCE_BASIS_RE =
  /no\s+(?:exact\s+)?figure(?:s)?\s+in\s+source|no\s+subscriber\s+count|no\s+listener\s+count|no\s+member\s+count|no\s+follower\s+count|no\s+quantitative|not\s+provided\s+in\s+source|not\s+available\s+in\s+source|no\s+count\s+provided|no\s+public\s+count|could\s+not\s+(?:be\s+)?verified|without\s+(?:a\s+)?(?:specific\s+)?(?:subscriber|listener|follower|member)\s+count|estimate\s+inferred\s+from|inferred\s+from\s+(?:the\s+)?(?:channel\s+)?description(?:\s+only)?|description\s+only|basis\s+not\s+specified|no\s+signal|zero\s+quantitative/i

export const AUDIENCE_UNVERIFIED_NOTE =
  'Audience unverified — no quantitative count in retrieval or on live channel page'

const NOTE_ALREADY_WRITTEN_RE = /audience unverified/i

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
 * @param {{ size: string, basis: string }} liveAudience
 */
export function applyLiveAudience(channel, liveAudience) {
  return {
    ...channel,
    audience_verified: true,
    audience_size: liveAudience.size,
    audience_basis: liveAudience.basis,
  }
}

/**
 * Single enforcement point for audience — call once after verification.
 * Live fetch wins; synthesis counts count unless basis admits none and no live.
 * @param {object} channel
 */
export function enforceAudienceRules(channel) {
  if (channel.channel_type === 'podcast') {
    return {
      ...channel,
      audience_verified: false,
      audience_size: 'unverified',
      audience_basis: channel.audience_basis || 'No public listener count (Apple/Spotify)',
      score_note: noteOnce(channel.score_note, AUDIENCE_UNVERIFIED_NOTE),
    }
  }

  const sizeText = String(channel.audience_size ?? '').trim()
  const basisText = String(channel.audience_basis ?? '').trim()

  if (hasQuantitativeAudienceSize(sizeText) && !basisAdmitsNoQuantitativeSignal(basisText)) {
    return channel
  }

  if (hasQuantitativeAudienceSize(sizeText) && basisAdmitsNoQuantitativeSignal(basisText)) {
    return {
      ...channel,
      audience_verified: false,
      audience_size: 'unverified',
      audience_basis: basisText,
      score_note: noteOnce(
        channel.score_note,
        'Audience unverified — synthesis cited a number but basis admits no quantitative source',
      ),
    }
  }

  return {
    ...channel,
    audience_verified: false,
    audience_size: 'unverified',
    audience_basis: basisText || undefined,
    score_note: noteOnce(channel.score_note, AUDIENCE_UNVERIFIED_NOTE),
  }
}

/**
 * @param {string | undefined} existing
 * @param {string} note
 */
function noteOnce(existing, note) {
  const e = String(existing ?? '').trim()
  if (!e) return note
  if (NOTE_ALREADY_WRITTEN_RE.test(e) || e.includes(note)) return e
  return `${e}; ${note}`
}

/** @deprecated use enforceAudienceRules once post-verify */
export function scrubChannelCandidate(channel) {
  return channel ?? {}
}

export function fixAudienceContradictions(channel) {
  return channel ?? {}
}
