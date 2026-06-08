import type { CanonicalMappingsPayload, RequiredCheckResult } from '../../types/agent'
import { isStructurallyPfasFreePrimary } from '../../lib/canonicalEvidenceMapping'

type Props = {
  results: RequiredCheckResult[] | null | undefined
  canonicalMappings?: CanonicalMappingsPayload | null
}

const STATUS_STYLES: Record<string, string> = {
  passed: 'text-emerald-800 bg-emerald-50 border-emerald-200',
  failed: 'text-red-900 bg-red-50 border-red-200',
  missing: 'text-red-900 bg-red-50 border-red-200',
  not_applicable: 'text-slate-600 bg-slate-50 border-slate-200',
}

const CHECK_TITLES: Record<string, string> = {
  'external.regulatory_pfas_minnesota_review': 'Minnesota PFAS regulatory review',
  'external.pfoa_vs_pfas_free_distinction': 'PFOA/PFAS claim distinction (marketing copy)',
  'external.pfas_nonstick_disclosure': 'PFAS / nonstick disclosure',
}

function checkTitle(checkId: string, sourceUrl?: string | null): string {
  if (checkId === 'external.pfoa_vs_pfas_free_distinction' && sourceUrl && /amazon\./i.test(sourceUrl)) {
    return 'PFAS-free claim check (Amazon listing)'
  }
  return CHECK_TITLES[checkId] ?? checkId
}

function isInertCookwarePrimary(mappings?: CanonicalMappingsPayload | null): boolean {
  const primaryId = mappings?.primary_contact_material_id?.canonical_id ?? ''
  return isStructurallyPfasFreePrimary(primaryId)
}

export function Gate1RequiredCheckResultsPanel({ results, canonicalMappings }: Props) {
  const inertPrimary = isInertCookwarePrimary(canonicalMappings)
  const hasPfoaCheck = results?.some((r) => r.check_id === 'external.pfoa_vs_pfas_free_distinction')

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
        Targeted retrieval for external matrix checks (e.g. Minnesota PFAS regulatory, PFOA/PFAS
        marketing-claim distinction).
      </p>
      {inertPrimary && hasPfoaCheck ? (
        <p className="rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-xs text-slate-700">
          <span className="font-semibold text-ink-900">Non-PTFE inert cookware:</span> this is not a
          PTFE/PFAS material-risk check. The PFOA/PFAS distinction run only documents retailer
          marketing copy so PFAS-free claims are not confused with PFOA-free copy. No Minnesota PFAS
          regulatory flag applies for this inert food-contact surface.
        </p>
      ) : null}
      <ul className="space-y-3">
        {results.map((r) => (
          <li key={`${r.check_id}-${r.timestamp}`} className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_STYLES[r.status] ?? STATUS_STYLES.missing}`}
              >
                {r.status}
              </span>
              <span className="text-xs font-semibold text-ink-900">{checkTitle(r.check_id, r.source_url)}</span>
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
