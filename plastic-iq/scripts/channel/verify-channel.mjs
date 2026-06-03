import { jsonrepair } from 'jsonrepair'
import { loadEnv } from '../lib/env.mjs'
import { isMalformedOrSpamUrl, normalizeSourceUrl } from '../persona/url-guard.mjs'
import { applyLiveAudience, enforceAudienceRules } from './audience-rules.mjs'
import {
  extractLiveAudience,
  fetchRedditAbout,
  liveAudienceFromRedditAbout,
  parseSubredditName,
} from './audience-extract.mjs'
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
  return !hasIndependentEvidence(channel)
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
      text = raw.slice(0, 120_000)
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
      contentMatch: false,
    }
  }

  const content = body?.choices?.[0]?.message?.content ?? ''
  let parsed
  try {
    parsed = parseJsonLoose(content)
  } catch {
    return { ok: false, reason: 'Perplexity verification returned invalid JSON', contentMatch: false }
  }

  if (parsed.phantom_personal_channel) {
    return {
      ok: false,
      reason: parsed.reason || 'Phantom personal channel from host video',
      contentMatch: false,
    }
  }
  if (!parsed.exists || !parsed.matches_claimed_type) {
    return { ok: false, reason: parsed.reason || 'Channel URL not verified', contentMatch: false }
  }
  if (!parsed.matches_topic) {
    return { ok: false, reason: parsed.reason || 'Channel not on-topic', contentMatch: false }
  }
  return {
    ok: true,
    reason: parsed.reason || 'Perplexity confirmed',
    method: 'perplexity',
    contentMatch: true,
  }
}

/**
 * @param {(msg: string) => void} auditLog
 * @param {string} msg
 */
function audit(auditLog, msg) {
  if (auditLog) auditLog(msg)
}

/**
 * @param {{ reason?: string, checks?: { urlVerification?: boolean, contentMatch?: boolean } }} result
 */
function classifyRejectionStage(result) {
  const reason = String(result.reason ?? '').toLowerCase()
  if (
    /circular|independent evidence|malformed|missing name|does not match claimed|phantom/i.test(
      reason,
    )
  ) {
    return 'structural'
  }
  if (result.checks?.urlVerification === false) return 'url_fetch'
  if (result.checks?.contentMatch === false) return 'content_match'
  return 'other'
}

/**
 * @param {number} synthesizedCount
 * @param {number} keptCount
 * @param {Array<{ stage: string }>} rejections
 */
export function buildIndustryVerificationNote(synthesizedCount, keptCount, rejections) {
  if (synthesizedCount === 0) {
    return 'Industry: synthesis returned 0 candidates this run.'
  }
  if (keptCount > 0) return null

  const n = synthesizedCount
  const stages = {}
  for (const r of rejections) {
    stages[r.stage] = (stages[r.stage] ?? 0) + 1
  }

  if (stages.url_fetch === n) {
    return `Industry: ${n} candidate${n === 1 ? '' : 's'} synthesized, all rejected at verification (URL fetch failed).`
  }
  if (stages.content_match === n) {
    return `Industry: ${n} candidate${n === 1 ? '' : 's'} synthesized, all rejected at content match (topic mismatch).`
  }
  if (stages.structural === n) {
    return `Industry: ${n} candidate${n === 1 ? '' : 's'} synthesized, all rejected (structural: evidence or URL type).`
  }

  const parts = Object.entries(stages).map(([s, c]) => `${c} at ${s.replace(/_/g, ' ')}`)
  return `Industry: ${n} candidates synthesized, all rejected (${parts.join('; ')}).`
}

/**
 * @param {object} channel
 * @param {string} topic
 * @param {(msg: string) => void} [auditLog]
 */
