import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { PAC_TIER_LEGEND, type PacTierLegendTone } from '../lib/tierLegend'

const TIER_ICON_STROKE = 2.75 as const

function tierIcon(tone: PacTierLegendTone) {
  switch (tone) {
    case 'excellent':
      return (
        <CheckCircle2 className="h-5 w-5 text-emerald-700" strokeWidth={TIER_ICON_STROKE} />
      )
    case 'good':
      return <CheckCircle2 className="h-5 w-5 text-blue-700" strokeWidth={TIER_ICON_STROKE} />
    case 'caution':
      return <AlertTriangle className="h-5 w-5 text-amber-700" strokeWidth={TIER_ICON_STROKE} />
    case 'concern':
      return <AlertTriangle className="h-5 w-5 text-orange-700" strokeWidth={TIER_ICON_STROKE} />
    case 'highrisk':
      return <AlertTriangle className="h-5 w-5 text-red-700" strokeWidth={TIER_ICON_STROKE} />
  }
}

function tierRing(tone: PacTierLegendTone) {
  switch (tone) {
    case 'excellent':
      return 'ring-emerald-200'
    case 'good':
      return 'ring-blue-200'
    case 'caution':
      return 'ring-amber-200'
    case 'concern':
      return 'ring-orange-200'
    case 'highrisk':
      return 'ring-red-200'
  }
}

function tierPill(tone: PacTierLegendTone) {
  switch (tone) {
    case 'excellent':
      return 'bg-excellent/10 text-excellent'
    case 'good':
      return 'bg-good/10 text-good'
    case 'caution':
      return 'bg-caution/10 text-caution'
    case 'concern':
      return 'bg-concern/10 text-concern'
    case 'highrisk':
      return 'bg-highrisk/10 text-highrisk'
  }
}

export function PacTierLegend({ className = '' }: { className?: string }) {
  return (
    <div className={`grid gap-2 ${className}`}>
      {PAC_TIER_LEGEND.map((t) => (
        <div
          key={t.label}
          className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 px-3 py-2"
        >
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-full bg-transparent ring-1 ${tierRing(t.tone)}`}
            >
              {tierIcon(t.tone)}
            </span>
            <div className="min-w-0 text-sm font-semibold text-ink-900">{t.label}</div>
          </div>
          <div className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${tierPill(t.tone)}`}>
            {t.range}
          </div>
        </div>
      ))}
    </div>
  )
}
