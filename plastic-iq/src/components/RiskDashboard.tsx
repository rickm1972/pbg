import {
  computeRiskDashboardMetrics,
  type RiskDashboardIndicator,
  type RiskIndicatorTone,
} from '../lib/riskDashboard'
import {
  RISK_MEASURE_CLOSING,
  RISK_MEASURE_FACTORS,
  RISK_MEASURE_INTRO,
} from '../lib/riskMeasureCopy'
import type { NormalizationComponent } from '../types/agent'

type Props = {
  components: NormalizationComponent[]
  /** From Why This Score primary_material_options — shown on Contact material row. */
  primaryMaterialName?: string | null
  className?: string
}

const TONE_STYLES: Record<
  RiskIndicatorTone,
  { text: string; bar: string }
> = {
  safe: {
    text: 'text-emerald-700',
    bar: 'bg-emerald-500',
  },
  moderate: {
    text: 'text-amber-700',
    bar: 'bg-amber-500',
  },
  concerning: {
    text: 'text-red-700',
    bar: 'bg-red-500',
  },
}

export function RiskDashboard({
  components,
  primaryMaterialName,
  className = '',
}: Props) {
  const metrics = computeRiskDashboardMetrics(components)
  if (!metrics) return null

  const contactMaterialLabel = primaryMaterialName
    ? `Contact material: ${primaryMaterialName}`
    : 'Contact material'

  return (
    <section
      className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-card ${className}`}
      aria-labelledby="risk-dashboard-heading"
    >
      <h2 id="risk-dashboard-heading" className="text-sm font-semibold text-ink-900">
        How we measure risk
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-slate-600">{RISK_MEASURE_INTRO}</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-slate-600">
        {RISK_MEASURE_FACTORS.map((factor) => (
          <li key={factor.name}>
            {factor.name} — {factor.description}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm leading-relaxed text-slate-600">{RISK_MEASURE_CLOSING}</p>

      <div className="mt-6 space-y-6">
        <RiskIndicatorRow label={contactMaterialLabel} indicator={metrics.material} />
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
        <span className="min-w-0 text-sm font-semibold text-ink-900">{label}</span>
        <span className={`shrink-0 text-sm font-semibold ${styles.text}`}>
          {indicator.statusLabel}
        </span>
      </div>
      <div
        className="h-2.5 w-full overflow-hidden rounded-full bg-[#E5E7EB]"
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
