import { jsonrepair } from 'jsonrepair'
import { loadEnv } from '../lib/env.mjs'
import { isMalformedOrSpamUrl, normalizeSourceUrl } from '../persona/url-guard.mjs'
import { fixAudienceContradictions } from './audience-rules.mjs'
import { countTopicEvidence } from './score-channel.mjs'
import { defaultChannelPerplexityModel } from './pricing.mjs'

const FETCH_TIMEOUT_MS = 12_000
const USER_AGENT =
  'Mozilla/5.0 (compatible; PlasticIQ-ChannelVerify/1.0; +https://plasticbegone.com)'

const TYPE_URL_PATTERNS = {
  subreddit: /reddit\.com\/r\/[A-Za-z0-9_]+/i,
  facebook_group: /facebook\.com\/groups\/[A-Za-z0-9._-]+/i,
  discord: /discord\.(gg|com)\//i,
  podcast: /(podcasts\.apple\.com|open\.spotify\.com\/show|spotify\.com\/show)/i,
  youtube: /youtube\.com\/(channel\/|@|c\/|user\/)/i,
  tiktok: /tiktok\.com\/@[A-Za-z0-9._]+/i,
  instagram: /instagram\.com\/[A-Za-z0-9._]+/i,
  substack: /\.substack\.com|substack\.com\/@/i,
  parenting_forum: /(babycenter|whattoexpect|netmums|mumsnet|community\.|forum\.)/i,
  wellness_forum: /(forum\.|community\.|healthunlocked|patient\.info)/i,
  blog: /(blog\.|medium\.com\/@|wordpress\.com|ghost\.io)/i,
  news_outlet: /(news|times|post|guardian|cnn|npr|org\/news)/i,
}

const YOUTUBE_WATCH_RE = /youtube\.com\/watch|youtu\.be\//i
const YOUTUBE_CHANNEL_PAGE_RE = /youtube\.com\/(channel\/|@|c\/|user\/)/i

/**
 * @param {string} url
 */
function normalizeComparableUrl(url) {
  try {
    const u = new URL(String(url).trim())
    u.hash = ''
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, '')
    let path = u.pathname.replace(/\/+$/, '')
    if (path === '') path = '/'
    return `${u.protocol}//${u.hostname}${path}${u.search}`
  } catch {
    return String(url ?? '').trim().toLowerCase()
  }
}

/**
 * @param {object} channel
 */
export function scrubChannelCandidate(channel) {
  return fixAudienceContradictions(channel ?? {})
}

/**
 * Channel URL cannot be its own evidence.
 * @param {object} channel
 */
export function hasIndependentEvidence(channel) {
  const channelUrl = String(channel.url_or_handle ?? '').trim()
  if (!channelUrl || isMalformedOrSpamUrl(channelUrl)) return false

  const channelNorm = normalizeComparableUrl(channelUrl)
  const evidenceUrl = String(channel.evidence_url ?? '').trim()
  if (evidenceUrl && !isMalformedOrSpamUrl(evidenceUrl)) {
    if (normalizeComparableUrl(evidenceUrl) !== channelNorm) return true
  }

  const refs = Array.isArray(channel.topic_evidence_refs) ? channel.topic_evidence_refs : []
  for (const ref of refs) {
    const r = String(ref ?? '').trim()
    if (!r.startsWith('http') || isMalformedOrSpamUrl(r)) continue
    if (normalizeComparableUrl(r) !== channelNorm) return true
  }

  return false
}

/**
 * @param {string} url
 * @param {string} channelType
 */
export function urlMatchesClaimedChannelType(url, channelType) {
  const pattern = TYPE_URL_PATTERNS[channelType]
  if (!pattern) return /^https?:\/\//i.test(url)
  if (!pattern.test(url)) return false
  if (channelType === 'youtube' && YOUTUBE_WATCH_RE.test(url) && !YOUTUBE_CHANNEL_PAGE_RE.test(url)) {
    return false
  }
  return true
}

/**
 * @param {object} channel
 */
export function isCircularEvidenceOnly(channel) {
  if (hasIndependentEvidence(channel)) return false
  return true
}

/**
 * @param {string} url
 */
function youtubeIdentityKey(url) {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, '')
    if (!/youtube\.com|youtu\.be/i.test(host)) return null
    const path = u.pathname
    const at = path.match(/^\/@([^/]+)/i)
    if (at) return `@${at[1].toLowerCase()}`
    const ch = path.match(/^\/channel\/([^/]+)/i)
    if (ch) return `channel:${ch[1].toLowerCase()}`
    const c = path.match(/^\/c\/([^/]+)/i)
    if (c) return `c:${c[1].toLowerCase()}`
    const user = path.match(/^\/user\/([^/]+)/i)
    if (user) return `user:${user[1].toLowerCase()}`
    return null
  } catch {
    return null
  }
}