async function verifySubredditChannel(channel, topic, auditLog) {
  const url = String(channel.url_or_handle ?? '').trim()
  const name = String(channel.channel_name ?? '').trim()
  const sub = parseSubredditName(url)

  if (!sub) {
    audit(auditLog, '    reddit: could not parse subreddit name from URL')
    return null
  }

  audit(auditLog, `    reddit: verifying via about.json (r/${sub})`)
  const about = await fetchRedditAbout(sub)

  if (!about.ok) {
    audit(auditLog, `    reddit: about.json failed (${about.error}) — will try HTML fallback`)
    return null
  }

  const checks = {
    found: true,
    urlVerification: true,
    contentMatch: false,
    liveAudience: false,
  }

  const description = `${about.title} ${about.public_description} ${about.display_name}`
  const topicMatch = pageMentionsTopic(topic, description, name)
  checks.contentMatch = topicMatch

  const liveAudience = liveAudienceFromRedditAbout(about)
  if (liveAudience) {
    checks.liveAudience = true
    audit(auditLog, `    reddit: ${liveAudience.size} (about.json)`)
  } else {
    audit(auditLog, '    reddit: subscriber count missing or suspicious in about.json')
  }

  if (topicMatch) {
    audit(auditLog, '    reddit: content match passed (about.json description)')
    return {
      ok: true,
      reason: 'Reddit about.json: subreddit exists and matches topic',
      method: 'reddit-about.json',
      liveAudience,
      checks,
      rejectionStage: null,
    }
  }

  audit(auditLog, '    reddit: topic weak on about.json — trying Perplexity for content only')
  const env = loadEnv()
  const apiKey = env.PERPLEXITY_API_KEY
  if (apiKey) {
    const model = defaultChannelPerplexityModel()
    const px = await perplexityConfirmChannel(channel, topic, apiKey, model)
    if (px.ok) {
      checks.contentMatch = true
      audit(auditLog, '    reddit: content match passed (Perplexity)')
      return {
        ok: true,
        reason: 'Reddit about.json + Perplexity topic confirmation',
        method: 'reddit-about.json+perplexity',
        liveAudience,
        checks,
      }
    }
    audit(auditLog, `    reddit: Perplexity rejected — ${px.reason}`)
    return {
      ok: false,
      reason: px.reason ?? 'Subreddit not on-topic',
      checks,
      rejectionStage: 'content_match',
    }
  }

  return {
    ok: false,
    reason: 'Subreddit exists (about.json) but topic not confirmed',
    checks,
    rejectionStage: 'content_match',
  }
}

/**
 * @param {object} channel
 * @param {string} topic
 * @param {{ auditLog?: (msg: string) => void }} [opts]
 */
