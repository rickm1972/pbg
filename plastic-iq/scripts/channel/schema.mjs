import { z } from 'zod'

export const CHANNEL_TYPES = [
  'subreddit',
  'facebook_group',
  'discord',
  'podcast',
  'youtube',
  'tiktok',
  'instagram',
  'parenting_forum',
  'wellness_forum',
  'substack',
  'news_outlet',
  'blog',
]

/** Seeding / community outreach — ranked top 30 + priority 10 */
export const COMMUNITY_CHANNEL_TYPES = [
  'subreddit',
  'facebook_group',
  'discord',
  'podcast',
  'youtube',
  'tiktok',
  'instagram',
  'parenting_forum',
  'wellness_forum',
  'substack',
  'blog',
]

/** PR / journalist pitching — separate section */
export const MEDIA_CHANNEL_TYPES = ['news_outlet']

export const ACTIVITY_LEVELS = ['hot', 'active', 'moderate', 'dormant']
export const TOPIC_RELEVANCE_LEVELS = ['saturated', 'frequent', 'occasional', 'one_off']
export const POSTING_FRIENDLINESS = ['open', 'moderated', 'closed-to-outside-posts', 'unknown']

export const CHANNEL_ORIENTATIONS = [
  'community',
  'advocacy',
  'independent-expert',
  'industry',
  'media',
]

/** Orientations eligible for community seeding top 30 */
export const OUTREACH_ORIENTATIONS = new Set([
  'community',
  'advocacy',
  'independent-expert',
])

export const ChannelEntrySchema = z.object({
  channel_id: z.string().optional(),
  channel_name: z.string().min(1),
  channel_type: z.enum(CHANNEL_TYPES),
  url_or_handle: z.string().min(1),
  orientation: z.enum(CHANNEL_ORIENTATIONS).optional(),
  audience_size: z.string().optional(),
  audience_verified: z.boolean().optional(),
  audience_basis: z.string().optional(),
  activity_level: z.enum(ACTIVITY_LEVELS).optional(),
  topic_relevance: z.enum(TOPIC_RELEVANCE_LEVELS).optional(),
  topic_evidence_count: z.number().int().nonnegative().optional(),
  topic_evidence_refs: z.array(z.string()).optional(),
  tone_or_vibe: z.string().optional(),
  posting_friendliness: z.enum(POSTING_FRIENDLINESS).optional(),
  evidence_url: z.string().url().optional(),
  evidence_label: z.string().optional(),
  description: z.string().optional(),
  score: z.number().min(0).max(100).optional(),
  score_note: z.string().optional(),
  rank: z.number().int().positive().optional(),
  is_priority_top_10: z.boolean().optional(),
})

export const ChannelMapContentSchema = z.object({
  topic_description: z.string().optional(),
  facebook_coverage_note: z.string().optional(),
  type_coverage_notes: z.record(z.string(), z.string()).optional(),
  communities: z.array(ChannelEntrySchema).optional(),
  media_outlets: z.array(ChannelEntrySchema).optional(),
  industry_channels: z.array(ChannelEntrySchema).optional(),
})
