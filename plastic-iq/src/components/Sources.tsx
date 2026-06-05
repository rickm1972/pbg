import { useEffect, useMemo, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import {
  fetchPublicProductSources,
  type PublicProductSource,
} from '../lib/productEvidenceApi'
import { isRetailerContextHost } from '../lib/publicSourceDisplay'

function sourceAriaLabel(title: string, url: string): string {
  return `${title} — opens ${hostLabel(url)} in a new tab`
}

type Props = {
  productId: string
  className?: string
}

function hostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return 'external site'
  }
}

function displayTitle(source: PublicProductSource): string {
  if (source.title) return source.title
  return hostLabel(source.url)
}

const PUBLIC_LABEL_ORDER: PublicProductSource['public_label'][] = [
  'Manufacturer',
  'Retailer',
  'Regulatory',
  'Context',
]

function groupPublicSources(sources: PublicProductSource[]) {
  const groups = new Map<PublicProductSource['public_label'], PublicProductSource[]>()
  for (const label of PUBLIC_LABEL_ORDER) {
    groups.set(label, [])
  }
  for (const source of sources) {
    const list = groups.get(source.public_label) ?? []
    list.push(source)
    groups.set(source.public_label, list)
  }
  return PUBLIC_LABEL_ORDER.map((label) => ({
    label,
    sources: groups.get(label) ?? [],
  })).filter((g) => g.sources.length > 0)
}

function sourceSupportNote(source: PublicProductSource): string | null {
  if (source.public_label === 'Retailer' && source.public_status === 'primary') {
    return null
  }
  if (source.public_label === 'Retailer' && source.public_status === 'supporting') {
    return 'Retailer listing — supporting source for this product.'
  }
  if (source.public_label === 'Context') {
    return 'Third-party or background context — not manufacturer product confirmation.'
  }
  return null
}

function formatSourcesIntro(labels: string[]): string {
  if (labels.length === 0) {
    return 'Sources used for this score, including manufacturer, retailer, regulatory, and context sources where applicable.'
  }
  if (labels.length === 1) {
    return `Sources used for this score, including ${labels[0]} sources where applicable.`
  }
  const last = labels[labels.length - 1]
  const rest = labels.slice(0, -1).join(', ')
  return `Sources used for this score, including ${rest}, and ${last} sources where applicable.`
}

function SourceRow({ source }: { source: PublicProductSource }) {
  const title = displayTitle(source)
  const aria = sourceAriaLabel(title, source.url)
  const supportNote = sourceSupportNote(source)

  return (
    <li className="py-0.5 pl-3">
      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={aria}
        className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-sm text-sm leading-snug text-slate-700 underline decoration-slate-300/80 underline-offset-2 hover:text-emerald-900 hover:decoration-emerald-600/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1"
      >
        <span className="text-pretty">{title}</span>
        <ExternalLink className="h-3 w-3 shrink-0 text-slate-400" aria-hidden />
      </a>
      {supportNote ? (
        <p className="mt-0.5 pl-0 text-[11px] leading-snug text-slate-500">{supportNote}</p>
      ) : null}
    </li>
  )
}

export function Sources({ productId, className = '' }: Props) {
  const [sources, setSources] = useState<PublicProductSource[] | null>(null)

  useEffect(() => {
    let cancelled = false
    setSources(null)
    fetchPublicProductSources(productId)
      .then((rows) => {
        if (!cancelled) setSources(rows)
      })
      .catch(() => {
        if (!cancelled) setSources([])
      })
    return () => {
      cancelled = true
    }
  }, [productId])

  const grouped = useMemo(() => groupPublicSources(sources ?? []), [sources])

  const sourcesIntro = useMemo(() => {
    const labels = grouped.map((g) => g.label.toLowerCase())
    return formatSourcesIntro(labels)
  }, [grouped])

  if (sources === null || sources.length === 0) return null

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
                <SourceRow key={`${source.public_label}-${source.url}`} source={source} />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}
