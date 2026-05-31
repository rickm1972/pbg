import { forwardRef } from 'react'
import {
  audienceDisplay,
  channelTypeLabel,
  orientationBadgeClass,
  orientationLabel,
  splitPriorityChannels,
  topicRelevanceLabel,
} from '../../lib/channelDisplay'
import type { ChannelEntry, ChannelMapRow, ChannelSource } from '../../types/channelMap'

function hostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function isUsableSource(s: ChannelSource): boolean {
  const excerpt = (s.excerpt ?? '').trim()
  if (!excerpt) return false
  return !/^referenced in retrieval$/i.test(excerpt)
}

function activityBadgeClass(level?: string): string {
  const map: Record<string, string> = {
    hot: 'bg-red-50 text-red-900 border-red-200',
    active: 'bg-orange-50 text-orange-900 border-orange-200',
    moderate: 'bg-amber-50 text-amber-900 border-amber-200',
    dormant: 'bg-slate-50 text-slate-600 border-slate-200',
  }
  return map[level ?? ''] ?? 'bg-slate-50 text-slate-600 border-slate-200'
}

function relevanceBadgeClass(level?: string): string {
  const map: Record<string, string> = {
    saturated: 'bg-violet-50 text-violet-900 border-violet-200',
    frequent: 'bg-sky-50 text-sky-900 border-sky-200',
    occasional: 'bg-slate-50 text-slate-700 border-slate-200',
    one_off: 'bg-slate-100 text-slate-500 border-slate-200',
  }
  return map[level ?? ''] ?? 'bg-slate-50 text-slate-600 border-slate-200'
}

function friendlinessLabel(flag?: string): string {
  if (!flag) return 'Unknown'
  return flag.replace(/-/g, ' ')
}

type ChannelCardProps = {
  channel: ChannelEntry
  highlight?: boolean
}

function ChannelCard({ channel, highlight }: ChannelCardProps) {
  const url = channel.url_or_handle?.startsWith('http')
    ? channel.url_or_handle
    : channel.evidence_url
  const audience = audienceDisplay(channel)
  const audienceUnverified = audience.unverified

  return (
    <article
      className={`rounded-2xl border p-4 shadow-card break-inside-avoid [box-decoration-break:clone] ${
        highlight
          ? 'border-emerald-300 bg-emerald-50/40 ring-1 ring-emerald-200'
          : 'border-slate-200 bg-white'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            {channel.rank != null ? (
              <span className="text-xs font-bold text-slate-500">#{channel.rank}</span>
            ) : null}
            <h3 className="text-base font-semibold text-ink-900">{channel.channel_name}</h3>
            {channel.is_priority_top_10 ? (
              <span className="rounded-md border border-emerald-300 bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-900">
                Priority
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            {channelTypeLabel(channel.channel_type)}
            {channel.score != null ? (
              <span className="ml-2 font-semibold text-ink-900">Score {channel.score}</span>
            ) : null}
          </p>
          {channel.score_note ? (
            <p className="mt-1 text-[11px] italic text-amber-800">{channel.score_note}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-1">
          {channel.orientation ? (
            <span
              className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold ${orientationBadgeClass(channel.orientation)}`}
            >
              {orientationLabel(channel.orientation)}
            </span>
          ) : null}
          {channel.activity_level ? (
            <span
              className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold capitalize ${activityBadgeClass(channel.activity_level)}`}
            >
              {channel.activity_level}
            </span>
          ) : null}
          {channel.topic_relevance ? (
            <span
              className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold ${relevanceBadgeClass(channel.topic_relevance)}`}
            >
              {topicRelevanceLabel(channel.topic_relevance)}
            </span>
          ) : null}
        </div>
      </div>

      {channel.description ? (
        <p className="mt-3 text-sm leading-relaxed text-slate-800">{channel.description}</p>
      ) : null}

      <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
        <div>
          <dt className="font-semibold text-slate-500">Audience</dt>
          <dd
            className={
              audienceUnverified
                ? 'font-medium text-amber-800'
                : 'text-slate-800'
            }
          >
            {audienceUnverified ? 'unverified' : audience.label}
          </dd>
          {channel.audience_basis ? (
            <p className="mt-0.5 text-[11px] text-slate-500">{channel.audience_basis}</p>
          ) : null}
        </div>
        {channel.tone_or_vibe ? (
          <div>
            <dt className="font-semibold text-slate-500">Tone</dt>
            <dd className="text-slate-800">{channel.tone_or_vibe}</dd>
          </div>
        ) : null}
        <div>
          <dt className="font-semibold text-slate-500">Posting</dt>
          <dd className="capitalize text-slate-800">
            {friendlinessLabel(channel.posting_friendliness)}
          </dd>
        </div>
        {url ? (
          <div className="sm:col-span-2">
            <dt className="font-semibold text-slate-500">URL</dt>
            <dd>
              <a
                href={url}
                className="break-all text-emerald-900 underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                {channel.url_or_handle}
              </a>
            </dd>
          </div>
        ) : null}
      </dl>

      {channel.evidence_url ? (
        <p className="mt-3 text-xs text-slate-600">
          <span className="font-semibold">Evidence: </span>
          <a
            href={channel.evidence_url}
            className="text-emerald-900 underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            {channel.evidence_label || channel.evidence_url}
          </a>
        </p>
      ) : null}
    </article>
  )
}

