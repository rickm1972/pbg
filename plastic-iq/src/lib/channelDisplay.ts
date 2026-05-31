import type { ChannelEntry, ChannelOrientation } from '../types/channelMap'

const CHANNEL_TYPE_LABELS: Record<string, string> = {
  subreddit: 'Subreddit',
  facebook_group: 'Facebook group',
  discord: 'Discord',
  podcast: 'Podcast',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  instagram: 'Instagram',
  parenting_forum: 'Parenting forum',
  wellness_forum: 'Wellness forum',
  substack: 'Substack',
  news_outlet: 'News outlet',
  blog: 'Blog',
}

const RELEVANCE_LABELS: Record<string, string> = {
  saturated: 'Saturated',
  frequent: 'Frequent',
  occasional: 'Occasional',
  one_off: 'One-off',
}

const ORIENTATION_LABELS: Record<ChannelOrientation, string> = {
  community: 'Community',
  advocacy: 'Advocacy',
  'independent-expert': 'Independent expert',
  industry: 'Industry',
  media: 'Media',
}

export function channelTypeLabel(type: string): string {
  return CHANNEL_TYPE_LABELS[type] ?? type
}

export function topicRelevanceLabel(level?: string): string {
  if (!level) return ''
  return RELEVANCE_LABELS[level] ?? level.replace(/_/g, ' ')
}

export function orientationLabel(orientation?: string): string {
  if (!orientation) return 'Community'
  return ORIENTATION_LABELS[orientation as ChannelOrientation] ?? orientation
}

export function orientationBadgeClass(orientation?: string): string {
  const map: Record<string, string> = {
    community: 'bg-slate-100 text-slate-800 border-slate-200',
    advocacy: 'bg-emerald-50 text-emerald-900 border-emerald-200',
    'independent-expert': 'bg-violet-50 text-violet-900 border-violet-200',
    industry: 'bg-orange-50 text-orange-950 border-orange-300',
    media: 'bg-blue-50 text-blue-900 border-blue-200',
  }
  return map[orientation ?? ''] ?? 'bg-slate-50 text-slate-700 border-slate-200'
}

export function channelMapExportFilename(topic: string | undefined): string {
  const slug =
    (topic ?? 'channel-map')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'channel-map'
  return `${slug}-channels.pdf`
}

export function sortChannelsByRank(channels: ChannelEntry[]): ChannelEntry[] {
  return [...channels].sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999))
}

export function splitPriorityChannels(channels: ChannelEntry[]) {
  const sorted = sortChannelsByRank(channels)
  const priority = sorted.filter((c) => c.is_priority_top_10)
  const rest = sorted.filter((c) => !c.is_priority_top_10)
  return { priority, rest, sorted }
}

export function audienceDisplay(channel: ChannelEntry): {
  label: string
  unverified: boolean
} {
  if (channel.audience_verified && channel.audience_size) {
    return { label: channel.audience_size, unverified: false }
  }
  return { label: 'unverified', unverified: true }
}
