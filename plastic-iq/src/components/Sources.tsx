import { ExternalLink } from 'lucide-react'
import type { AprDisplaySource } from '../types/apr'
import { DISPLAY_SOURCE_GROUPS } from '../types/apr'

function sourceAriaLabel(title: string, url: string): string {
  let host = 'external site'
  try {
    host = new URL(url).hostname.replace(/^www\./, '')
  } catch {
    /* ignore */
  }
  return `${title} — opens ${host} in a new tab`
}

type Props = {
  sourcesIntro: string
  sources: AprDisplaySource[]
  className?: string
}

function groupDisplaySources(sources: AprDisplaySource[]) {
  const groups = new Map<string, AprDisplaySource[]>()
  for (const label of DISPLAY_SOURCE_GROUPS) {
    groups.set(label, [])
  }
  for (const source of sources) {
    if (!source.public_source_eligible) continue
    const list = groups.get(source.group) ?? []
    list.push(source)
    groups.set(source.group, list)
  }
  return DISPLAY_SOURCE_GROUPS.map((label) => ({
    label,
    sources: groups.get(label) ?? [],
  })).filter((g) => g.sources.length > 0)
}

function SourceRow({ source }: { source: AprDisplaySource }) {
  const aria = sourceAriaLabel(source.label, source.url)

  return (
    <li className="py-0.5 pl-3">
      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={aria}
        className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-sm text-sm leading-snug text-slate-700 underline decoration-slate-300/80 underline-offset-2 hover:text-emerald-900 hover:decoration-emerald-600/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1"
      >
        <span className="text-pretty">{source.label}</span>
        <ExternalLink className="h-3 w-3 shrink-0 text-slate-400" aria-hidden />
      </a>
      {source.footnote ? (
        <p className="mt-0.5 pl-0 text-[11px] leading-snug text-slate-500">{source.footnote}</p>
      ) : null}
    </li>
  )
}

export function Sources({ sourcesIntro, sources, className = '' }: Props) {
  const grouped = groupDisplaySources(sources)
  if (!sources.length) return null

  return (
    <section
      className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-card ${className}`}
      aria-labelledby="product-sources-heading"
    >
      <h2 id="product-sources-heading" className="text-sm font-semibold text-ink-900">
        Sources
      </h2>
      <p className="mt-1 text-xs text-slate-500">{sourcesIntro}</p>
      <div className="mt-3 space-y-4">
        {grouped.map((group) => (
          <div key={group.label}>
            <h3 className="text-xs font-medium text-slate-500">{group.label}</h3>
            <ul className="mt-1 space-y-0">
              {group.sources.map((source) => (
                <SourceRow key={`${source.group}-${source.url}`} source={source} />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}