/**
 * @param {object} channel
 */
export function singleVideoPhantomRisk(channel) {
  const evidenceCount = countTopicEvidence(channel)
  if (evidenceCount > 1) return { risk: false }

  const refs = []
  if (channel.evidence_url) refs.push(String(channel.evidence_url))
  for (const r of channel.topic_evidence_refs ?? []) refs.push(String(r))

  const watchRefs = refs.filter((u) => YOUTUBE_WATCH_RE.test(u))
  if (!watchRefs.length) return { risk: false, watchUrl: null }

  const claimedKey = youtubeIdentityKey(String(channel.url_or_handle ?? ''))
  if (!claimedKey) {
    return { risk: true, watchUrl: watchRefs[0], reason: 'YouTube entry is not a channel page URL' }
  }

  return { risk: true, watchUrl: watchRefs[0], claimedKey, reason: 'Single-video source for YouTube channel' }
}

/**
 * @param {string} url
 */
async function fetchPage(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/json',
      },
      redirect: 'follow',
    })
    const contentType = res.headers.get('content-type') ?? ''
    let text = ''
    if (res.ok && !contentType.includes('application/json')) {
      const raw = await res.text()
      text = raw.slice(0, 80_000)
    } else if (res.ok) {
      text = await res.text()
    }
    return { ok: res.ok, status: res.status, text, finalUrl: res.url }
  } catch (err) {
    return {
      ok: false,
      status: 0,
      text: '',
      error: err instanceof Error ? err.message : String(err),
    }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * @param {string} watchUrl
 */
async function youtubeOembedAuthor(watchUrl) {
  try {
    const oembedUrl = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(watchUrl)}`
    const res = await fetch(oembedUrl, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (!res.ok) return null
    const data = await res.json()
    return {
      author_name: data?.author_name ? String(data.author_name) : null,
      author_url: data?.author_url ? String(data.author_url) : null,
      author_key: data?.author_url ? youtubeIdentityKey(data.author_url) : null,
    }
  } catch {
    return null
  }
}

/**
 * @param {string} topic
 * @param {string} text
 * @param {string} channelName
 */
function pageMentionsTopic(topic, text, channelName) {
  const hay = `${text} ${channelName}`.toLowerCase()
  const tokens = String(topic)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 3)
  if (!tokens.length) return hay.length > 200
  const hits = tokens.filter((t) => hay.includes(t))
  return hits.length >= Math.min(2, tokens.length) || hits.length >= 1
}

function parseJsonLoose(text) {
  const trimmed = String(text ?? '').trim()
  const fence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/i)
  const raw = fence ? fence[1].trim() : trimmed
  try {
    return JSON.parse(raw)
  } catch {
    return JSON.parse(jsonrepair(raw))
  }
}

/**
 * @param {object} channel
 * @param {string} topic
 * @param {string} apiKey
 * @param {string} model
 */
async function perplexityConfirmChannel(channel, topic, apiKey, model) {
  const evidenceRefs = [
    channel.evidence_url,
    ...(channel.topic_evidence_refs ?? []),
  ]
    .filter(Boolean)
    .join('\n- ')

  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      messages: [
        {
          role: 'system',
          content:
            'You verify whether online channels exist and match claims. Return ONLY valid JSON, no markdown.',
        },
        {
          role: 'user',
          content: `Topic: "${topic}"

Channel name: ${channel.channel_name}
Claimed type: ${channel.channel_type}
Channel URL (must be real channel/home page): ${channel.url_or_handle}
Independent evidence URLs (NOT the same as channel URL):
- ${evidenceRefs || '(none provided)'}

Return JSON:
{"exists":boolean,"matches_claimed_type":boolean,"matches_topic":boolean,"phantom_personal_channel":boolean,"reason":"one sentence"}

Rules:
- exists: the channel URL resolves to a real page for this entity (not invented)
- matches_claimed_type: URL is the right kind of destination (subreddit, YT channel, TikTok profile, etc.) — not a single video unless the type is explicitly a post
- matches_topic: page/content is genuinely about the research topic
- phantom_personal_channel: true if this entry was fabricated from one guest video on another organization's channel (attribute to the host channel instead)
- Reject if the only "evidence" is the channel's own landing URL`,
        },
      ],
    }),
  })

  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    return {
      ok: false,
      reason: `Perplexity error: ${body?.error?.message ?? response.status}`,
    }
  }

  const content = body?.choices?.[0]?.message?.content ?? ''
  let parsed
  try {
    parsed = parseJsonLoose(content)
  } catch {
    return { ok: false, reason: 'Perplexity verification returned invalid JSON' }
  }

  if (parsed.phantom_personal_channel) {
    return { ok: false, reason: parsed.reason || 'Phantom personal channel from host video' }
  }
  if (!parsed.exists || !parsed.matches_claimed_type) {
    return { ok: false, reason: parsed.reason || 'Channel URL not verified' }
  }
  if (!parsed.matches_topic) {
    return { ok: false, reason: parsed.reason || 'Channel not on-topic' }
  }
  return { ok: true, reason: parsed.reason || 'Perplexity confirmed', method: 'perplexity' }
}

