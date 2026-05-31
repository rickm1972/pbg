const CHANNEL_TYPE_LABELS = {
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

export function channelTypeLabel(type) {
  return CHANNEL_TYPE_LABELS[type] ?? type
}

export function formatChannelMapSummary(row) {
  const lines = []
  const communities = row.channels ?? []
  const media = row.media_outlets ?? []
  const industry = row.industry_channels ?? []
  const usage = row.run_metadata?.api_usage

  lines.push(`\n=== Channel map: ${row.topic} ===`)
  lines.push(`ID: ${row.channel_map_id}`)
  lines.push(`Status: ${row.status} | Run: ${row.run_metadata?.run_status ?? 'n/a'}`)
  if (row.topic_description) lines.push(`\n${row.topic_description}`)

  if (row.run_metadata?.facebook_coverage_note) {
    lines.push(`\nFacebook note: ${row.run_metadata.facebook_coverage_note}`)
  }

  if (usage) {
    lines.push(
      `\nCost: $${(usage.total_estimated_cost_usd ?? 0).toFixed(4)} total` +
        ` | Perplexity $${(usage.perplexity_estimated_cost_usd ?? 0).toFixed(4)}` +
        ` (${usage.perplexity_input_tokens ?? 0} in / ${usage.perplexity_output_tokens ?? 0} out, ${usage.perplexity_requests ?? 0} requests)` +
        ` | Claude $${(usage.claude_estimated_cost_usd ?? 0).toFixed(4)}` +
        ` (${usage.claude_input_tokens ?? 0} in / ${usage.claude_output_tokens ?? 0} out)` +
        ` | Communities: ${usage.channel_count ?? communities.length}` +
        ` | Media: ${usage.media_outlet_count ?? media.length}` +
        ` | Industry: ${usage.industry_channel_count ?? industry.length}` +
        ` | Sources: ${usage.source_count ?? 0}`,
    )
  }

  lines.push('\n--- Communities (seeding) ---')

  const priority = communities.filter((c) => c.is_priority_top_10)
  if (priority.length) {
    lines.push('\nPriority outreach (top 10):\n')
    for (const c of priority) {
      lines.push(formatChannelLine(c))
    }
  }

  const rest = communities.filter((c) => !c.is_priority_top_10)
  if (rest.length) {
    lines.push('\nRanks 11–30:\n')
    for (const c of rest) {
      lines.push(formatChannelLine(c))
    }
  }

  if (industry.length) {
    lines.push('\n--- Industry / counter-aligned (not seeding) ---\n')
    for (const c of industry) {
      lines.push(formatChannelLine(c))
    }
  }

  if (media.length) {
    lines.push('\n--- Media outlets (PR) ---\n')
    for (const c of media) {
      lines.push(formatChannelLine(c))
    }
  }

  const sources = row.sources ?? []
  if (sources.length) {
    lines.push('\n--- Sources ---')
    for (const s of sources) {
      lines.push(`- ${s.title ?? s.url}: ${s.url}`)
      if (s.excerpt) lines.push(`  ${s.excerpt}`)
    }
  }

  if (row.run_metadata?.error_message) {
    lines.push(`\nError: ${row.run_metadata.error_message}`)
  }

  return lines.join('\n')
}

function formatChannelLine(c) {
  const audience =
    c.audience_verified && c.audience_size ? c.audience_size : 'Audience: unverified'
  const parts = [
    `#${c.rank ?? '?'} [${c.score ?? '—'}] ${c.channel_name}`,
    `(${channelTypeLabel(c.channel_type)}${c.orientation ? ` · ${c.orientation}` : ''})`,
    c.url_or_handle,
    `| ${audience}`,
  ]
  if (c.audience_basis) parts.push(`| basis: ${c.audience_basis}`)
  if (c.activity_level) parts.push(`| ${c.activity_level}`)
  if (c.topic_relevance) parts.push(`| ${c.topic_relevance}`)
  if (c.tone_or_vibe) parts.push(`| ${c.tone_or_vibe}`)
  if (c.posting_friendliness) parts.push(`| posts: ${c.posting_friendliness}`)
  let line = parts.join(' ')
  if (c.score_note) line += `\n  (${c.score_note})`
  if (c.description) line += `\n  ${c.description}`
  if (c.evidence_url) {
    line += `\n  Evidence: ${c.evidence_label ? `${c.evidence_label} — ` : ''}${c.evidence_url}`
  }
  return line
}
