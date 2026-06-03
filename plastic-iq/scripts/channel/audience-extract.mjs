const USER_AGENT =
  'Mozilla/5.0 (compatible; PlasticIQ-ChannelVerify/1.0; +https://plasticbegone.com)'

/** Platforms where raw counts under this are almost always parse errors. */
const SUSPICIOUS_SMALL_REACH = 50
const STRICT_REACH_PLATFORMS = new Set([
  'instagram',
  'tiktok',
  'youtube',
  'substack',
  'subreddit',
  'parenting_forum',
  'wellness_forum',
  'blog',
])

/**
 * @param {string} numStr
 * @param {string} [suffixChar]
 * @returns {number | null}
 */
export function parseAbbreviatedCountToken(numStr, suffixChar) {
  const n = parseFloat(String(numStr ?? '').replace(/,/g, ''))
  if (Number.isNaN(n)) return null
  const s = String(suffixChar ?? '')
    .trim()
    .toUpperCase()
  if (s === 'K') return Math.round(n * 1_000)
  if (s === 'M') return Math.round(n * 1_000_000)
  if (s === 'B') return Math.round(n * 1_000_000_000)
  return Math.round(n)
}

/**
 * @param {number} reach
 * @param {string} unit
 */
export function formatAudienceFromReach(reach, unit) {
  if (reach >= 1_000_000_000) {
    return `~${(reach / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B ${unit}`
  }
  if (reach >= 1_000_000) {
    return `~${(reach / 1_000_000).toFixed(1).replace(/\.0$/, '')}M ${unit}`
  }
  if (reach >= 1_000) {
    return `~${Math.round(reach / 1_000)}K ${unit}`
  }
  return `~${reach} ${unit}`
}

/**
 * @param {string} platform
 * @param {number} reach
 * @param {string} unit
 * @param {string} [channelType]
 */
function liveResultIfValid(platform, reach, unit, channelType) {
  const type = channelType ?? platform.toLowerCase()
  if (STRICT_REACH_PLATFORMS.has(type) && reach < SUSPICIOUS_SMALL_REACH) {
    return null
  }
  return liveResult(platform, formatAudienceFromReach(reach, unit))
}

/**
 * @param {string} platform
 * @param {string} size
 */
function liveResult(platform, size) {
  return {
    size,
    basis: `Pulled directly from ${platform} channel page during verification (live).`,
    platform,
  }
}

/**
 * Find first plausible count in text for a unit word (followers, members, etc.).
 * @param {string} text
 * @param {string} unitWord
 * @param {string} platform
 * @param {string} [channelType]
 */
export function extractCountFromText(text, unitWord, platform, channelType) {
  const hay = String(text ?? '')
  const unit = unitWord.replace(/s$/, '')
  const patterns = [
    new RegExp(`([\\d,.]+)([KMB])\\s*${unitWord}`, 'i'),
    new RegExp(`([\\d,.]+)\\s*([KMB])\\s*${unitWord}`, 'i'),
    new RegExp(`([\\d,.]+)\\s*${unitWord}`, 'i'),
    new RegExp(`"${unit}Count":\\s*(\\d+)`, 'i'),
    new RegExp(`"${unit}_count":\\s*(\\d+)`, 'i'),
    new RegExp(`"edge_followed_by":\\s*\\{\\s*"count":\\s*(\\d+)`, 'i'),
    new RegExp(`"subscriberCount":\\s*(\\d+)`, 'i'),
    new RegExp(`"followerCount":\\s*(\\d+)`, 'i'),
    new RegExp(`"subscriberCountText":\\s*"([^"]+)"`, 'i'),
  ]

  for (const re of patterns) {
    const m = hay.match(re)
    if (!m) continue

    if (/CountText/i.test(m[0]) && m[1]) {
      const inner = m[1].match(/([\d,.]+)\s*([KMB])?/i)
      if (inner) {
        const reach = inner[2]
          ? parseAbbreviatedCountToken(inner[1], inner[2])
          : parseAbbreviatedCountToken(inner[1], '')
        if (reach != null) {
          const out = liveResultIfValid(platform, reach, unitWord, channelType)
          if (out) return out
        }
      }
      continue
    }

    if (m[2] && /[KMB]/i.test(m[2])) {
      const reach = parseAbbreviatedCountToken(m[1], m[2])
      if (reach != null) {
        const out = liveResultIfValid(platform, reach, unitWord, channelType)
        if (out) return out
      }
      continue
    }

    if (/^\d+$/.test(String(m[1]).replace(/,/g, ''))) {
      const reach = parseAbbreviatedCountToken(m[1], '')
      if (reach != null && reach >= 1_000) {
        const out = liveResultIfValid(platform, reach, unitWord, channelType)
        if (out) return out
      }
      continue
    }

    const reach = parseAbbreviatedCountToken(m[1], m[2])
    if (reach != null) {
      const out = liveResultIfValid(platform, reach, unitWord, channelType)
      if (out) return out
    }
  }

  return null
}

