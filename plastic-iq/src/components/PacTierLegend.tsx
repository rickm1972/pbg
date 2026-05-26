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

function tierCardSurface(tone: PacTierLegendTone) {
  switch (tone) {
    case 'excellent':
      return 'border-emerald-100 bg-emerald-50/60'
    case 'good':
      return 'border-blue-100 bg-blue-50/60'
    case 'caution':
      return 'border-amber-100 bg-amber-50/70'
    case 'concern':
      return 'border-orange-100 bg-orange-50/70'
    case 'highrisk':
      return 'border-red-100 bg-red-50/70'
  }
}

function tierAccentText(tone: PacTierLegendTone) {
  switch (tone) {
    case 'excellent':
      return 'text-emerald-700'
    case 'good':
      return 'text-blue-700'
    case 'caution':
      return 'text-amber-700'
    case 'concern':
      return 'text-orange-700'
    case 'highrisk':
      return 'text-red-700'
  }
}

/** Product page sidebar — vertical list, icon + label + range pill. */
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

/** About page — five equal-height tier cards with stronger tier accent (mirrors About risk cards). */
export function PacTierAboutGrid({ className = '' }: { className?: string }) {
  return (
    <div
      className={`grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 ${className}`}
    >
      {PAC_TIER_LEGEND.map((t) => (
        <div
          key={t.label}
          className={`flex h-full flex-col rounded-2xl border bg-gradient-to-b p-4 shadow-[0_18px_55px_-30px_rgba(15,61,38,0.55)] ring-1 ${tierCardSurface(t.tone)}`}
        >
          <div className="flex shrink-0 items-start justify-between gap-2">
            <div className="min-w-0">
              <div className={`text-base font-semibold leading-tight ${tierAccentText(t.tone)}`}>
                {t.label}
              </div>
              <span
                className={`mt-1.5 inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${tierPill(t.tone)}`}
              >
                {t.range}
              </span>
            </div>
            <span
              className={`grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/90 ring-1 ${tierRing(t.tone)}`}
            >
              {tierIcon(t.tone)}
            </span>
          </div>
          <p className="mt-3 min-h-[4.25rem] text-sm leading-relaxed text-slate-800">{t.description}</p>
        </div>
      ))}
    </div>
  )
}
