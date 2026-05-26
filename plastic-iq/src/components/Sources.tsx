import { useEffect, useMemo, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { fetchProductSources, type ProductPageSource } from '../lib/productEvidenceApi'
import { groupSourcesByType, resolveSourceTypeLabels } from '../lib/sourceTypeTaxonomy'

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

function displayTitle(source: ProductPageSource): string {
  if (source.title) return source.title
  return hostLabel(source.url)
}

type SourceRowProps = {
  source: ProductPageSource
}

function SourceRow({ source }: SourceRowProps) {
  const title = displayTitle(source)
  const aria = sourceAriaLabel(title, source.url)

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
    </li>
  )
}

export function Sources({ productId, className = '' }: Props) {
  const [sources, setSources] = useState<ProductPageSource[] | null>(null)

  useEffect(() => {
    let cancelled = false
    setSources(null)
    fetchProductSources(productId)
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

  const grouped = useMemo(() => groupSourcesByType(sources ?? []), [sources])

  if (sources === null || sources.length === 0) return null

  return (
    <section
      className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-card ${className}`}
      aria-labelledby="product-sources-heading"
    >
      <h2 id="product-sources-heading" className="text-sm font-semibold text-ink-900">
        Sources
      </h2>
      <div className="mt-3 space-y-4">
        {grouped.map((group) => {
          const { groupLabel } = resolveSourceTypeLabels(group.sourceType)
          return (
            <div key={group.sourceType}>
              <h3 className="text-xs font-medium text-slate-500">{groupLabel}</h3>
              <ul className="mt-1 space-y-0">
                {group.sources.map((source) => (
                  <SourceRow key={`${source.source_type}-${source.url}`} source={source} />
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    </section>
  )
}
