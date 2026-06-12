import { useMemo, useState } from 'react'
import { colorForTier } from '../../lib/score'
import type { Agent3LockedOutputRow } from '../../types/agent3LockedOutput'
import type { ProductPipelineRow } from '../../types/agent'
import type { ProductTier } from '../../types'

type Props = {
  product: ProductPipelineRow
  output: Agent3LockedOutputRow
  busy: boolean
  authUserEmail: string | null
  onApprove: () => void
  onReject: (notes: string) => void
}

export function Gate3LockedInputScoreReviewPanel({
  product,
  output,
  busy,
  authUserEmail,
  onApprove,
  onReject,
}: Props) {
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectNotes, setRejectNotes] = useState('')

  const score = output.score_payload
  const math = output.math_breakdown
  const display = output.display_payload
  const tierStyles = colorForTier(score.tier as ProductTier)
  const editable = output.review_status === 'pending_review' || output.review_status === 'draft'

  const componentRows = useMemo(() => math.components ?? [], [math.components])

  return (
    <div className="space-y-6 rounded-2xl border border-violet-200 bg-white p-6 shadow-card">
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        <p className="font-semibold">Input source: locked Agent 1 package</p>
        <p className="mt-1">
          {display?.locked_input_warning ??
            'Locked-input Agent 3 path is parallel/opt-in. Publishing is not enabled from this output yet.'}
        </p>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">
            Gate 3 — Locked-input score review
          </p>
          <h2 className="mt-1 text-xl font-semibold text-ink-900">{product.product_name}</h2>
          <p className="mt-1 text-sm text-slate-600">{product.brand}</p>
        </div>
        <div className="text-right">
          <div
            className={`inline-flex rounded-2xl px-4 py-2 text-3xl font-bold tabular-nums ${tierStyles.bg} ${tierStyles.text}`}
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
        <MetaItem label="locked_input_id" value={output.locked_input_id} mono />
        <MetaItem label="lock_hash" value={output.lock_hash.slice(0, 16) + '…'} mono />
        <MetaItem label="methodology_version" value={output.methodology_version} />
        <MetaItem label="material_lookup_version" value={output.material_lookup_version} />
        <MetaItem label="input_source" value={output.input_source} />
        <MetaItem label="review_status" value={output.review_status} />
        <MetaItem label="weighted NPR" value={String(score.weighted_npr)} />
        <MetaItem label="raw score (pre Layer 4A)" value={String(score.raw_score_before_layer_4a)} />
        <MetaItem label="Layer 4A total" value={String(score.layer_4a_total_applied)} />
        <MetaItem label="cap triggered" value={score.cap_triggered ? 'yes' : 'no'} />
        <MetaItem label="final score" value={String(score.final_score)} />
      </dl>

      {display?.why_this_score_draft ? (
        <section>
          <h3 className="text-sm font-semibold text-ink-900">Why this score (draft)</h3>
          <p className="mt-2 text-sm text-slate-700">{display.why_this_score_draft}</p>
        </section>
      ) : null}

      <section>
        <h3 className="text-sm font-semibold text-ink-900">Component math breakdown</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="py-2 pr-3">Component</th>
                <th className="py-2 pr-3">Role</th>
                <th className="py-2 pr-3">Hazard</th>
                <th className="py-2 pr-3">Adj mig</th>
                <th className="py-2 pr-3">CI</th>
                <th className="py-2 pr-3">ND?</th>
                <th className="py-2 pr-3">NPR</th>
              </tr>
            </thead>
            <tbody>
              {componentRows.map((c) => (
                <tr key={`${c.component_name}-${c.locked_canonical_material_id}`} className="border-b border-slate-100">
                  <td className="py-2 pr-3 font-medium text-ink-900">{c.component_name}</td>
                  <td className="py-2 pr-3">{c.component_role}</td>
                  <td className="py-2 pr-3 tabular-nums">{c.hazard_used}</td>
                  <td className="py-2 pr-3 tabular-nums">{c.adjusted_migration_used}</td>
                  <td className="py-2 pr-3 tabular-nums">{c.contact_intimacy}</td>
                  <td className="py-2 pr-3">{c.non_detect_mitigation_applied ? `yes (${c.mitigation_factor ?? '—'})` : 'no'}</td>
                  <td className="py-2 pr-3 tabular-nums">{c.npr_after_escalator}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {editable && authUserEmail ? (
        <div className="flex flex-wrap gap-3 border-t border-slate-200 pt-4">
          {!rejectOpen ? (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={onApprove}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                Approve locked output
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setRejectOpen(true)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Reject
              </button>
            </>
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
          Review status: {output.review_status}
          {output.reviewed_by ? ` — ${output.reviewed_by}` : ''}
        </p>
      )}
    </div>
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
