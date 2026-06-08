type OutOfScopeSignal = {
  signal_id: string
  category: string
  summary: string
  source_url?: string | null
  source_quote?: string | null
  scope_note?: string
}

type Props = {
  signals: OutOfScopeSignal[] | null | undefined
  transparencyAssessment?: {
    transparency_badge: string
    badge_justification: string
    fully_disclosed_eligible: boolean
  } | null
}

export function Gate1OutOfScopeSafetySignals({ signals, transparencyAssessment }: Props) {
  const list = signals ?? []
  if (list.length === 0 && !transparencyAssessment) return null

  return (
    <section className="rounded-lg border border-amber-200 bg-amber-50/80 p-4 space-y-3">
      <h4 className="text-sm font-semibold text-amber-950">Out-of-scope safety signals</h4>
      <p className="text-xs text-amber-900">
        These concerns are outside the PAC Safety Score methodology. They do not change the PAC score,
        are not Layer 4A PAC penalties, and are not score-blocking PAC evidence gaps. Public product
        pages suppress this block until a dedicated &quot;Other safety notes&quot; section is designed.
      </p>
      {transparencyAssessment ? (
        <div className="rounded border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800">
          <span className="font-semibold">Transparency (Gate 1): </span>
          {transparencyAssessment.transparency_badge}
          {transparencyAssessment.fully_disclosed_eligible ? '' : ' — not Fully Disclosed eligible'}
          <p className="mt-1 text-slate-600">{transparencyAssessment.badge_justification}</p>
        </div>
      ) : null}
      {list.length > 0 ? (
        <ul className="list-disc pl-5 space-y-2 text-xs text-amber-950">
          {list.map((s) => (
            <li key={s.signal_id}>
              <span className="font-medium capitalize">{s.category.replace(/_/g, ' ')}: </span>
              {s.summary}
              {s.source_url ? (
                <a
                  href={s.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-1 text-blue-700 underline"
                >
                  source
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
