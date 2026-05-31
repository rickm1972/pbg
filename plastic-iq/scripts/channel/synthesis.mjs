import { jsonrepair } from 'jsonrepair'
import { loadEnv } from '../lib/env.mjs'
import {
  defaultChannelAnthropicModel,
  estimateAnthropicCostUsd,
} from './pricing.mjs'
import {
  CHANNEL_ORIENTATIONS,
  COMMUNITY_CHANNEL_TYPES,
  MEDIA_CHANNEL_TYPES,
  ACTIVITY_LEVELS,
  TOPIC_RELEVANCE_LEVELS,
  POSTING_FRIENDLINESS,
} from './schema.mjs'
import { extractSynthesisPayload } from './sources-from-synthesis.mjs'
import { finalizeChannelMap, partitionChannelGroups } from './normalize-map.mjs'
import { filterVerifiedChannels, scrubChannelCandidate } from './verify-channel.mjs'

const SYNTHESIS_SYSTEM = `You are a US channel discovery analyst for PlasticBegone (non-toxic household / plastic exposure topics).

Build: (1) communities for seeding outreach, (2) media_outlets for PR, (3) industry_channels for trade/industry-aligned outlets that are NOT seeding targets.

Rules:
- Return ONLY valid JSON (no markdown fences). US-only, English only.
- Never invent channels, URLs, or evidence. Do NOT pad to 30 communities — include only channels that meet the bar; server may return fewer than 30.
- Every channel MUST have a real url_or_handle that is the channel's own page (subreddit, YT channel, TikTok profile, podcast show, etc.) — never a single video/post URL as the channel URL.
- evidence_url and topic_evidence_refs MUST be independent of url_or_handle (a specific post, episode, article, or third-party mention). Never cite the channel landing page as its own evidence.
- If the only source is one video/podcast where a person appears as a guest on an organization's channel, list the HOST channel (the publisher) — do NOT invent a separate personal channel for the guest.
- audience_basis: if you have no quantitative count from a source, you MUST set audience_size to "unverified", audience_verified false, and explain in audience_basis (e.g. "no subscriber count in source"). Never put a numeric estimate in audience_size when basis says there is no figure.
- orientation (required for every channel): community | advocacy | independent-expert | industry | media
  - community: consumer/parent/individual voices discussing the topic
  - advocacy: nonprofits, NGOs, activist groups (e.g. Beyond Plastics, Plastic Pollution Coalition)
  - independent-expert: scientist/journalist/creator-led without industry alignment
  - industry: trade groups, manufacturer-aligned, industry-funded (e.g. America's Plastic Makers, American Chemistry Council, Sustainably Speaking / plastics industry podcast). Put in communities with orientation industry — server moves them to industry_channels.
  - media: journalism beats — use media_outlets array, not communities
- communities: outreach-aligned only (community, advocacy, independent-expert). Up to 40 candidates; server ranks ≤30 with type-balance caps. Top 10 priority applies to communities only.
- industry_channels: all orientation=industry entries (even if also a podcast/YouTube). Not ranked with seeding targets.
- media_outlets: journalism/NGO news desks for PR. Up to 15.
- topic_relevance (STRICT — server enforces caps from topic_evidence_count):
  - saturated: ONLY if you can list 3–5 specific recurring posts/episodes/threads/articles on the topic (set topic_evidence_count ≥ 3 and topic_evidence_refs URLs/titles). NOT for one viral video on a general channel.
  - frequent: 1–2 specific recurring examples OR regular monthly coverage (topic_evidence_count 1–2)
  - occasional: vague "covers plastic" without recurring examples, or a few times per year (topic_evidence_count 0)
  - one_off: exactly one identifiable piece
- audience_size: numeric/range ONLY when a real count or chart rank appears in retrieval (e.g. "Reddit sidebar: 42K members", "Apple Podcasts: top 50"). If no quantitative source, audience_size MUST be "unverified" (not a guess).
- audience_basis: cite the exact source of the number, OR state clearly when none exists ("no subscriber count in source", "no figure in source"). Server rejects numeric audience_size when basis admits no quantitative signal.
- audience_verified: true only when audience_size is a real estimate from a cited quantitative source; false when unverified.
- Score recalculated server-side (topic_relevance heaviest, then activity, then audience estimate).

Cite sources: citations_used with real statements only.`

