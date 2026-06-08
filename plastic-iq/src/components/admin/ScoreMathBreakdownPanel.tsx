import type { ScoreFactorLabel, ScoreMathBreakdown } from '../../lib/scoreMathBreakdown'

type Props = {
  breakdown: ScoreMathBreakdown
}

function FactorEquation({ factors }: { factors: ScoreFactorLabel[] }) {
  const multipliers = factors.filter((f) => f.key !== 'baseNpr')
  const baseNpr = factors.find((f) => f.key === 'baseNpr')

  return (
    <div className="mt-3 space-y-3">
      <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm leading-relaxed text-slate-800">
        {multipliers.map((f, i) => (
          <span key={f.key}>
            {i > 0 ? ' × ' : ''}
            <span className="font-medium">{f.label}</span>: {f.valueDisplay}
          </span>
        ))}
        {baseNpr ? (
          <>
            {' = '}
            <span className="font-medium">{baseNpr.label}</span>: {baseNpr.valueDisplay}
          </>
        ) : null}
      </div>
      <ul className="space-y-2">
        {factors
          .filter((f) => f.key !== 'baseNpr')
          .map((f) => (
            <li key={f.key} className="rounded border border-slate-100 bg-white px-3 py-2 text-xs">
              <p className="font-semibold text-ink-900">
                {f.label} {f.valueDisplay}:
              </p>
              <p className="mt-1 text-slate-600">{f.explanation}</p>
            </li>
          ))}
        {baseNpr ? (
          <li className="rounded border border-slate-100 bg-white px-3 py-2 text-xs">
            <p className="font-semibold text-ink-900">
              {baseNpr.label} {baseNpr.valueDisplay}:
            </p>
            <p className="mt-1 text-slate-600">{baseNpr.explanation}</p>
          </li>
        ) : null}
      </ul>
    </div>
  )
}

function MathLine({ label, value, formula }: { label: string; value?: string; formula?: string }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-white px-3 py-2 text-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      {formula ? (
        <p className="mt-1 font-mono text-xs leading-relaxed text-slate-800">{formula}</p>
      ) : null}
      {value ? <p className="mt-1 tabular-nums text-slate-900">{value}</p> : null}
    </div>
  )
}

