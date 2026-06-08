import type { AprDisplayRiskBar } from '../types/apr'
import { riskBarStyleTokens } from '../lib/apr/layoutTokens'
import {
  RISK_MEASURE_CLOSING,
  RISK_MEASURE_FACTORS,
  RISK_MEASURE_INTRO,
} from '../lib/riskMeasureCopy'

type Props = {
  /** Pre-authored risk bars from display.risk_bars — Agent 2. */
  riskBars: AprDisplayRiskBar[]
  className?: string
}

export function RiskDashboard({ riskBars, className = '' }: Props) {
  if (!riskBars.length) return null

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
      <p className="mt-2 text-xs text-slate-500">
        Bars summarize each factor: longer green bars indicate lower concern, while shorter red
        bars indicate higher concern.
      </p>

      <div className="mt-6 space-y-5">
        {riskBars.map((bar) => (
          <RiskIndicatorRow key={bar.id} bar={bar} />
        ))}
      </div>
    </section>
  )
}

function RiskIndicatorRow({ bar }: { bar: AprDisplayRiskBar }) {
  const styles = riskBarStyleTokens(bar.color_token)
  const fill = bar.fill_percent

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="min-w-0 text-sm font-semibold text-ink-900">{bar.label}</span>
        <span className={`shrink-0 text-sm font-semibold ${styles.text}`}>{bar.status_label}</span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-[#E5E7EB]"
        role="meter"
        aria-label={`${bar.label}: ${bar.status_label}, ${fill}% favorable`}
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