/**
 * @param {object} channel
 * @param {string} topic
 */
export async function verifyChannel(channel, topic) {
  const env = loadEnv()
  const url = String(channel.url_or_handle ?? '').trim()
  const name = String(channel.channel_name ?? '').trim()

  if (!name || !url) {
    return { ok: false, reason: 'Missing channel name or URL' }
  }
  if (isMalformedOrSpamUrl(url)) {
    return { ok: false, reason: 'Malformed channel URL' }
  }
  if (isCircularEvidenceOnly(channel)) {
    return { ok: false, reason: 'Circular evidence — channel URL used as sole evidence' }
  }
  if (!hasIndependentEvidence(channel)) {
    return { ok: false, reason: 'No independent evidence URL separate from channel page' }
  }
  if (!urlMatchesClaimedChannelType(url, channel.channel_type)) {
    return {
      ok: false,
      reason: `URL does not match claimed channel type (${channel.channel_type})`,
    }
  }

  const phantom = singleVideoPhantomRisk(channel)
  if (phantom.risk && phantom.watchUrl) {
    const oembed = await youtubeOembedAuthor(phantom.watchUrl)
    if (oembed?.author_key && phantom.claimedKey) {
      if (oembed.author_key !== phantom.claimedKey) {
        return {
          ok: false,
          reason: `Phantom channel: video is hosted on ${oembed.author_name ?? oembed.author_key}, not this channel`,
          method: 'youtube-oembed',
        }
      }
    } else if (phantom.reason && !phantom.claimedKey) {
      return { ok: false, reason: phantom.reason, method: 'structural' }
    }
  }

  const fetchResult = await fetchPage(url)
  let fetchTopicMatch = false
  if (fetchResult.ok && fetchResult.text) {
    const titleMatch =
      fetchResult.text.toLowerCase().includes(name.toLowerCase().slice(0, 12)) ||
      name.length < 4
    fetchTopicMatch = pageMentionsTopic(topic, fetchResult.text, name)
    if (titleMatch && fetchTopicMatch) {
      return {
        ok: true,
        reason: 'Direct fetch: page resolves and content matches topic',
        method: 'fetch',
        status: fetchResult.status,
      }
    }
  }

  const apiKey = env.PERPLEXITY_API_KEY
  if (!apiKey) {
    if (fetchResult.ok && fetchTopicMatch) {
      return {
        ok: true,
        reason: 'Direct fetch: page resolves with topic match (no Perplexity key)',
        method: 'fetch',
      }
    }
    return {
      ok: false,
      reason: fetchResult.error
        ? `Fetch failed: ${fetchResult.error}`
        : `Fetch HTTP ${fetchResult.status} — set PERPLEXITY_API_KEY for fallback verification`,
    }
  }

  const model = defaultChannelPerplexityModel()
  const px = await perplexityConfirmChannel(channel, topic, apiKey, model)
  if (px.ok) {
    return { ...px, method: px.method ?? 'perplexity' }
  }

  return {
    ok: false,
    reason: px.reason ?? (fetchResult.ok ? 'Topic/type not confirmed' : `Fetch HTTP ${fetchResult.status}`),
  }
}

/**
 * @param {object[]} channels
 * @param {{ topic: string, log?: (msg: string) => void, label?: string }} opts
 */
export async function filterVerifiedChannels(channels, { topic, log = () => {}, label = 'channel' }) {
  const scrubbed = (channels ?? []).map(scrubChannelCandidate)
  const kept = []
  let rejected = 0

  for (const channel of scrubbed) {
    const result = await verifyChannel(channel, topic)
    if (result.ok) {
      kept.push(channel)
      log(
        `  ✓ Verified ${label}: ${channel.channel_name} (${result.method ?? 'ok'})`,
      )
    } else {
      rejected += 1
      log(`  ✗ Rejected ${label}: ${channel.channel_name} — ${result.reason}`)
    }
  }

  if (rejected > 0) {
    log(`  ${label} verification: kept ${kept.length}, rejected ${rejected}`)
  }

  return kept
}
