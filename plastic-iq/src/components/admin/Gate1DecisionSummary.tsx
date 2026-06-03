import type { ApprovalBlockers } from '../../lib/evidenceVersionFields'
import type { ProductEvidence, ProductPipelineRow, RequiredEvidenceValidationPayload } from '../../types/agent'

type Props = {
  product: ProductPipelineRow
  evidence: ProductEvidence
  validation: RequiredEvidenceValidationPayload | null | undefined
  approvalBlockers: ApprovalBlockers
  legacy: boolean
}

export function Gate1DecisionSummary({
  product,
  evidence,
  validation,
  approvalBlockers,
  legacy,
}: Props) {
  const s = validation?.summary
  const approvalBlocked = s?.approval_blocked ?? !approvalBlockers.canApprove
  const scoreBlocking = s?.score_blocking_gaps ?? 0
  const nonScore = s?.non_score_gaps ?? 0

  const approvable =
    !legacy && approvalBlockers.canApprove && !approvalBlocked

  let statement = ''
  if (legacy) {
    statement = 'Legacy evidence bundle — re-run Agent 1 before this packet can be approved.'
  } else if (approvable) {
    statement =
      'Evidence packet is approvable: required matrix and canonical mappings have no score-blocking gaps. Acknowledge any non-score warnings, then approve.'
  } else if (approvalBlocked && validation?.approval_blockers?.length) {
    statement = validation.approval_blockers[0]
  } else if (!approvalBlockers.canApprove) {
    statement = approvalBlockers.reasons[0] ?? 'Resolve blockers below before approving.'
  } else {
    statement = 'Review checklist and canonical taxonomy before approving.'
  }

  return (
    <section
      className={`mt-4 rounded-xl border p-4 ${
        approvable
          ? 'border-emerald-200 bg-emerald-50/80'
          : approvalBlocked
            ? 'border-red-200 bg-red-50/80'
            : 'border-amber-200 bg-amber-50/80'
      }`}
      aria-label="Gate 1 decision summary"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">
            Gate 1 decision summary
          </p>
          <h4 className="mt-1 text-base font-semibold text-ink-900">{product.product_name}</h4>
          <p className="mt-1 text-xs text-slate-600">
            Bundle v{evidence.bundle_version} · review status:{' '}
            <span className="font-semibold">{evidence.review_status.replace(/_/g, ' ')}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <DecisionPill
            label="Approval blocked"
            value={approvalBlocked ? 'Yes' : 'No'}
            ok={!approvalBlocked}
          />
          <DecisionPill
            label="Approvable now"
            value={approvable ? 'Yes' : 'No'}
            ok={approvable}
          />
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Score-blocking gaps" value={String(scoreBlocking)} ok={scoreBlocking === 0} />
        <Metric label="Non-score warnings" value={String(nonScore)} ok={nonScore === 0} warnOnly />
        <Metric
          label="Required fields"
          value={s ? (s.required_fields_complete ? 'Complete' : 'Incomplete') : legacy ? 'N/A' : '—'}
          ok={s?.required_fields_complete ?? false}
        />
        <Metric
          label="External checks"
          value={
            s ? (s.required_external_checks_complete ? 'Complete' : 'Incomplete') : legacy ? 'N/A' : '—'
          }
          ok={s?.required_external_checks_complete ?? false}
        />
      </div>

      <p className="mt-4 text-sm font-medium text-ink-900">{statement}</p>

      {!approvable && approvalBlockers.reasons.length > 1 ? (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-700">
          {approvalBlockers.reasons.slice(1, 5).map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

function DecisionPill({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <span
      className={`rounded-lg px-2.5 py-1 text-xs font-semibold ring-1 ${
        ok ? 'bg-white text-emerald-900 ring-emerald-300' : 'bg-white text-red-900 ring-red-300'
      }`}
    >
      {label}: {value}
    </span>
  )
}

function Metric({
  label,
  value,
  ok,
  warnOnly,
}: {
  label: string
  value: string
  ok: boolean
  warnOnly?: boolean
}) {
  const tone = ok
    ? 'text-emerald-800'
    : warnOnly
      ? 'text-amber-900'
      : 'text-red-800'
  return (
    <div className="rounded-lg bg-white/70 px-3 py-2 ring-1 ring-slate-200/80">
      <p className="text-[10px] font-semibold uppercase text-slate-500">{label}</p>
      <p className={`text-sm font-semibold ${tone}`}>{value}</p>
    </div>
  )
}
