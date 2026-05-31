/**
 * Stage 1 research angles — one explicit pass per channel type (US, English only).
 */

const US_ENGLISH = `Scope: United States audience, English-language channels only. Do not include non-US or non-English communities.`

const MIN_CANDIDATES = `Target 3–5 distinct channel candidates for this type when they exist. If fewer than 3 verifiable options exist, return only what you can verify and set coverage_note explaining the shortfall (do not pad with guesses).`

export const CHANNEL_RESEARCH_ANGLES = [
  {
    id: 'subreddits',
    label: 'Subreddits about the topic',
    sourceGuidance:
      'Reddit community pages, recent threads, subscriber counts from reddit.com. Prefer active US-relevant subreddits where the topic is discussed regularly.',
    focus: `Find subreddits where this topic is a core or frequent discussion theme — not one-off mentions. Include member counts when visible, recent thread URLs, and posting cadence.`,
  },
  {
    id: 'facebook_groups',
    label: 'Facebook groups about the topic',
    sourceGuidance:
      'Public Facebook group listings, mentions in forums/reddit about groups, Meta group pages if indexed. Many groups are private — only include if verifiable.',
    focus: `Find Facebook groups (US, English) centered on this topic. Note explicitly if fewer than 3 public/verifiable groups exist.`,
  },
  {
    id: 'discord',
    label: 'Discord servers about the topic',
    sourceGuidance: 'Discord server listing sites, community wikis, reddit recommendations of servers.',
    focus: `Find Discord servers where US English speakers actively discuss this topic. Member counts and invite/about pages when available.`,
  },
  {
    id: 'podcasts',
    label: 'Podcasts about the topic',
    sourceGuidance: 'Apple Podcasts, Spotify, podcast directories, show websites with episode lists.',
    focus: `Find US podcasts where this topic is a recurring theme (series or frequent episodes), not a single guest mention. Include show URLs and on-topic episode evidence.`,
  },
  {
    id: 'youtube',
    label: 'YouTube channels about the topic',
    sourceGuidance: 'YouTube channel pages, recent video URLs, subscriber counts from youtube.com.',
    focus: `Find YouTube channels (US, English) with recurring on-topic content — dedicated niche channels, not general channels with one viral video. Recent video evidence required.`,
  },
  {
    id: 'tiktok',
    label: 'TikTok creators and hashtag clusters about the topic',
    sourceGuidance: 'TikTok creator profiles, hashtag pages if indexed, articles listing creators in niche.',
    focus: `Find TikTok creators or hashtag clusters (US) where this topic appears regularly. Creator handle and evidence post/hashtag.`,
  },
  {
    id: 'instagram',
    label: 'Instagram accounts and hashtags about the topic',
    sourceGuidance: 'Instagram profile pages, hashtag pages if indexed, creator bios.',
    focus: `Find Instagram accounts or hashtags (US, English) with sustained educational or discussion content on this topic.`,
  },
  {
    id: 'parenting_forums',
    label: 'Parenting forums discussing the topic',
    sourceGuidance:
      'BabyCenter, What to Expect, The Bump, and other US parenting forums with public threads.',
    focus: `Find threads and boards on BabyCenter, What to Expect, The Bump, and similar US parenting forums where parents discuss this topic. Thread URLs as evidence.`,
  },
  {
    id: 'wellness_forums',
    label: 'Wellness and health forums discussing the topic',
    sourceGuidance: 'Health/wellness forums, community boards, long-running discussion sites.',
    focus: `Find wellness/health forums (US, English) with recurring discussion of this topic and recent activity.`,
  },
  {
    id: 'substack',
    label: 'Substack newsletters about the topic',
    sourceGuidance: 'Substack publication pages, newsletter archives with subscriber counts if shown.',
    focus: `Find Substack newsletters (US-focused) where this topic is a regular beat, not a one-off post.`,
  },
  {
    id: 'blogs',
    label: 'Dedicated blogs about the topic',
    sourceGuidance: 'Active blogs with comment sections, non-toxic/wellness/parenting blogs.',
    focus: `Find US blogs with active comment communities or recurring posts on this topic. Recent post/comment evidence.`,
  },
  {
    id: 'news_outlets',
    label: 'News outlets and journalism beats',
    sourceGuidance:
      'Major and niche US news sites, health/science/consumer beats, NGO news sections (e.g. Greenpeace USA news).',
    focus: `Find US news outlets, beats, or NGO journalism sections that cover this topic for PR pitching — NOT community seeding targets. Recent article URLs.`,
  },
]

export const RETRIEVAL_SYSTEM_PROMPT = `You are a channel research assistant for PlasticBegone (US market, English only).
Run a dedicated search for ONE channel type at a time. Find real, verifiable channels where a topic is discussed.
Return compact source-backed excerpts only — never invent channel names, URLs, or audience statistics.
${US_ENGLISH}`

export function buildAngleUserPrompt(angle, topic) {
  const focus = angle.focus.replaceAll('{topic}', topic)
  return `Research topic: "${topic}"

Research angle: ${angle.label}
${focus}

Source rules: ${angle.sourceGuidance}
${US_ENGLISH}
${MIN_CANDIDATES}

Return ONLY valid JSON (no markdown fences):
{
  "coverage_note": "If fewer than 3 verifiable candidates exist for this type, explain why. Otherwise empty string.",
  "excerpts": [
    {
      "claim": "compact fact: channel name, audience signal (counts, chart rank, or 'largest X' claims), activity, topic saturation, industry vs community hint if obvious",
      "url": "https://...",
      "source_title": "short label",
      "source_type": "authoritative" | "voc",
      "channel_name_hint": "channel name"
    }
  ]
}

Rules:
- 3–8 excerpts when candidates exist; each must have a real URL and a specific named channel.
- In claims, distinguish topic-saturated channels (core theme) vs one-off mentions.
- Include subscriber/member/follower counts in claims ONLY when the source states them; never guess.
- Do not invent channels or URLs. Fewer excerpts beats guessing.`
}