type Props = {
  row: ChannelMapRow
  editing?: boolean
  topicDescription?: string
  onTopicDescriptionChange?: (v: string) => void
  showMeta?: boolean
}

export const ChannelMapProfileBody = forwardRef<HTMLDivElement, Props>(
  function ChannelMapProfileBody(
    { row, editing = false, topicDescription, onTopicDescriptionChange, showMeta = true },
    ref,
  ) {
    const { priority, rest } = splitPriorityChannels(row.channels ?? [])
    const mediaOutlets = row.media_outlets ?? []
    const industryChannels = row.industry_channels ?? []
    const sources = (row.sources ?? []).filter(isUsableSource)
    const fbNote = row.run_metadata?.facebook_coverage_note
    const typeNotes = row.run_metadata?.type_coverage_notes
    const description = topicDescription ?? row.topic_description ?? ''

    return (
      <div ref={ref} className="channel-map-export bg-white text-ink-900">
        <header className="border-b border-slate-200 pb-4">
          <h1 className="text-2xl font-semibold tracking-tight text-ink-900 md:text-3xl">
            {row.topic}
          </h1>
          {editing && onTopicDescriptionChange ? (
            <label className="mt-3 block">
              <span className="text-xs font-semibold text-slate-600">Map description</span>
              <textarea
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                rows={2}
                value={description}
                onChange={(e) => onTopicDescriptionChange(e.target.value)}
              />
            </label>
          ) : description ? (
            <p className="mt-2 text-sm leading-relaxed text-slate-700">{description}</p>
          ) : null}
          {showMeta ? (
            <p className="mt-2 text-xs text-slate-500">
              {row.channel_count} seeding channels
              {row.channel_count < 30 ? ' (not padded to 30)' : ''}
              {' · '}
              Top {Math.min(10, priority.length)} priority
              {mediaOutlets.length > 0 ? ` · ${mediaOutlets.length} media (PR)` : ''}
              {industryChannels.length > 0
                ? ` · ${industryChannels.length} industry (not targets)`
                : ''}
            </p>
          ) : null}
        </header>

        {fbNote ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <strong>Facebook coverage:</strong> {fbNote}
          </div>
        ) : null}

        {typeNotes && Object.keys(typeNotes).length > 0 ? (
          <details className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-700">
            <summary className="cursor-pointer font-semibold text-slate-800">
              Type coverage notes
            </summary>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              {Object.entries(typeNotes).map(([type, note]) =>
                note ? (
                  <li key={type}>
                    <span className="font-medium">{channelTypeLabel(type)}:</span> {note}
                  </li>
                ) : null,
              )}
            </ul>
          </details>
        ) : null}

        <section className="mt-6">
          <h2 className="text-lg font-semibold text-ink-900">Communities</h2>
          <p className="mt-1 text-sm text-slate-600">
            Seeding targets — ranked for outreach. Scores weight topic saturation over raw audience
            size.
          </p>
        </section>

        {priority.length > 0 ? (
          <section className="mt-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-emerald-800">
              Priority outreach — top 10
            </h3>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {priority.map((ch) => (
                <ChannelCard key={ch.channel_id ?? ch.channel_name} channel={ch} highlight />
              ))}
            </div>
          </section>
        ) : null}

        {rest.length > 0 ? (
          <section className="mt-8">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
              Full community map — ranks {priority.length + 1}–{priority.length + rest.length}
            </h3>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {rest.map((ch) => (
                <ChannelCard key={ch.channel_id ?? ch.channel_name} channel={ch} />
              ))}
            </div>
          </section>
        ) : null}

        {!priority.length && !rest.length ? (
          <p className="mt-4 text-sm text-slate-500">No community channels in this map yet.</p>
        ) : null}

        {industryChannels.length > 0 ? (
          <section className="mt-10 border-t border-orange-200 pt-8">
            <h2 className="text-lg font-semibold text-orange-950">Industry / counter-aligned</h2>
            <p className="mt-1 text-sm text-orange-900/90">
              Trade groups, manufacturer-aligned podcasts, and industry PR — not seeding targets.
              Shown for awareness only.
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {industryChannels.map((ch) => (
                <ChannelCard key={ch.channel_id ?? ch.channel_name} channel={ch} />
              ))}
            </div>
          </section>
        ) : null}

        {mediaOutlets.length > 0 ? (
          <section className="mt-10 border-t border-slate-200 pt-8">
            <h2 className="text-lg font-semibold text-ink-900">Media outlets</h2>
            <p className="mt-1 text-sm text-slate-600">
              PR and journalist pitching — ranked separately, not mixed with community seeding
              targets.
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {mediaOutlets.map((ch) => (
                <ChannelCard key={ch.channel_id ?? ch.channel_name} channel={ch} />
              ))}
            </div>
          </section>
        ) : null}

        {sources.length > 0 ? (
          <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
            <h2 className="text-sm font-semibold text-ink-900">Sources</h2>
            <ul className="mt-3 space-y-2">
              {sources.map((s) => (
                <li key={s.url} className="py-0.5 pl-3 text-sm text-slate-700">
                  <span className="font-medium">{s.title || hostLabel(s.url)}</span>
                  <span className="text-slate-500"> — </span>
                  <a
                    href={s.url}
                    className="break-all text-emerald-900 underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {s.url}
                  </a>
                  {s.excerpt ? (
                    <p className="mt-0.5 text-xs text-slate-500">{s.excerpt}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    )
  },
)
