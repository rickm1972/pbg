import { hasQuantitativeAudienceSize } from './audience-extract.mjs'
import { TOPIC_RELEVANCE_LEVELS } from './schema.mjs'

/** Topic saturation dominates; audience contributes when any estimate exists. */
const RELEVANCE_POINTS = {
  saturated: 50,
  frequent: 32,
  occasional: 16,
  one_off: 4,
}

const ACTIVITY_POINTS = {
  hot: 25,
  active: 18,
  moderate: 10,
  dormant: 3,
}

const AUDIENCE_MAX = 25

const NO_AUDIENCE_SIGNAL_RE =
  /^(?:not\s+specified|unknown|unverified|n\/a|not\s+available|none|—|-|\s*)$/i

/** @param {string} [value] */
export function normalizeTopicRelevance(value) {
  const v = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/-/g, '_')
  if (TOPIC_RELEVANCE_LEVELS.includes(v)) return v
  if (v === 'adjacent') return 'occasional'
  if (v === 'oneoff') return 'one_off'
  return 'occasional'
}

/**
 * Count distinct topic evidence (URLs or listed refs).
 * @param {object} channel
 */
export function countTopicEvidence(channel) {
  const n = Number(channel.topic_evidence_count)
  if (!Number.isNaN(n) && n > 0) return Math.floor(n)
  const refs = Array.isArray(channel.topic_evidence_refs)
    ? channel.topic_evidence_refs.filter(Boolean)
    : []
  const urls = new Set(refs.map((u) => String(u).trim()).filter((u) => u.startsWith('http')))
  if (channel.evidence_url) urls.add(String(channel.evidence_url).trim())
  return urls.size
}

/**
 * Enforce saturated / frequent caps from evidence count.
 * @param {object} channel
 */
export function applyTopicRelevanceCap(channel) {
  const n = countTopicEvidence(channel)
  let rel = normalizeTopicRelevance(channel.topic_relevance)

  if (n >= 3) {
    if (rel === 'saturated') return { topic_relevance: 'saturated', topic_evidence_count: n }
    return { topic_relevance: rel, topic_evidence_count: n }
  }

  if (n >= 1) {
    if (rel === 'saturated') rel = 'frequent'
    return { topic_relevance: rel, topic_evidence_count: n }
  }

  if (rel === 'saturated' || rel === 'frequent') rel = 'occasional'
  return { topic_relevance: rel, topic_evidence_count: n }
}

/**
 * Best-effort audience from size text + basis. Unverified only when no signal at all.
 * @param {object} channel
 */
export function resolveAudienceEstimate(channel) {
  const sizeText = String(channel.audience_size ?? '').trim()
  const basisText = String(channel.audience_basis ?? '').trim()

  if (channel.audience_verified === true && hasQuantitativeAudienceSize(sizeText)) {
    return {
      audience_verified: true,
      audience_size: sizeText,
      audience_basis: basisText || undefined,
      score_note: undefined,
    }
  }

  if (/^unverified$/i.test(sizeText) || channel.audience_verified === false) {
    return {
      audience_verified: false,
      audience_size: 'unverified',
      audience_basis: basisText || undefined,
      score_note: undefined,
    }
  }

  if (channel.audience_verified === false && !sizeText && !basisText) {
    return {
      audience_verified: false,
      audience_size: undefined,
      audience_basis: undefined,
      score_note: undefined,
    }
  }

  if (NO_AUDIENCE_SIGNAL_RE.test(sizeText) && !basisText) {
    return {
      audience_verified: false,
      audience_size: undefined,
      audience_basis: undefined,
      score_note: undefined,
    }
  }

  if (!sizeText && basisText) {
    const inferred = inferSizeFromBasis(basisText)
    if (inferred) {
      return {
        audience_verified: true,
        audience_size: inferred.size,
        audience_basis: basisText,
        score_note: undefined,
      }
    }
  }

  if (sizeText) {
    return {
      audience_verified: true,
      audience_size: sizeText,
      audience_basis: basisText || 'Estimate provided in synthesis (basis not specified)',
      score_note: undefined,
    }
  }

  return {
    audience_verified: false,
    audience_size: undefined,
    audience_basis: undefined,
    score_note: undefined,
  }
}