export async function verifyChannel(channel, topic, opts = {}) {
  const { auditLog } = opts
  const env = loadEnv()
  const url = String(channel.url_or_handle ?? '').trim()
  const name = String(channel.channel_name ?? '').trim()

  const checks = {
    found: true,
    urlVerification: false,
    contentMatch: false,
    liveAudience: false,
  }

  const fail = (reason, checksOverride = {}) => ({
    ok: false,
    reason,
    checks: { ...checks, ...checksOverride },
    rejectionStage: classifyRejectionStage({ reason, checks: { ...checks, ...checksOverride } }),
  })

  if (!name || !url) {
    audit(auditLog, '    missing name or URL')
    return fail('Missing channel name or URL')
  }
  if (isMalformedOrSpamUrl(url)) {
    audit(auditLog, '    malformed URL')
    return fail('Malformed channel URL')
  }
  if (isCircularEvidenceOnly(channel)) {
    audit(auditLog, '    failed: circular evidence (channel URL is sole evidence)')
    return fail('Circular evidence — channel URL used as sole evidence')
  }
  if (!hasIndependentEvidence(channel)) {
    audit(auditLog, '    failed: no independent evidence URL')
    return fail('No independent evidence URL separate from channel page')
  }
  if (!urlMatchesClaimedChannelType(url, channel.channel_type)) {
    audit(auditLog, `    failed: URL shape does not match type ${channel.channel_type}`)
    return fail(`URL does not match claimed channel type (${channel.channel_type})`)
  }

  audit(auditLog, '    structural checks passed')

  if (channel.channel_type === 'subreddit') {
    const redditResult = await verifySubredditChannel(channel, topic, auditLog)
    if (redditResult?.ok) {
      return redditResult
    }
    if (redditResult && !redditResult.ok) {
      return { ...redditResult, rejectionStage: redditResult.rejectionStage ?? classifyRejectionStage(redditResult) }
    }
  }

  const phantom = singleVideoPhantomRisk(channel)
  if (phantom.risk && phantom.watchUrl) {
    const oembed = await youtubeOembedAuthor(phantom.watchUrl)
    if (oembed?.author_key && phantom.claimedKey) {
      if (oembed.author_key !== phantom.claimedKey) {
        audit(auditLog, `    failed: phantom channel (host ${oembed.author_name ?? oembed.author_key})`)
        return fail(
          `Phantom channel: video is hosted on ${oembed.author_name ?? oembed.author_key}, not this channel`,
        )
      }
    } else if (phantom.reason && !phantom.claimedKey) {
      audit(auditLog, `    failed: ${phantom.reason}`)
      return fail(phantom.reason)
    }
  }

  const fetchResult = await fetchPage(url)
  checks.urlVerification = fetchResult.ok

  let liveAudience = null
  if (fetchResult.ok && fetchResult.text) {
    liveAudience = await extractLiveAudience(channel, {
      html: fetchResult.text,
      url: fetchResult.finalUrl || url,
    })
    if (liveAudience) {
      checks.liveAudience = true
      audit(auditLog, `    live audience: ${liveAudience.size}`)
    } else {
      audit(auditLog, '    live audience: none on page')
    }
  } else {
    audit(
      auditLog,
      `    fetch failed: ${fetchResult.error ?? `HTTP ${fetchResult.status}`}`,
    )
  }

  let fetchTopicMatch = false
  if (fetchResult.ok && fetchResult.text) {
    const titleMatch =
      fetchResult.text.toLowerCase().includes(name.toLowerCase().slice(0, 12)) ||
      name.length < 4
    fetchTopicMatch = pageMentionsTopic(topic, fetchResult.text, name)
    checks.contentMatch = titleMatch && fetchTopicMatch
    if (checks.contentMatch) {
      audit(auditLog, '    content match: passed (fetch)')
      return {
        ok: true,
        reason: 'Direct fetch: page resolves and content matches topic',
        method: 'fetch',
        status: fetchResult.status,
        liveAudience,
        checks,
      }
    }
    audit(auditLog, '    content match: weak on fetch — trying Perplexity')
  }

  const apiKey = env.PERPLEXITY_API_KEY
  if (!apiKey) {
    if (fetchResult.ok && fetchTopicMatch) {
      checks.contentMatch = true
      return {
        ok: true,
        reason: 'Direct fetch: page resolves with topic match (no Perplexity key)',
        method: 'fetch',
        liveAudience,
        checks,
      }
    }
    audit(auditLog, '    rejected: fetch/topic insufficient and no Perplexity key')
    return {
      ok: false,
      reason: fetchResult.error
        ? `Fetch failed: ${fetchResult.error}`
        : `Fetch HTTP ${fetchResult.status} — set PERPLEXITY_API_KEY for fallback verification`,
      checks,
    }
  }

  const model = defaultChannelPerplexityModel()
  const px = await perplexityConfirmChannel(channel, topic, apiKey, model)
  if (px.ok) {
    checks.contentMatch = true
    audit(auditLog, '    content match: passed (Perplexity)')
    return { ...px, method: px.method ?? 'perplexity', liveAudience, checks }
  }

  audit(auditLog, `    rejected: ${px.reason ?? 'verification failed'}`)
  return fail(
    px.reason ?? (fetchResult.ok ? 'Topic/type not confirmed' : `Fetch HTTP ${fetchResult.status}`),
    { urlVerification: fetchResult.ok, contentMatch: false },
  )
}

