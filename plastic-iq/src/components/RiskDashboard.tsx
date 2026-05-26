import {
  computeRiskDashboardMetrics,
  type RiskDashboardIndicator,
  type RiskIndicatorTone,
} from '../lib/riskDashboard'
import type { NormalizationComponent } from '../types/agent'

type Props = {
  components: NormalizationComponent[]
  className?: string
}

const TONE_STYLES: Record<
  RiskIndicatorTone,
  { text: string; bar: string; track: string }
> = {
  safe: {
    text: 'text-emerald-700',
    bar: 'bg-emerald-500',
    track: 'bg-emerald-50',
  },
  moderate: {
    text: 'text-amber-700',
    bar: 'bg-amber-500',
    track: 'bg-amber-50',
  },
  concerning: {
    text: 'text-red-700',
    bar: 'bg-red-500',
    track: 'bg-red-50',
  },
}

export function RiskDashboard({ components, className = '' }: Props) {
  const metrics = computeRiskDashboardMetrics(components)
  if (!metrics) return null

  return (
    <section
      className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-card ${className}`}
      aria-labelledby="risk-dashboard-heading"
    >
      <h2 id="risk-dashboard-heading" className="text-sm font-semibold text-ink-900">
        How we measure risk
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-slate-600">
        Every product is evaluated on three factors:
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-slate-600">
        <li>Material — what the product is made of</li>
        <li>Migration — how easily the material transfers chemicals</li>
        <li>Use conditions — how intensely the product contacts food during normal use</li>
      </ul>
      <p className="mt-3 text-sm leading-relaxed text-slate-600">
        Long bars mean lower risk. Risk emerges when all three combine. Some products score
        high overall even when one factor is concerning — for example, cast iron cookware faces
        harsh use conditions but stays safe because the material is inert.
      </p>

      <div className="mt-6 space-y-6">
        <RiskIndicatorRow label="Material" indicator={metrics.material} />
        <RiskIndicatorRow label="Migration" indicator={metrics.migration} />
        <RiskIndicatorRow label="Use conditions" indicator={metrics.useConditions} />
      </div>
    </section>
  )
}

function RiskIndicatorRow({
  label,
  indicator,
}: {
  label: string
  indicator: RiskDashboardIndicator
}) {
  const styles = TONE_STYLES[indicator.tone]
  const fill = Math.round(indicator.fillPercent)

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold text-ink-900">{label}</span>
        <span className={`text-sm font-semibold ${styles.text}`}>{indicator.statusLabel}</span>
      </div>
      <div
        className={`h-2.5 w-full overflow-hidden rounded-full ${styles.track}`}
        role="meter"
        aria-label={`${label}: ${indicator.statusLabel}, ${fill}%`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={fill}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-500 ease-out ${styles.bar}`}
          style={{ width: `${fill}%` }}
        />
      </div>
    </div>
  )
}
