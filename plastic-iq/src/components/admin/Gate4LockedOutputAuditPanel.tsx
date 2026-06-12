import { useMemo, useState } from 'react'
import { colorForTier } from '../../lib/score'
import type { Agent4LockedAuditRow } from '../../types/agent4LockedAudit'
import type { ProductPipelineRow } from '../../types/agent'
import type { ProductTier } from '../../types'

type Props = {
  product: ProductPipelineRow
  audit: Agent4LockedAuditRow
  busy: boolean
  authUserEmail: string | null
  onReject: (notes: string) => void
}

export function Gate4LockedOutputAuditPanel({
  product,
  audit,
  busy,
  authUserEmail,
  onReject,
}: Props) {
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectNotes, setRejectNotes] = useState('')

  const score = audit.audit_payload.score_summary
  const tierStyles = colorForTier(score.tier as ProductTier)
  const editable = audit.audit_status === 'passed' || audit.audit_status === 'failed'

  const failedChecks = useMemo(
    () => audit.consistency_checks.filter((c) => !c.pass),
    [audit.consistency_checks],
  )

  return (
    <div className="space-y-6 rounded-2xl border border-amber-200 bg-white p-6 shadow-card">
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        <p className="font-semibold">Agent 4 locked-output audit</p>
        <p className="mt-1 font-medium">Input source: Agent 3 locked-output record</p>
        <p className="mt-1">
          {audit.audit_payload.publish_disabled_notice ??
            'Locked-output Agent 4 audit is isolated. Publishing is not enabled from this audit yet.'}
        </p>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
            Gate 4 — Locked-output audit review
          </p>
          <h2 className="mt-1 text-xl font-semibold text-ink-900">{product.product_name}</h2>
          <p className="mt-1 text-sm text-slate-600">{product.brand}</p>
        </div>
        <div className="text-right">
          <AuditStatusBadge status={audit.audit_status} />
          <div
            className={`mt-2 inline-flex rounded-2xl px-4 py-2 text-3xl font-bold tabular-nums ${tierStyles.bg} ${tierStyles.text}`}
          >
            {score.pac_safety_score}
          </div>
          <p className={`mt-1 text-sm font-semibold ${tierStyles.text}`}>{score.tier}</p>
          {score.transparency_badge ? (
            <p className="mt-1 text-xs text-slate-600">{score.transparency_badge}</p>
          ) : null}
        </div>
      </div>

      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <MetaItem label="locked_output_id" value={audit.locked_output_id} mono />
        <MetaItem label="locked_input_id" value={audit.locked_input_id} mono />
        <MetaItem label="lock_hash" value={audit.lock_hash.slice(0, 16) + '…'} mono />
        <MetaItem label="input_source" value={audit.input_source} />
        <MetaItem label="audited agent3 input_source" value={audit.audit_payload.audited_agent3_input_source} />
        <MetaItem label="methodology_version" value={audit.methodology_version} />
        <MetaItem label="material_lookup_version" value={audit.material_lookup_version} />
        <MetaItem label="weighted NPR" value={String(score.weighted_npr)} />
        <MetaItem label="raw score (pre Layer 4A)" value={String(score.raw_score_before_layer_4a)} />
        <MetaItem label="Layer 4A total" value={String(score.layer_4a_total_applied)} />
        <MetaItem label="cap triggered" value={score.cap_triggered ? 'yes' : 'no'} />
        <MetaItem label="final score" value={String(score.final_score)} />
      </dl>

      {audit.blockers.length > 0 ? (
        <section>
          <h3 className="text-sm font-semibold text-red-800">Blockers</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-red-900">
            {audit.blockers.map((b) => (
              <li key={b.code}>
                <span className="font-mono text-xs">{b.code}</span> — {b.message}
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="text-sm text-emerald-800">No blockers.</p>
      )}

      {audit.warnings.length > 0 ? (
        <section>
          <h3 className="text-sm font-semibold text-amber-900">Warnings</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-950">
            {audit.warnings.map((w) => (
              <li key={w.code}>
                <span className="font-mono text-xs">{w.code}</span> — {w.message}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h3 className="text-sm font-semibold text-ink-900">Consistency checks</h3>
        <p className="mt-1 text-xs text-slate-500">
          {audit.audit_payload.checks_passed} passed · {audit.audit_payload.checks_failed} failed
        </p>
        <ul className="mt-3 max-h-64 space-y-1 overflow-auto text-xs">
          {audit.consistency_checks.map((c) => (
            <li
              key={c.id}
              className={`rounded px-2 py-1 ${c.pass ? 'bg-emerald-50 text-emerald-900' : 'bg-red-50 text-red-900'}`}
            >
              <span className="font-mono">{c.id}</span> — {c.message}
            </li>
          ))}
        </ul>
        {failedChecks.length > 0 ? (
          <p className="mt-2 text-xs text-red-700">{failedChecks.length} check(s) failed.</p>
        ) : null}
      </section>

      <section>
        <h3 className="text-sm font-semibold text-ink-900">Component math summary</h3>
        <p className="mt-1 text-sm text-slate-600">
          {audit.audit_payload.component_count} score-driving component(s) in audited locked output.
        </p>
      </section>

      {editable && authUserEmail ? (
        <div className="flex flex-wrap gap-3 border-t border-slate-200 pt-4">
          {!rejectOpen ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => setRejectOpen(true)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Mark audit rejected
            </button>
          ) : (
            <div className="w-full space-y-2">
              <textarea
                value={rejectNotes}
                onChange={(e) => setRejectNotes(e.target.value)}
                placeholder="Rejection notes (optional)"
                className="w-full rounded-lg border border-slate-300 p-2 text-sm"
                rows={3}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    onReject(rejectNotes)
                    setRejectOpen(false)
                    setRejectNotes('')
                  }}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  Confirm reject
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRejectOpen(false)
                    setRejectNotes('')
                  }}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-slate-500">
          Audit status: {audit.audit_status}
          {audit.reviewed_by ? ` — ${audit.reviewed_by}` : ''}
        </p>
      )}
    </div>
  )
}

function AuditStatusBadge({ status }: { status: string }) {
  const styles =
    status === 'passed'
      ? 'bg-emerald-100 text-emerald-900'
      : status === 'failed'
        ? 'bg-red-100 text-red-900'
        : status === 'rejected'
          ? 'bg-slate-200 text-slate-800'
          : 'bg-amber-100 text-amber-900'
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase ${styles}`}>
      {status}
    </span>
  )
}

function MetaItem({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className={`mt-0.5 text-sm text-ink-900 ${mono ? 'font-mono text-xs break-all' : ''}`}>{value}</dd>
    </div>
  )
}