/**
 * @param {object[]} channels
 * @param {{ topic: string, log?: (msg: string) => void, label?: string, industryAudit?: boolean }} opts
 */
export async function filterVerifiedChannels(channels, { topic, log = () => {}, label = 'channel', industryAudit = false }) {
  const kept = []
  const rejections = []
  const isIndustry = industryAudit || label === 'industry'
  const candidates = channels ?? []

  if (isIndustry) {
    log(`  Industry verification: ${candidates.length} candidate(s) from synthesis`)
    if (!candidates.length) {
      log('  Industry section empty — synthesis returned zero industry_channels')
    }
  }

  for (const channel of candidates) {
    if (isIndustry) {
      log(
        `  [industry] ── ${channel.channel_name} (${channel.channel_type}) ${channel.url_or_handle}`,
      )
    }

    const auditLog = isIndustry
      ? (msg) => log(`  [industry] ${channel.channel_name}:${msg}`)
      : channel.channel_type === 'subreddit'
        ? (msg) => log(`  [reddit] ${channel.channel_name}:${msg}`)
        : undefined

    const result = await verifyChannel(channel, topic, { auditLog })

    if (result.ok) {
      let accepted = channel
      if (result.liveAudience) {
        accepted = applyLiveAudience(channel, result.liveAudience)
        if (isIndustry) {
          log(`  [industry] ACCEPTED — live audience ${result.liveAudience.size}`)
        } else if (channel.channel_type === 'subreddit') {
          log(`  ✓ Verified subreddit: ${channel.channel_name} — ${result.liveAudience.size} (${result.method ?? 'ok'})`)
        } else {
          log(`  ✓ Verified ${label}: ${channel.channel_name} — live audience ${result.liveAudience.size}`)
        }
      } else if (isIndustry) {
        log(`  [industry] ACCEPTED (${result.method ?? 'ok'}) — no public count on page`)
      } else if (channel.channel_type === 'subreddit') {
        log(`  ✓ Verified subreddit: ${channel.channel_name} (${result.method ?? 'ok'})`)
      } else {
        log(`  ✓ Verified ${label}: ${channel.channel_name} (${result.method ?? 'ok'})`)
      }
      accepted = enforceAudienceRules(accepted)
      kept.push(accepted)
    } else {
      const stage = result.rejectionStage ?? classifyRejectionStage(result)
      rejections.push({ name: channel.channel_name, stage, reason: result.reason })
      if (isIndustry) {
        log(
          `  [industry] REJECTED (${stage}) — ${result.reason} | url_ok=${result.checks?.urlVerification ?? '?'} content=${result.checks?.contentMatch ?? '?'}`,
        )
      } else if (channel.channel_type === 'subreddit') {
        log(`  ✗ Rejected subreddit: ${channel.channel_name} (${stage}) — ${result.reason}`)
      } else {
        log(`  ✗ Rejected ${label}: ${channel.channel_name} — ${result.reason}`)
      }
    }
  }

  const industryVerificationNote = isIndustry
    ? buildIndustryVerificationNote(candidates.length, kept.length, rejections)
    : null

  if (isIndustry) {
    log(
      `  Industry verification summary: ${kept.length} kept, ${rejections.length} rejected (of ${candidates.length} synthesized)`,
    )
    if (industryVerificationNote) {
      log(`  ${industryVerificationNote}`)
    }
  } else if (rejections.length > 0) {
    log(`  ${label} verification: kept ${kept.length}, rejected ${rejections.length}`)
    const subRejected = rejections.filter((r) =>
      candidates.some((c) => c.channel_name === r.name && c.channel_type === 'subreddit'),
    )
    if (subRejected.length) {
      log(`  Subreddit rejections: ${subRejected.map((r) => `${r.name} (${r.stage})`).join('; ')}`)
    }
  }

  return { channels: kept, industryVerificationNote }
}
