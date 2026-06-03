import type { RequiredCheckResult } from '../../types/agent'

type Props = {
  results: RequiredCheckResult[] | null | undefined
}

const STATUS_STYLES: Record<string, string> = {
  passed: 'text-emerald-800 bg-emerald-50 border-emerald-200',
  failed: 'text-red-900 bg-red-50 border-red-200',
  missing: 'text-red-900 bg-red-50 border-red-200',
  not_applicable: 'text-slate-600 bg-slate-50 border-slate-200',
}

export function Gate1RequiredCheckResultsPanel({ results }: Props) {
  if (!results?.length) {
    return (
      <section className="mt-4 rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-xs text-slate-600">
        No required-check retrieval runs yet. Agent 1 runs targeted retrieval for blocked external
        checks before submission.
      </section>
    )
  }

  return (
    <section className="mt-4 space-y-3 rounded-xl border border-indigo-200 bg-indigo-50/30 p-4">
      <h4 className="text-sm font-semibold text-ink-900">
        Required-check retrieval results (Phase 3.7)
      </h4>
      <p className="text-xs text-slate-600">
        Targeted retrieval for external matrix checks (e.g. Minnesota PFAS regulatory, PFOA vs
        PFAS-free distinction).
      </p>
      <ul className="space-y-3">
        {results.map((r) => (
          <li key={`${r.check_id}-${r.timestamp}`} className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_STYLES[r.status] ?? STATUS_STYLES.missing}`}
              >
                {r.status}
              </span>
              <span className="font-mono text-[10px] text-slate-500">{r.check_id}</span>
              <span className="text-[10px] text-slate-400">{new Date(r.timestamp).toLocaleString()}</span>
            </div>
            {r.detail ? <p className="mt-2 text-xs text-slate-800">{r.detail}</p> : null}
            {r.canonical_ids_added?.length ? (
              <p className="mt-1 font-mono text-[10px] text-slate-600">
                Canonical: {r.canonical_ids_added.join(', ')}
              </p>
            ) : null}
            {r.source_url ? (
              <a
                href={r.source_url}
                target="_blank"
                rel="noreferrer"
                className="mt-2 block text-xs font-medium text-indigo-800 underline"
              >
                {r.source_url}
              </a>
            ) : null}
            {r.source_quote ? (
              <blockquote className="mt-2 border-l-2 border-indigo-300 pl-2 text-xs italic text-slate-700">
                {r.source_quote}
              </blockquote>
            ) : null}
            {r.retrieval_attempts?.length ? (
              <details className="mt-2">
                <summary className="cursor-pointer text-[10px] font-semibold text-slate-500">
                  Retrieval attempts ({r.retrieval_attempts.length})
                </summary>
                <ul className="mt-1 space-y-1 text-[10px] text-slate-600">
                  {r.retrieval_attempts.map((a, i) => (
                    <li key={i}>
                      {a.goal}: {a.query ?? '—'} → {a.result_count ?? 0} hit(s)
                      {a.error ? ` (${a.error})` : ''}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  )
}
