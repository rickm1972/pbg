import { useMemo, useState } from 'react'
import { colorForTier } from '../../lib/score'
import type { LockedSnapshotDraftRow } from '../../types/lockedSnapshotDraft'
import type { ProductTier } from '../../types'

type Props = {
  draft: LockedSnapshotDraftRow
  productName: string | null
  brand: string | null
  busy: boolean
  authUserEmail: string | null
  onMarkReady: () => void
  onReject: (notes: string) => void
}

export function LockedSnapshotDraftReviewPanel({
  draft,
  productName,
  brand,
  busy,
  authUserEmail,
  onMarkReady,
  onReject,
}: Props) {
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectNotes, setRejectNotes] = useState('')
  const snap = draft.snapshot_payload
  const tierStyles = colorForTier(snap.tier as ProductTier)
  const components = useMemo(() => {
    const list = (draft.display_payload?.components as Array<Record<string, unknown>>) ?? []
    return list
  }, [draft.display_payload])

  return (
    <div className="space-y-6 rounded-2xl border border-sky-200 bg-white p-6 shadow-card">
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        <p className="font-semibold">Locked snapshot draft</p>
        <p className="mt-1 font-medium">Unpublished preview</p>
        <p className="mt-1">{snap.publish_disabled_notice}</p>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-800">
            Locked snapshot draft review
          </p>
          <h2 className="mt-1 text-xl font-semibold text-ink-900">{productName ?? snap.product_name}</h2>
          <p className="mt-1 text-sm text-slate-600">{brand ?? snap.brand}</p>
        </div>
        <div className="text-right">
          <DraftStatusBadge status={draft.draft_status} />
          <div
            className={`mt-2 inline-flex rounded-2xl px-4 py-2 text-3xl font-bold tabular-nums ${tierStyles.bg} ${tierStyles.text}`}
          >
            {snap.pac_safety_score}
          </div>
          <p className={`mt-1 text-sm font-semibold ${tierStyles.text}`}>{snap.tier}</p>
          {snap.transparency_badge ? (
            <p className="mt-1 text-xs text-slate-600">{snap.transparency_badge}</p>
          ) : null}
        </div>
      </div>

      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <MetaItem label="locked_input_id" value={draft.locked_input_id} mono />
        <MetaItem label="locked_output_id" value={draft.locked_output_id} mono />
        <MetaItem label="locked_audit_id" value={draft.locked_audit_id} mono />
        <MetaItem label="lock_hash" value={draft.lock_hash.slice(0, 16) + '…'} mono />
        <MetaItem label="input_source" value={draft.input_source} />
        <MetaItem label="methodology_version" value={draft.methodology_version} />
        <MetaItem label="material_lookup_version" value={draft.material_lookup_version} />
        <MetaItem label="publish_enabled" value={String(snap.publish_enabled)} />
        <MetaItem label="public_visible" value={String(snap.public_visible)} />
        <MetaItem label="Agent 4 audit_status" value={draft.audit_summary.audit_status} />
      </dl>

      {snap.why_this_score_draft ? (
        <section>
          <h3 className="text-sm font-semibold text-ink-900">Why this score (draft)</h3>
          <p className="mt-2 text-sm text-slate-700">{snap.why_this_score_draft}</p>
        </section>
      ) : null}

      <section>
        <h3 className="text-sm font-semibold text-ink-900">Component / material summary</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="py-2 pr-3">Component</th>
                <th className="py-2 pr-3">Role</th>
                <th className="py-2 pr-3">Canonical ID</th>
                <th className="py-2 pr-3">Score-driving</th>
                <th className="py-2 pr-3">NPR</th>
              </tr>
            </thead>
            <tbody>
              {components.map((c) => (
                <tr key={`${c.component_name}-${c.locked_canonical_material_id}`} className="border-b border-slate-100">
                  <td className="py-2 pr-3 font-medium">{String(c.component_name)}</td>
                  <td className="py-2 pr-3">{String(c.component_role)}</td>
                  <td className="py-2 pr-3 font-mono text-[10px]">{String(c.locked_canonical_material_id)}</td>
                  <td className="py-2 pr-3">{c.score_driving ? 'yes' : 'no'}</td>
                  <td className="py-2 pr-3 tabular-nums">{String(c.npr_after_escalator ?? '—')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {draft.audit_summary.blockers?.length ? (
        <section>
          <h3 className="text-sm font-semibold text-red-800">Audit blockers</h3>
          <ul className="mt-2 list-disc pl-5 text-sm text-red-900">
            {draft.audit_summary.blockers.map((b) => (
              <li key={b.code}>{b.message}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {authUserEmail && draft.draft_status !== 'rejected' && draft.draft_status !== 'superseded' ? (
        <div className="flex flex-wrap gap-3 border-t border-slate-200 pt-4">
          {draft.draft_status === 'draft' ? (
            <button
              type="button"
              disabled={busy}
              onClick={onMarkReady}
              className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
            >
              Mark ready for review
            </button>
          ) : null}
          {!rejectOpen ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => setRejectOpen(true)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Reject draft
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
                <button type="button" onClick={() => setRejectOpen(false)} className="rounded-lg border px-4 py-2 text-sm">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}

function DraftStatusBadge({ status }: { status: string }) {
  const styles =
    status === 'approved_for_future_publish'
      ? 'bg-emerald-100 text-emerald-900'
      : status === 'rejected'
        ? 'bg-red-100 text-red-900'
        : 'bg-sky-100 text-sky-900'
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase ${styles}`}>
      {status.replace(/_/g, ' ')}
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