function inferSizeFromBasis(basis) {
  const b = basis.toLowerCase()
  if (/1m\+|million\+|over\s+a\s+million|multi.?million/i.test(b)) return { size: '~1M+' }
  if (/hundreds?\s+of\s+thousands|100k|100,000/i.test(b)) return { size: '~100K' }
  if (/tens?\s+of\s+thousands|10k|10,000/i.test(b)) return { size: '~10K' }
  if (/largest|biggest|most popular/i.test(b)) return { size: '~500K+ (inferred: major/largest)' }
  if (/major|widely|popular|top.{0,12}podcast/i.test(b)) return { size: '~100K+ (inferred: major)' }
  if (/niche|small but active|growing/i.test(b)) return { size: '~5K–25K (inferred: niche)' }
  return null
}

/**
 * @param {string} text
 * @returns {number | null}
 */
export function parseAudienceReach(text) {
  const raw = String(text ?? '').trim()
  if (!raw || /^unverified$/i.test(raw)) return null

  const tilde = raw.match(/~\s*([\d,.]+)\s*([kmb])?\+?/i)
  if (tilde) {
    return scaleNumber(parseFloat(tilde[1].replace(/,/g, '')), tilde[2])
  }

  const plus = raw.match(/([\d,.]+)\s*([kmb])?\+/i)
  if (plus) {
    return scaleNumber(parseFloat(plus[1].replace(/,/g, '')), plus[2])
  }

  const m = raw.match(/([\d,.]+)\s*([kmb])?\s*(million|billion|thousand)?/i)
  if (!m) {
    if (/1m\+|million\+/i.test(raw)) return 1_000_000
    if (/100k/i.test(raw)) return 100_000
    if (/10k/i.test(raw)) return 10_000
    return null
  }
  let n = parseFloat(m[1].replace(/,/g, ''))
  if (Number.isNaN(n)) return null
  return scaleNumber(n, m[2] || m[3])
}

function scaleNumber(n, suffix) {
  const s = String(suffix ?? '').toLowerCase()
  if (s === 'k' || s === 'thousand') return n * 1_000
  if (s === 'm' || s === 'million') return n * 1_000_000
  if (s === 'b' || s === 'billion') return n * 1_000_000_000
  return n
}

function audiencePoints(reach) {
  if (reach == null || reach <= 0) return 0
  if (reach >= 5_000_000) return AUDIENCE_MAX
  if (reach >= 1_000_000) return 22
  if (reach >= 500_000) return 18
  if (reach >= 100_000) return 14
  if (reach >= 50_000) return 10
  if (reach >= 10_000) return 6
  return 3
}

/**
 * @param {object} channel
 */
export function computeChannelScore(channel) {
  const relevanceCap = applyTopicRelevanceCap(channel)
  const topic_relevance = relevanceCap.topic_relevance
  let score = RELEVANCE_POINTS[topic_relevance] ?? RELEVANCE_POINTS.occasional
  score += ACTIVITY_POINTS[channel.activity_level] ?? ACTIVITY_POINTS.moderate ?? 0

  const audience = resolveAudienceEstimate(channel)
  let score_note = channel.score_note ? String(channel.score_note) : undefined

  if (audience.audience_verified && audience.audience_size) {
    const reach = parseAudienceReach(audience.audience_size)
    score += audiencePoints(reach)
  }

  return {
    score: Math.min(100, Math.max(0, Math.round(score))),
    score_note,
    audience_verified: audience.audience_verified,
    audience_size: audience.audience_size,
    audience_basis: audience.audience_basis,
    topic_relevance,
    topic_evidence_count: relevanceCap.topic_evidence_count,
  }
}
