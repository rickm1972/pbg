import {
  COMMUNITY_CHANNEL_TYPES,
  MEDIA_CHANNEL_TYPES,
  OUTREACH_ORIENTATIONS,
} from './schema.mjs'
import { fixAudienceContradictions } from './audience-rules.mjs'
import { computeChannelScore } from './score-channel.mjs'

const MAX_COMMUNITIES = 30
const MAX_PER_TYPE = 8
const MAX_MEDIA = 15
const MAX_INDUSTRY = 12

/**
 * @param {string} [value]
 */
export function normalizeOrientation(value) {
  const v = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
  const map = {
    community: 'community',
    advocacy: 'advocacy',
    'independent-expert': 'independent-expert',
    independent_expert: 'independent-expert',
    expert: 'independent-expert',
    industry: 'industry',
    media: 'media',
  }
  return map[v] ?? 'community'
}

/**
 * @param {object} channel
 */
function enrichChannel(channel) {
  const normalized = fixAudienceContradictions(channel)
  const scored = computeChannelScore(normalized)
  return {
    ...normalized,
    orientation: normalizeOrientation(normalized.orientation),
    topic_relevance: scored.topic_relevance,
    topic_evidence_count: scored.topic_evidence_count,
    audience_verified: scored.audience_verified,
    audience_size: scored.audience_size,
    audience_basis: scored.audience_basis,
    score: scored.score,
    score_note: scored.score_note,
  }
}

/**
 * @param {object[]} candidates
 * @param {number} maxLimit
 */
export function selectBalancedCommunities(candidates, maxLimit = MAX_COMMUNITIES) {
  const sorted = [...candidates].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
  const selected = []
  const typeCounts = {}

  for (const c of sorted) {
    if (selected.length >= maxLimit) break
    const t = c.channel_type
    if ((typeCounts[t] ?? 0) >= MAX_PER_TYPE) continue
    selected.push(c)
    typeCounts[t] = (typeCounts[t] ?? 0) + 1
  }

  for (const c of sorted) {
    if (selected.length >= maxLimit) break
    if (selected.includes(c)) continue
    const t = c.channel_type
    if ((typeCounts[t] ?? 0) >= MAX_PER_TYPE) continue
    selected.push(c)
    typeCounts[t] = (typeCounts[t] ?? 0) + 1
  }

  return selected
}

/**
 * @param {object[]} rawCommunities
 * @param {object[]} rawMedia
 */
export function partitionChannelGroups(rawCommunities, rawMedia) {
  const media = [...(rawMedia ?? [])]
  const communities = []

  for (const c of rawCommunities ?? []) {
    if (MEDIA_CHANNEL_TYPES.includes(c.channel_type)) {
      media.push(c)
    } else if (COMMUNITY_CHANNEL_TYPES.includes(c.channel_type)) {
      communities.push(c)
    } else {
      communities.push(c)
    }
  }

  return { communities, media_outlets: media }
}

/**
 * Split seeding targets from industry / mis-oriented entries.
 * @param {object[]} communities
 */
export function partitionByOrientation(communities) {
  const outreach = []
  const industry_channels = []

  for (const c of communities ?? []) {
    const orientation = normalizeOrientation(c.orientation)
    const enriched = { ...c, orientation }
    if (orientation === 'industry') {
      industry_channels.push(enriched)
    } else if (orientation === 'media') {
      /* Misplaced journalism — belongs in media_outlets, not seeding list */
      continue
    } else if (OUTREACH_ORIENTATIONS.has(orientation)) {
      outreach.push(enriched)
    } else {
      outreach.push({ ...enriched, orientation: 'community' })
    }
  }

  return { outreach, industry_channels }
}

/**
 * @param {object[]} list
 * @param {{ idPrefix: string, priorityTop?: number }} opts
 */
function rankChannelList(list, { idPrefix, priorityTop = 0 }) {
  return list.map((c, i) => {
    const rank = i + 1
    const priorityCap = priorityTop > 0 ? Math.min(priorityTop, list.length) : 0
    return {
      ...c,
      channel_id: `${idPrefix}_${String(rank).padStart(3, '0')}`,
      rank,
      is_priority_top_10: priorityCap > 0 && rank <= priorityCap,
    }
  })
}

/**
 * @param {{ communities: object[], media_outlets: object[], log?: (msg: string) => void }} input
 */
function dedupeChannels(list) {
  const seen = new Set()
  return (list ?? []).filter((c) => {
    const key = String(c?.url_or_handle ?? c?.channel_name ?? '')
      .trim()
      .toLowerCase()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function finalizeChannelMap({ communities, media_outlets, log = () => {} }) {
  const { outreach: rawOutreach, industry_channels: rawIndustry } = partitionByOrientation(
    dedupeChannels(communities),
  )

  const enrichedOutreach = rawOutreach
    .filter((c) => c?.channel_name && c?.url_or_handle)
    .map(enrichChannel)

  const enrichedIndustry = rawIndustry
    .filter((c) => c?.channel_name && c?.url_or_handle)
    .map(enrichChannel)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, MAX_INDUSTRY)

  const balanced = selectBalancedCommunities(enrichedOutreach, MAX_COMMUNITIES)

  const typeCounts = {}
  for (const c of balanced) {
    typeCounts[c.channel_type] = (typeCounts[c.channel_type] ?? 0) + 1
  }
  const dominant = Object.entries(typeCounts).find(([, n]) => n > MAX_PER_TYPE)
  if (dominant) {
    log(`  Type balance: capped ${dominant[0]} at ${dominant[1]} (max ${MAX_PER_TYPE} per type)`)
  }

  if (balanced.length < MAX_COMMUNITIES) {
    log(`  Communities in map: ${balanced.length} (no padding to ${MAX_COMMUNITIES})`)
  }

  if (enrichedIndustry.length) {
    log(`  Industry / counter-aligned channels: ${enrichedIndustry.length} (separate section)`)
  }

  const rankedCommunities = rankChannelList(balanced, {
    idPrefix: 'ch',
    priorityTop: 10,
  })

  const enrichedMedia = (media_outlets ?? [])
    .filter((c) => c?.channel_name && c?.url_or_handle)
    .map((c) => enrichChannel({ ...c, orientation: 'media' }))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, MAX_MEDIA)

  const rankedMedia = rankChannelList(enrichedMedia, { idPrefix: 'med', priorityTop: 0 })
  const rankedIndustry = rankChannelList(enrichedIndustry, { idPrefix: 'ind', priorityTop: 0 })

  return {
    communities: rankedCommunities,
    media_outlets: rankedMedia,
    industry_channels: rankedIndustry,
  }
}
