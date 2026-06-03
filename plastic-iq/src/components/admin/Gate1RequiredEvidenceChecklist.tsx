import { useMemo } from 'react'
import type { RequiredEvidenceValidationPayload } from '../../types/agent'

type Props = {
  validation: RequiredEvidenceValidationPayload | null | undefined
}

const STATUS_STYLES: Record<string, string> = {
  passed: 'bg-emerald-50 text-emerald-900 border-emerald-200',
  missing: 'bg-red-50 text-red-900 border-red-200',
  review_required: 'bg-amber-50 text-amber-950 border-amber-200',
  not_applicable: 'bg-slate-50 text-slate-600 border-slate-200',
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-block rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${STATUS_STYLES[status] ?? STATUS_STYLES.not_applicable}`}
    >
      {status.replace(/_/g, ' ')}
    </span>
  )
}

export function Gate1RequiredEvidenceChecklist({ validation }: Props) {
  const groups = useMemo(() => {
    if (!validation) return null
    const items = validation.checklist_items ?? []
    const scoreBlockers = items.filter(
      (i) => i.score_driving && (i.status === 'missing' || (i.status === 'review_required' && i.severity === 'blocker')),
    )
    const nonScoreGaps = items.filter((i) => !i.score_driving && i.status === 'missing')
    const passed = items.filter((i) => i.status === 'passed')
    const external = items.filter((i) => i.category === 'external_check' && i.status !== 'not_applicable')
    return { scoreBlockers, nonScoreGaps, passed, external, items }
  }, [validation])

  if (!validation) {
    return (
      <section className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
        Required evidence matrix not evaluated yet. Save draft or reload to run Phase 3.6 validation.
      </section>
    )
  }

  const s = validation.summary

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold text-ink-900">Required evidence checklist (Phase 3.6)</h4>
          <p className="mt-1 text-xs text-slate-600">
            Matrix: {validation.matrix_display_label ?? validation.subcategory_key} · evaluated{' '}
            {new Date(validation.evaluated_at).toLocaleString()}
          </p>
        </div>
        <p
          className={`text-xs font-semibold ${s.approval_blocked ? 'text-red-800' : 'text-emerald-800'}`}
        >
          {s.approval_blocked ? 'Approval blocked' : 'No score-blocking gaps'}
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <SummaryChip
          label="Required fields"
          ok={s.required_fields_complete}
          detail={s.required_fields_complete ? 'Complete' : 'Gaps remain'}
        />
        <SummaryChip
          label="External checks (score)"
          ok={s.required_external_checks_complete}
          detail={s.required_external_checks_complete ? 'Complete' : 'Incomplete'}
        />
        <SummaryChip
          label="Product identity"
          ok={s.product_identity_verified}
          detail={s.product_identity_verified ? 'Verified' : 'Incomplete'}
        />
        <SummaryChip label="Score-blocking gaps" ok={s.score_blocking_gaps === 0} detail={String(s.score_blocking_gaps)} />
        <SummaryChip label="Non-score gaps" ok={s.non_score_gaps === 0} detail={String(s.non_score_gaps)} warnOnly />
        {s.active_triggers?.length ? (
          <p className="text-[10px] text-slate-500 sm:col-span-2 lg:col-span-3">
            Active patterns: {s.active_triggers.join(', ')}
          </p>
        ) : null}
      </div>

      {validation.approval_blockers.length > 0 ? (
        <ul className="list-disc space-y-1 rounded-lg border border-red-200 bg-red-50/80 py-2 pl-8 pr-3 text-xs text-red-950">
          {validation.approval_blockers.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      ) : null}

      {groups && groups.scoreBlockers.length > 0 ? (
        <ChecklistGroup title="Score-blocking gaps" items={groups.scoreBlockers} />
      ) : null}

      {groups && groups.nonScoreGaps.length > 0 ? (
        <ChecklistGroup title="Non-score gaps (warnings)" items={groups.nonScoreGaps} />
      ) : null}

      <ChecklistGroup
        title="All checklist items"
        items={groups?.items.filter((i) => i.status !== 'not_applicable') ?? []}
        defaultCollapsed
      />
    </section>
  )
}

function SummaryChip({
  label,
  ok,
  detail,
  warnOnly,
}: {
  label: string
  ok: boolean
  detail: string
  warnOnly?: boolean
}) {
  const tone = ok ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : warnOnly ? 'border-amber-200 bg-amber-50 text-amber-950' : 'border-red-200 bg-red-50 text-red-900'
  return (
    <div className={`rounded-lg border px-3 py-2 ${tone}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide opacity-80">{label}</p>
      <p className="text-xs font-medium">{detail}</p>
    </div>
  )
}

function ChecklistGroup({
  title,
  items,
  defaultCollapsed,
}: {
  title: string
  items: RequiredEvidenceValidationPayload['checklist_items']
  defaultCollapsed?: boolean
}) {
  if (items.length === 0) return null
  return (
    <details className="group" open={!defaultCollapsed}>
      <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-slate-600">
        {title} ({items.length})
      </summary>
      <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-100">
        {items.map((item) => (
          <li key={item.id} className="flex flex-wrap items-start gap-2 px-3 py-2 text-xs">
            <StatusBadge status={item.status} />
            <span className="flex-1 font-medium text-slate-800">{item.label}</span>
            {item.score_driving ? (
              <span className="rounded bg-slate-100 px-1 text-[9px] font-semibold text-slate-600">score</span>
            ) : null}
            {item.detail ? <p className="w-full text-slate-600">{item.detail}</p> : null}
            {item.source_url ? (
              <a href={item.source_url} target="_blank" rel="noreferrer" className="text-[10px] underline">
                source
              </a>
            ) : null}
          </li>
        ))}
      </ul>
    </details>
  )
}