export function ScoreMathBreakdownPanel({ breakdown }: Props) {
  const b = breakdown

  return (
    <section className="mt-6 rounded-xl border border-indigo-200 bg-indigo-50/40 p-4">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-indigo-900">
        Score math breakdown
      </h4>
      <p className="mt-1 text-xs text-slate-600">
        V2.3.4 deterministic trail — reproduce the displayed PAC score from the numbers below.
      </p>

      {b.internallyConsistent ? (
        <p className="mt-3 text-xs font-medium text-emerald-800">
          Stored PAC score matches recomputed math from displayed inputs.
        </p>
      ) : null}

      {b.consistencyNotes.length > 0 ? (
        <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          {b.consistencyNotes.map((note) => (
            <p key={note} className="mt-1 first:mt-0">
              {note}
            </p>
          ))}
        </div>
      ) : null}

      <div className="mt-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          1. Component base NPR
        </p>
        {b.components.map((c) => (
          <div key={c.name} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
            <p className="font-semibold text-ink-900">{c.name}</p>
            {c.inertProtectionApplied ? (
              <p className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs text-emerald-950">
                <span className="font-semibold">Inert protection (V2.3.4):</span> NPR uses scoring
                severity/duration (×0.20). Gate 2 normalization keeps full use-case severity{' '}
                {c.gate2Severity?.toFixed(2) ?? '—'} and duration {c.gate2Duration?.toFixed(2) ?? '—'}.
                Material hazard and migration are unchanged.
              </p>
            ) : null}
            <FactorEquation factors={c.factorLabels} />
            <p className="mt-3 text-xs text-slate-600">
              NPR after category modifiers (before escalator):{' '}
              <strong className="tabular-nums">{c.nprAfterCategory.toFixed(1)}</strong>
            </p>
          </div>
        ))}

        <MathLine
          label="2. Base NPR before escalator"
          value={`Component NPR after category modifiers: ${b.baseNprBeforeEscalator.toFixed(1)}${
            b.components.length > 1
              ? ` · CI-weighted mean: ${b.weightedNprBeforeEscalator.toFixed(4)}`
              : ''
          }`}
        />

        {b.escalator ? (
          <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              3. Escalator
            </p>
            <p className="mt-2 text-xs text-slate-600">
              Escalator applied:{' '}
              <strong className="text-ink-900">{b.escalator.id}</strong>
            </p>
            <p className="mt-2 text-xs font-semibold text-slate-500">Plain-English name</p>
            <p className="mt-0.5 font-medium text-ink-900">{b.escalator.plainEnglishName}</p>
            <p className="mt-2 text-xs font-semibold text-slate-500">Reason</p>
            <p className="mt-0.5 text-slate-700">{b.escalator.plainEnglishReason}</p>
            <p className="mt-3 text-xs font-semibold text-slate-500">Thresholds</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-slate-700">
              {b.escalator.reviewerThresholds.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            {b.escalator.thresholdChecks.length > 0 ? (
              <>
                <p className="mt-3 text-xs font-semibold text-slate-500">This product</p>
                <ul className="mt-1 space-y-1 text-xs text-slate-700">
                  {b.escalator.thresholdChecks.map((check) => (
                    <li key={check.label}>
                      <span className="font-medium">{check.label}:</span> {check.value}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            <p className="mt-3 text-xs font-semibold text-slate-500">Calculation</p>
            <p className="mt-1 font-mono text-xs text-slate-800">{b.escalator.calculation}</p>
            <p className="mt-2 text-xs text-slate-600">
              Weighted NPR (after escalator):{' '}
              <strong className="tabular-nums">{b.weightedNprAfterEscalator.toFixed(1)}</strong>
            </p>
          </div>
        ) : (
          <MathLine
            label="3. Escalator"
            value={`None applied · Weighted NPR: ${b.weightedNprAfterEscalator.toFixed(4)}`}
          />
        )}

        <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            4. Raw score (before Layer 4A)
          </p>
          <ul className="mt-2 space-y-1 font-mono text-xs text-slate-800">
            <li>{b.rawScoreSteps.general}</li>
            <li>{b.rawScoreSteps.substituted}</li>
            <li className="font-semibold text-ink-900">{b.rawScoreSteps.result}</li>
          </ul>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            5. Layer 4A
          </p>
          <dl className="mt-2 space-y-2 text-xs text-slate-700">
            <div>
              <dt className="font-semibold text-ink-900">Normalization Layer 4A suggestion</dt>
              <dd className="tabular-nums">{b.layer4a.normalizationSuggestion}</dd>
            </div>
            <div>
              <dt className="font-semibold text-ink-900">Applied Layer 4A in final score</dt>
              <dd className="tabular-nums">{b.layer4a.appliedInFinalScore}</dd>
            </div>
            {b.layer4a.stripReason ? (
              <div className="rounded border border-sky-200 bg-sky-50 px-2 py-1.5 text-sky-950">
                <dt className="font-semibold">Reason</dt>
                <dd className="mt-0.5">{b.layer4a.stripReason}</dd>
              </div>
            ) : null}
            <div className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-emerald-950">
              <dt className="font-semibold">Final score uses applied Layer 4A</dt>
              <dd className="mt-0.5 tabular-nums">= {b.layer4a.appliedInFinalScore}</dd>
            </div>
          </dl>
          {b.layer4a.adjustments.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {b.layer4a.adjustments.map((adj) => (
                <li
                  key={`${adj.label}-${adj.value}`}
                  className="rounded border border-slate-100 bg-slate-50 px-2 py-1.5 text-xs"
                >
                  <div className="flex flex-wrap justify-between gap-2">
                    <span>{adj.label}</span>
                    <span className="font-semibold tabular-nums">{adj.value}</span>
                  </div>
                  <p className="mt-1 text-slate-600">
                    {adj.includedInScore
                      ? 'Included in final numeric score'
                      : 'Normalization suggestion only — not included in final numeric score'}
                    {adj.note ? ` — ${adj.note}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          ) : null}
          <p className="mt-3 text-xs text-slate-700">
            Score before Layer 4A:{' '}
            <strong className="tabular-nums">{b.rawScore.toFixed(2)}</strong>
            {' → '}
            after applied Layer 4A ({b.layer4a.appliedInFinalScore}):{' '}
            <strong className="tabular-nums">{b.scoreAfter4a.toFixed(2)}</strong>
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            6. Final PAC score
          </p>
          <p className="mt-1 font-mono text-xs text-slate-800">{b.scoreAfter4aFormula}</p>
          <ul className="mt-2 space-y-1 text-xs text-slate-700">
            <li>
              Pre-rounding: <strong className="tabular-nums">{b.scoreAfter4a.toFixed(2)}</strong>
            </li>
            <li>
              Rounded: <strong className="tabular-nums">{b.roundedScore}</strong>
            </li>
            <li>
              Clamped (0–{99}): <strong className="tabular-nums">{b.clampedScore}</strong>
            </li>
            <li>
              Displayed PAC Safety Score:{' '}
              <strong className="tabular-nums">{b.displayedPacScore}</strong>
            </li>
          </ul>
          {b.unknownCoatingCapApplied ? (
            <p className="mt-2 text-xs text-amber-800">
              Unknown coating hard cap applied at {b.unknownCoatingCapValue}.
            </p>
          ) : null}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            7. Confidence range
          </p>
          <ul className="mt-2 space-y-1 text-xs text-slate-700">
            <li>
              Base score: <strong className="tabular-nums">{b.confidence.baseScore}</strong>
            </li>
            <li>
              CI half-width: <strong className="tabular-nums">±{b.confidence.interval}</strong>
            </li>
            <li>
              Lower bound: <strong className="tabular-nums">{b.confidence.lower}</strong>
            </li>
            <li>
              Upper bound: <strong className="tabular-nums">{b.confidence.upper}</strong>
            </li>
            <li>
              Displayed range:{' '}
              <strong>{b.confidence.displayedRange ?? 'none (Fully Disclosed)'}</strong>
            </li>
            {b.confidence.badge ? (
              <li>
                Transparency badge: <strong>{b.confidence.badge}</strong>
              </li>
            ) : null}
          </ul>
        </div>
      </div>
    </section>
  )
}