/**
 * @param {string} subredditName
 */
export async function fetchRedditAbout(subredditName) {
  const sub = String(subredditName ?? '')
    .trim()
    .replace(/^r\//i, '')
  if (!sub) return { ok: false, error: 'missing subreddit name' }

  const urls = [
    `https://www.reddit.com/r/${sub}/about.json`,
    `https://old.reddit.com/r/${sub}/about.json`,
  ]

  for (const aboutUrl of urls) {
    try {
      const res = await fetch(aboutUrl, {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(12_000),
      })
      if (!res.ok) continue
      const data = await res.json()
      const d = data?.data
      if (!d) continue
      return {
        ok: true,
        source: aboutUrl,
        display_name: d.display_name ?? sub,
        title: d.title ?? '',
        public_description: d.public_description ?? d.description ?? '',
        subscribers: typeof d.subscribers === 'number' ? d.subscribers : 0,
      }
    } catch (err) {
      continue
    }
  }

  return { ok: false, error: 'about.json unavailable' }
}

/**
 * @param {{ subscribers: number }} about
 */
export function liveAudienceFromRedditAbout(about) {
  const subs = about?.subscribers
  if (typeof subs !== 'number' || subs <= 0) return null
  return liveResultIfValid('Reddit', subs, 'members', 'subreddit')
}

/**
 * @param {string} url
 */
export function parseSubredditName(url) {
  return String(url).match(/reddit\.com\/r\/([^/?#]+)/i)?.[1] ?? null
}

/**
 * @param {string} url
 * @param {string} [html]
 */
export async function extractRedditAudience(url, html) {
  const sub = parseSubredditName(url)
  if (sub) {
    const about = await fetchRedditAbout(sub)
    if (about.ok) {
      const fromAbout = liveAudienceFromRedditAbout(about)
      if (fromAbout) return fromAbout
    }
  }

  return extractCountFromText(html ?? '', 'members', 'Reddit', 'subreddit')
}

/**
 * @param {string} html
 */
function extractYouTubeAudience(html) {
  return extractCountFromText(html ?? '', 'subscribers', 'YouTube', 'youtube')
}

/**
 * @param {string} html
 */
function extractInstagramAudience(html) {
  return extractCountFromText(html ?? '', 'followers', 'Instagram', 'instagram')
}

/**
 * @param {string} html
 */
function extractTikTokAudience(html) {
  return extractCountFromText(html ?? '', 'followers', 'TikTok', 'tiktok')
}

/**
 * @param {string} html
 */
function extractSubstackAudience(html) {
  return extractCountFromText(html ?? '', 'subscribers', 'Substack', 'substack')
}

/**
 * @param {string} html
 */
function extractFacebookGroupAudience(html) {
  return extractCountFromText(html ?? '', 'members', 'Facebook', 'facebook_group')
}

/**
 * @param {string} channelType
 * @param {string} html
 */
function extractForumAudience(channelType, html) {
  const platform = channelType === 'wellness_forum' ? 'wellness forum' : 'parenting forum'
  return (
    extractCountFromText(html ?? '', 'members', platform, channelType) ??
    extractCountFromText(html ?? '', 'users', platform, channelType) ??
    extractCountFromText(html ?? '', 'subscribers', platform, channelType)
  )
}

/**
 * @param {string} html
 */
function extractBlogAudience(html) {
  return (
    extractCountFromText(html ?? '', 'members', 'blog', 'blog') ??
    extractCountFromText(html ?? '', 'subscribers', 'blog', 'blog')
  )
}

/**
 * @param {object} channel
 * @param {{ html: string, url: string }} page
 */
export async function extractLiveAudience(channel, page) {
  const { html, url } = page
  const type = channel.channel_type

  if (type === 'podcast') return null

  switch (type) {
    case 'subreddit':
      return extractRedditAudience(url, html)
    case 'youtube':
      return extractYouTubeAudience(html)
    case 'instagram':
      return extractInstagramAudience(html)
    case 'tiktok':
      return extractTikTokAudience(html)
    case 'substack':
      return extractSubstackAudience(html)
    case 'facebook_group':
      return extractFacebookGroupAudience(html)
    case 'parenting_forum':
    case 'wellness_forum':
      return extractForumAudience(type, html)
    case 'blog':
      return extractBlogAudience(html)
    default:
      return null
  }
}

/**
 * @param {string} [sizeText]
 */
export function hasQuantitativeAudienceSize(sizeText) {
  const raw = String(sizeText ?? '').trim()
  if (!raw || /^unverified$/i.test(raw)) return false
  if (/^not\s+specified|unknown|n\/a$/i.test(raw)) return false
  return /[\d]/.test(raw)
}
