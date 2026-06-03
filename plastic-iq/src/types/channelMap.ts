export type ChannelWorkflowStatus = 'draft' | 'approved' | 'rejected'

export type ChannelRunStatus = 'running' | 'partial' | 'failed' | 'succeeded'

export type ChannelType =
  | 'subreddit'
  | 'facebook_group'
  | 'discord'
  | 'podcast'
  | 'youtube'
  | 'tiktok'
  | 'instagram'
  | 'parenting_forum'
  | 'wellness_forum'
  | 'substack'
  | 'news_outlet'
  | 'blog'

export type ChannelOrientation =
  | 'community'
  | 'advocacy'
  | 'independent-expert'
  | 'industry'
  | 'media'

export type ActivityLevel = 'hot' | 'active' | 'moderate' | 'dormant'
export type TopicRelevance = 'saturated' | 'frequent' | 'occasional' | 'one_off'
export type PostingFriendliness =
  | 'open'
  | 'moderated'
  | 'closed-to-outside-posts'
  | 'unknown'

export type ChannelEntry = {
  channel_id?: string
  channel_name: string
  channel_type: ChannelType
  url_or_handle: string
  orientation?: ChannelOrientation
  audience_size?: string
  audience_verified?: boolean
  audience_basis?: string
  activity_level?: ActivityLevel
  topic_relevance?: TopicRelevance
  topic_evidence_count?: number
  topic_evidence_refs?: string[]
  tone_or_vibe?: string
  posting_friendliness?: PostingFriendliness
  evidence_url?: string
  evidence_label?: string
  description?: string
  score?: number
  score_note?: string
  rank?: number
  is_priority_top_10?: boolean
}

export type ChannelSource = {
  source_id?: string
  url: string
  title?: string
  excerpt?: string
  angle_id?: string
  source_type?: 'authoritative' | 'voc' | 'unknown'
}

export type ChannelApiUsage = {
  perplexity_requests?: number
  perplexity_input_tokens?: number
  perplexity_output_tokens?: number
  perplexity_estimated_cost_usd?: number
  claude_input_tokens?: number
  claude_output_tokens?: number
  claude_estimated_cost_usd?: number
  total_estimated_cost_usd?: number
  source_count?: number
  channel_count?: number
  media_outlet_count?: number
  industry_channel_count?: number
}

export type ChannelRunMetadata = {
  run_status?: ChannelRunStatus
  stage?: 'retrieval' | 'synthesis' | 'done'
  topic?: string
  angles_completed?: string[]
  angles_failed?: Array<{ angle_id: string; error: string }>
  retrieval?: unknown[]
  retrieval_coverage?: Array<{
    angle_id: string
    label: string
    excerpt_count: number
    coverage_note?: string | null
    error?: string | null
  }>
  api_usage?: ChannelApiUsage
  synthesis_model?: string
  facebook_coverage_note?: string | null
  industry_verification_note?: string | null
  type_coverage_notes?: Record<string, string>
  logs?: string[]
  error_message?: string | null
  finished_at?: string
  duplicated_from?: string
  note?: string
}

export type ChannelMapRow = {
  channel_map_id: string
  topic: string
  topic_description: string | null
  status: ChannelWorkflowStatus
  channels: ChannelEntry[]
  media_outlets?: ChannelEntry[]
  industry_channels?: ChannelEntry[]
  sources: ChannelSource[]
  run_metadata: ChannelRunMetadata
  channel_count: number
  top_10_channel_ids: string[]
  created_at: string
  updated_at: string
}