function collectAnthropicText(body) {
  const blocks = body?.content ?? []
  return blocks
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim()
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

function formatCatalogForPrompt(catalog) {
  if (!catalog?.list?.length) return '(no cataloged sources)'
  return catalog.list
    .map(
      (e) =>
        `- ${e.source_id}: ${e.claim ?? e.retrieval_excerpt}\n  URL: ${e.url}${e.source_title ? `\n  Title: ${e.source_title}` : ''}`,
    )
    .join('\n')
}

/**
 * @param {object[]} retrievalAngles
 */
export function summarizeRetrievalForSynthesis(retrievalAngles) {
  const lines = []
  for (const angle of retrievalAngles ?? []) {
    const count = angle.excerpts?.length ?? 0
    const note = angle.coverage_note ? ` — ${angle.coverage_note}` : ''
    lines.push(`- ${angle.label} (${angle.angle_id}): ${count} excerpt(s)${note}`)
  }
  return lines.length ? lines.join('\n') : '(no retrieval summary)'
}

export function buildSynthesisUserPrompt(topic, catalog, retrievalAngles) {
  const communityTypes = COMMUNITY_CHANNEL_TYPES.join(' | ')
  const mediaTypes = MEDIA_CHANNEL_TYPES.join(' | ')
  const activity = ACTIVITY_LEVELS.join(' | ')
  const relevance = TOPIC_RELEVANCE_LEVELS.join(' | ')
  const friendliness = POSTING_FRIENDLINESS.join(' | ')
  const orientations = CHANNEL_ORIENTATIONS.join(' | ')

  return `Research topic: "${topic}"

Retrieval coverage by type:
${summarizeRetrievalForSynthesis(retrievalAngles)}

Source catalog (use source_id values in citations_used):
${formatCatalogForPrompt(catalog)}

Return JSON with this exact shape:
{
  "topic_description": "One sentence overview",
  "facebook_coverage_note": "",
  "type_coverage_notes": { "facebook_groups": "optional note when thin" },
  "communities": [
    {
      "channel_name": "",
      "channel_type": "${communityTypes}",
      "orientation": "${orientations}",
      "url_or_handle": "",
      "audience_size": "~100K members or exact count",
      "audience_verified": true,
      "audience_basis": "Where the estimate came from",
      "activity_level": "${activity}",
      "topic_relevance": "${relevance}",
      "topic_evidence_count": 3,
      "topic_evidence_refs": ["https://...", "https://..."],
      "tone_or_vibe": "",
      "posting_friendliness": "${friendliness}",
      "evidence_url": "https://...",
      "evidence_label": "",
      "description": "One line",
      "score": 0
    }
  ],
  "industry_channels": [
    {
      "channel_name": "",
      "channel_type": "${communityTypes}",
      "orientation": "industry",
      "url_or_handle": "",
      "audience_size": "~50K",
      "audience_verified": true,
      "audience_basis": "",
      "activity_level": "${activity}",
      "topic_relevance": "${relevance}",
      "topic_evidence_count": 1,
      "topic_evidence_refs": [],
      "tone_or_vibe": "",
      "posting_friendliness": "${friendliness}",
      "evidence_url": "https://...",
      "evidence_label": "",
      "description": "Industry/trade aligned — not a seeding target",
      "score": 0
    }
  ],
  "media_outlets": [
    {
      "channel_name": "",
      "channel_type": "${mediaTypes}",
      "orientation": "media",
      "url_or_handle": "",
      "audience_size": "~1M+",
      "audience_verified": true,
      "audience_basis": "",
      "activity_level": "${activity}",
      "topic_relevance": "${relevance}",
      "topic_evidence_count": 2,
      "topic_evidence_refs": [],
      "tone_or_vibe": "",
      "posting_friendliness": "${friendliness}",
      "evidence_url": "https://...",
      "evidence_label": "",
      "description": "One line",
      "score": 0
    }
  ],
  "citations_used": [
    { "source_id": "src_001", "statement": "What you used from this source" }
  ]
}

Communities rules:
- Only outreach-aligned orientations (community, advocacy, independent-expert). Mark industry channels orientation=industry (duplicate in industry_channels array too).
- Do not pad to 30 — omit weak channels.
- evidence_url must differ from url_or_handle. Server drops channels that fail URL verification or use circular evidence.
- Guest-on-org-video rule: attribute to publisher channel, never invent a personal channel from one appearance.
- Saturated requires topic_evidence_count ≥ 3 with distinct recurring pieces listed in topic_evidence_refs.
- TED-Ed / NatGeo with one video: one_off, not saturated.
- Prefer topic-saturated mid-size communities over huge one-off channels.

Industry rules:
- Trade groups, manufacturer podcasts, chemistry/plastics industry PR — orientation industry.

Media rules:
- Journalism only; orientation media.`
}

/**
 * @param {{ topic: string, catalog: object, retrievalAngles: object[], log?: (msg: string) => void }}
 */
export async function synthesizeChannelMap({ topic, catalog, retrievalAngles, log = () => {} }) {
  const env = loadEnv()
  const apiKey = env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set')

  const model = defaultChannelAnthropicModel()
  const maxTokens = Number(env.CHANNEL_MAX_TOKENS ?? env.PERSONA_MAX_TOKENS ?? 14000)

  log('\n[channel] Stage 2: Claude synthesis (no web search)…')

  const payload = {
    model,
    max_tokens: maxTokens,
    system: SYNTHESIS_SYSTEM,
    messages: [
      {
        role: 'user',
        content: buildSynthesisUserPrompt(topic, catalog, retrievalAngles),
      },
    ],
  }

  let body
  let response
  for (let attempt = 0; attempt < 5; attempt++) {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    body = await response.json()
    if (response.ok) break
    if (response.status === 429 && attempt < 4) {
      const waitMs = 30_000 * (attempt + 1)
      log(`  Rate limited — retrying in ${waitMs / 1000}s…`)
      await new Promise((r) => setTimeout(r, waitMs))
      continue
    }
    throw new Error(
      `Anthropic API error (${response.status}): ${body?.error?.message ?? JSON.stringify(body)}`,
    )
  }

  const text = collectAnthropicText(body)
  if (!text) throw new Error('Anthropic returned no text content')

  const usage = body.usage ?? {}
  const estimated_cost_usd = estimateAnthropicCostUsd(usage, 0)

  let parsed
  try {
    parsed = parseJsonLoose(text)
  } catch (err) {
    throw new Error(`Synthesis JSON parse failed: ${err.message}`)
  }

  const extracted = extractSynthesisPayload(parsed)
  const { communities: rawCommunities, media_outlets: rawMedia } = partitionLegacyPayload(
    extracted,
  )

  const rawIndustry = extracted.industry_channels ?? []
  const scrubbedCommunities = [...rawCommunities, ...rawIndustry].map(scrubChannelCandidate)
  const scrubbedMedia = (rawMedia ?? []).map(scrubChannelCandidate)

  log('\n[channel] Verifying channel URLs and evidence (fetch + Perplexity)…')
  const verifiedCommunities = await filterVerifiedChannels(scrubbedCommunities, {
    topic,
    log,
    label: 'community',
  })
  const verifiedMedia = await filterVerifiedChannels(scrubbedMedia, {
    topic,
    log,
    label: 'media',
  })

  const { communities, media_outlets, industry_channels } = finalizeChannelMap({
    communities: verifiedCommunities,
    media_outlets: verifiedMedia,
    log,
  })

  if (!communities.length) {
    throw new Error('Synthesis returned no verifiable community channels')
  }

  return {
    topic_description: extracted.topic_description,
    facebook_coverage_note: extracted.facebook_coverage_note,
    type_coverage_notes: extracted.type_coverage_notes,
    channels: communities,
    media_outlets,
    industry_channels,
    parsed,
    model,
    rawText: text,
    usage: {
      input_tokens: usage.input_tokens ?? 0,
      output_tokens: usage.output_tokens ?? 0,
      estimated_cost_usd,
    },
  }
}

function partitionLegacyPayload(extracted) {
  if (extracted.communities?.length || extracted.media_outlets?.length) {
    return partitionChannelGroups(extracted.communities, extracted.media_outlets)
  }
  return partitionChannelGroups(extracted.channels ?? [], [])
}
