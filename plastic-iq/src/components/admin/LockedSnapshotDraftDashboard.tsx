import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatSupabaseUnknownError } from '../../lib/supabaseClient'
import {
  fetchLockedSnapshotDraftDashboard,
  markLockedSnapshotDraftReadyForReview,
  rejectLockedSnapshotDraft,
  type LockedSnapshotDraftDashboardItem,
} from '../../lib/lockedSnapshotDraftReview'
import { LockedSnapshotDraftReviewPanel } from './LockedSnapshotDraftReviewPanel'

type Props = {
  authUserEmail: string | null
  onNotice: (message: string | null) => void
  onError: (message: string | null) => void
}

export function LockedSnapshotDraftDashboard({ authUserEmail, onNotice, onError }: Props) {
  const [drafts, setDrafts] = useState<LockedSnapshotDraftDashboardItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    onError(null)
    try {
      const data = await fetchLockedSnapshotDraftDashboard()
      setDrafts(data.drafts)
    } catch (e: unknown) {
      setDrafts([])
      onError(formatSupabaseUnknownError(e, 'Failed to load locked snapshot drafts'))
    } finally {
      setLoading(false)
    }
  }, [onError])

  useEffect(() => {
    load()
  }, [load])

  const selected = useMemo(
    () => drafts.find((d) => d.draft.locked_snapshot_draft_id === selectedId) ?? null,
    [drafts, selectedId],
  )

  useEffect(() => {
    if (!selectedId && drafts.length > 0) {
      setSelectedId(drafts[0].draft.locked_snapshot_draft_id)
    }
  }, [drafts, selectedId])

  async function handleMarkReady() {
    if (!selected || !authUserEmail) return
    setBusyId(selected.draft.locked_snapshot_draft_id)
    try {
      await markLockedSnapshotDraftReadyForReview({
        locked_snapshot_draft_id: selected.draft.locked_snapshot_draft_id,
        reviewed_by: authUserEmail,
      })
      onNotice('Draft marked ready for review.')
      await load()
    } catch (e: unknown) {
      onError(formatSupabaseUnknownError(e, 'Update failed'))
    } finally {
      setBusyId(null)
    }
  }

  async function handleReject(notes: string) {
    if (!selected || !authUserEmail) return
    setBusyId(selected.draft.locked_snapshot_draft_id)
    try {
      await rejectLockedSnapshotDraft({
        locked_snapshot_draft_id: selected.draft.locked_snapshot_draft_id,
        reviewed_by: authUserEmail,
        review_notes: notes.trim() || null,
      })
      onNotice('Draft rejected.')
      await load()
    } catch (e: unknown) {
      onError(formatSupabaseUnknownError(e, 'Reject failed'))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="mt-8 space-y-4 rounded-2xl border border-sky-200 bg-sky-50/40 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink-900">Locked snapshot drafts</h2>
          <p className="mt-1 text-sm text-slate-600">
            Unpublished preview from locked Agent 1→3→4 chain. {drafts.length} draft(s). Not live publish.
          </p>
        </div>
        <button
          type="button"
          onClick={() => load()}
          disabled={loading}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <ul className="max-h-[50dvh] divide-y divide-slate-200 overflow-auto rounded-xl border border-slate-200 bg-white">
            {drafts.length === 0 ? (
              <li className="p-4 text-sm text-slate-600">No locked snapshot drafts yet.</li>
            ) : (
              drafts.map((item) => {
                const id = item.draft.locked_snapshot_draft_id
                const isSelected = id === selectedId
                return (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(id)}
                      className={`w-full px-4 py-3 text-left transition hover:bg-sky-50/60 ${isSelected ? 'bg-sky-50' : ''}`}
                    >
                      <p className="text-sm font-semibold text-ink-900">
                        {item.product_name ?? item.draft.snapshot_payload.product_name ?? 'Product'}
                      </p>
                      <p className="text-xs text-slate-600">
                        {item.draft.snapshot_payload.pac_safety_score} · {item.draft.snapshot_payload.tier} ·{' '}
                        {item.draft.draft_status}
                      </p>
                    </button>
                  </li>
                )
              })
            )}
          </ul>
        </div>
        <div className="lg:col-span-8">
          {selected ? (
            <LockedSnapshotDraftReviewPanel
              draft={selected.draft}
              productName={selected.product_name}
              brand={selected.brand}
              busy={busyId === selected.draft.locked_snapshot_draft_id}
              authUserEmail={authUserEmail}
              onMarkReady={handleMarkReady}
              onReject={handleReject}
            />
          ) : (
            <div className="flex min-h-[280px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-sm text-slate-600">
              Select a locked snapshot draft to review.
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
