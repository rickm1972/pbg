import type { NormalizationLayer4a } from '../../types/agent'

function formatLayer4aAdjustments(
  items?: NormalizationLayer4a['positive_adjustments'],
): Array<{ label: string; value: number | null }> {
  if (!items?.length) return []
  return items.map((item) => {
    if (typeof item === 'string') return { label: item, value: null }
    const label =
      item.reason ??
      item.basis ??
      item.label ??
      (typeof item.adjustment === 'string' ? item.adjustment : 'Adjustment')
    let value = item.value ?? item.points ?? null
    if (value == null && typeof item.adjustment === 'string') {
      const parsed = Number.parseInt(item.adjustment.replace(/[^\d-]/g, ''), 10)
      value = Number.isFinite(parsed) ? parsed : null
    }
    return { label, value: value != null ? value : null }
  })
}

export function Layer4aBreakdown({ layer4a }: { layer4a: NormalizationLayer4a }) {
  const positives = formatLayer4aAdjustments(layer4a.positive_adjustments)
  const negatives = formatLayer4aAdjustments(layer4a.negative_adjustments)

  return (
    <section className="mt-6">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Layer 4A adjustments
      </h4>
      {positives.length > 0 ? (
        <div className="mt-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Positive</p>
          <ul className="mt-1 space-y-1 text-sm text-slate-700">
            {positives.map((row, i) => (
              <li key={`pos-${i}`} className="flex flex-wrap justify-between gap-2">
                <span>{row.label}</span>
                {row.value != null ? (
                  <span className="shrink-0 font-semibold tabular-nums text-emerald-800">
                    {row.value > 0 ? `+${row.value}` : row.value}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {negatives.length > 0 ? (
        <div className={positives.length > 0 ? 'mt-3' : 'mt-2'}>
          <p className="text-xs font-semibold uppercase tracking-wide text-red-800">Negative</p>
          <ul className="mt-1 space-y-1 text-sm text-slate-700">
            {negatives.map((row, i) => (
              <li key={`neg-${i}`} className="flex flex-wrap justify-between gap-2">
                <span>{row.label}</span>
                {row.value != null ? (
                  <span className="shrink-0 font-semibold tabular-nums text-red-800">{row.value}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {positives.length === 0 && negatives.length === 0 ? (
        <p className="mt-2 text-sm text-slate-600">No itemized adjustments listed.</p>
      ) : null}
      <p className="mt-3 border-t border-slate-100 pt-3 text-sm text-slate-700">
        Net adjustment:{' '}
        <strong className="tabular-nums text-ink-900">{layer4a.net_adjustment ?? 0}</strong>
      </p>
    </section>
  )
}
