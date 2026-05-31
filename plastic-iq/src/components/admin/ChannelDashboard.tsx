import { useCallback, useEffect, useMemo, useState } from 'react'
import { cn } from '../../lib/cn'
import { channelMapExportFilename } from '../../lib/channelDisplay'
import { downloadChannelMapPdf } from '../../lib/channelExportPdf'
import {
  deleteChannelMap,
  duplicateChannelMapRow,
  fetchChannelMapById,
  fetchChannelMaps,
  saveChannelMapEdits,
  startChannelMapRun,
  updateChannelMapWorkflowStatus,
} from '../../lib/channelReview'
import { formatSupabaseUnknownError } from '../../lib/supabaseClient'
import { ChannelMapProfileBody } from './ChannelMapProfileBody'
import type { ChannelMapRow, ChannelWorkflowStatus } from '../../types/channelMap'

type Props = {
  authUserEmail: string | null
  onNotice: (msg: string | null) => void
  onError: (msg: string | null) => void
}

type View = 'library' | 'detail' | 'new'
type SortKey = 'topic' | 'status' | 'date' | 'count' | 'run'

function statusBadge(status: ChannelWorkflowStatus) {
  const map: Record<ChannelWorkflowStatus, string> = {
    draft: 'bg-amber-50 text-amber-900 border-amber-200',
    approved: 'bg-emerald-50 text-emerald-900 border-emerald-200',
    rejected: 'bg-red-50 text-red-800 border-red-200',
  }
  return map[status]
}

function runBadge(runStatus?: string) {
  if (!runStatus) return 'bg-slate-50 text-slate-600 border-slate-200'
  const map: Record<string, string> = {
    running: 'bg-sky-50 text-sky-900 border-sky-200',
    partial: 'bg-amber-50 text-amber-900 border-amber-200',
    failed: 'bg-red-50 text-red-800 border-red-200',
    succeeded: 'bg-emerald-50 text-emerald-900 border-emerald-200',
  }
  return map[runStatus] ?? 'bg-slate-50 text-slate-600 border-slate-200'
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

function CostSummary({ row }: { row: ChannelMapRow }) {
  const u = row.run_metadata?.api_usage
  if (!u) return null
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-700">
      <div className="font-semibold text-ink-900">Run cost (estimate)</div>
      <div className="mt-1 grid gap-1 sm:grid-cols-2">
        <span>
          Total: <strong>${(u.total_estimated_cost_usd ?? 0).toFixed(4)}</strong>
        </span>
        <span>
          Communities: {u.channel_count ?? row.channel_count ?? 0} · Media:{' '}
          {u.media_outlet_count ?? row.media_outlets?.length ?? 0} · Industry:{' '}
          {u.industry_channel_count ?? row.industry_channels?.length ?? 0} · Sources:{' '}
          {u.source_count ?? row.sources?.length ?? 0}
        </span>
        <span>
          Perplexity: ${(u.perplexity_estimated_cost_usd ?? 0).toFixed(4)} ({u.perplexity_input_tokens ?? 0}{' '}
          in / {u.perplexity_output_tokens ?? 0} out, {u.perplexity_requests ?? 0} req)
        </span>
        <span>
          Claude: ${(u.claude_estimated_cost_usd ?? 0).toFixed(4)} ({u.claude_input_tokens ?? 0} in /{' '}
          {u.claude_output_tokens ?? 0} out)
        </span>
      </div>
    </div>
  )
}

export function ChannelDashboard({ authUserEmail, onNotice, onError }: Props) {
  const [exportingPdf, setExportingPdf] = useState(false)
  const [rows, setRows] = useState<ChannelMapRow[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<View>('library')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selected, setSelected] = useState<ChannelMapRow | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortAsc, setSortAsc] = useState(false)
  const [newTopic, setNewTopic] = useState('')
  const [startingRun, setStartingRun] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draftDescription, setDraftDescription] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  const loadLibrary = useCallback(async () => {
    setLoading(true)
    onError(null)
    try {
      const list = await fetchChannelMaps()
      setRows(list)
    } catch (e: unknown) {
      onError(formatSupabaseUnknownError(e, 'Failed to load channel maps'))
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [onError])

  const refreshSelected = useCallback(
    async (id: string) => {
      try {
        const row = await fetchChannelMapById(id)
        setSelected(row)
        setRows((prev) => {
          if (!prev) return [row]
          const idx = prev.findIndex((r) => r.channel_map_id === id)
          if (idx < 0) return [row, ...prev]
          const next = [...prev]
          next[idx] = row
          return next
        })
        return row
      } catch (e: unknown) {
        onError(formatSupabaseUnknownError(e, 'Failed to refresh channel map'))
        return null
      }
    },
    [onError],
  )

  useEffect(() => {
    void loadLibrary()
  }, [loadLibrary])

  useEffect(() => {
    if (!selectedId) {
      setSelected(null)
      return
    }
    void refreshSelected(selectedId)
  }, [selectedId, refreshSelected])

  const isRunning = selected?.run_metadata?.run_status === 'running'

  useEffect(() => {
    if (!selectedId || !isRunning) return
    const t = window.setInterval(() => {
      void refreshSelected(selectedId)
    }, 2500)
    return () => window.clearInterval(t)
  }, [selectedId, isRunning, refreshSelected])

  const sortedRows = useMemo(() => {
    const list = [...(rows ?? [])]
    const dir = sortAsc ? 1 : -1
    list.sort((a, b) => {
      switch (sortKey) {
        case 'topic':
          return dir * a.topic.localeCompare(b.topic)
        case 'status':
          return dir * a.status.localeCompare(b.status)
        case 'count':
          return dir * ((a.channel_count ?? 0) - (b.channel_count ?? 0))
        case 'run':
          return dir * (a.run_metadata?.run_status ?? '').localeCompare(
            b.run_metadata?.run_status ?? '',
          )
        case 'date':
        default:
          return dir * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      }
    })
    return list
  }, [rows, sortKey, sortAsc])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((v) => !v)
    else {
      setSortKey(key)
      setSortAsc(key === 'topic')
    }
  }

  async function handleStartRun(rerunId?: string) {
    const topic = newTopic.trim()
    if (!topic) {
      onError('Enter a research topic')
      return
    }
    if (!authUserEmail) {
      onError('Sign in with Supabase Auth to save channel maps')
      return
    }
    setStartingRun(true)
    onError(null)
    try {
      const { channel_map_id } = await startChannelMapRun({
        topic,
        channel_map_id: rerunId,
      })
      onNotice('Channel map run started — retrieval in progress…')
      setNewTopic('')
      setView('detail')
      setSelectedId(channel_map_id)
      await loadLibrary()
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : 'Failed to start run')
    } finally {
      setStartingRun(false)
    }
  }

  async function handleApproveReject(status: ChannelWorkflowStatus) {
    if (!selected) return
    setActionLoading(true)
    onError(null)
    try {
      await updateChannelMapWorkflowStatus(selected.channel_map_id, status)
      onNotice(status === 'approved' ? 'Channel map approved' : 'Channel map rejected')
      await refreshSelected(selected.channel_map_id)
      await loadLibrary()
    } catch (e: unknown) {
      onError(formatSupabaseUnknownError(e, 'Update failed'))
    } finally {
      setActionLoading(false)
    }
  }

  async function handleSaveEdit() {
    if (!selected) return
    setActionLoading(true)
    onError(null)
    try {
      await saveChannelMapEdits(selected.channel_map_id, {
        topic_description: draftDescription,
        channels: selected.channels,
        media_outlets: selected.media_outlets,
        industry_channels: selected.industry_channels,
      })
      onNotice('Channel map saved')
      setEditing(false)
      await refreshSelected(selected.channel_map_id)
      await loadLibrary()
    } catch (e: unknown) {
      onError(formatSupabaseUnknownError(e, 'Save failed'))
    } finally {
      setActionLoading(false)
    }
  }

  async function handleDuplicate(row: ChannelMapRow) {
    setActionLoading(true)
    onError(null)
    try {
      const copy = await duplicateChannelMapRow(row)
      onNotice('Channel map duplicated')
      await loadLibrary()
      setSelectedId(copy.channel_map_id)
      setView('detail')
    } catch (e: unknown) {
      onError(formatSupabaseUnknownError(e, 'Duplicate failed'))
    } finally {
      setActionLoading(false)
    }
  }

  async function handleDelete(row: ChannelMapRow) {
    if (!window.confirm(`Delete channel map "${row.topic}"? This cannot be undone.`)) return
    if (!authUserEmail) {
      onError('Sign in with Supabase Auth to delete channel maps')
      return
    }
    setActionLoading(true)
    onError(null)
    try {
      await deleteChannelMap(row.channel_map_id)
      if (selectedId === row.channel_map_id) {
        setSelectedId(null)
        setSelected(null)
        setView('library')
        setEditing(false)
      }
      onNotice('Channel map deleted')
      await loadLibrary()
    } catch (e: unknown) {
      onError(formatSupabaseUnknownError(e, 'Delete failed'))
    } finally {
      setActionLoading(false)
    }
  }

  async function handleExportPdf() {
    if (!selected) return
    setExportingPdf(true)
    onError(null)
    try {
      await downloadChannelMapPdf(
        selected.channel_map_id,
        channelMapExportFilename(selected.topic),
      )
      onNotice('PDF downloaded')
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : 'PDF export failed')
    } finally {
      setExportingPdf(false)
    }
  }

  if (view === 'new') {
    return (
      <div className="mt-6 max-w-xl">
        <button
          type="button"
          className="text-sm font-semibold text-slate-600 hover:text-ink-900"
          onClick={() => setView('library')}
        >
          ← Back to library
        </button>
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
          <h2 className="text-lg font-semibold text-ink-900">New channel map</h2>
          <p className="mt-2 text-sm text-slate-600">
            Enter a topic to discover US English channels (subreddits, forums, podcasts, etc.).
            Perplexity retrieval, then Claude synthesis. Saves as draft when complete.
          </p>
          <label className="mt-4 block">
            <span className="text-xs font-semibold text-slate-600">Topic</span>
            <input
              type="text"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={newTopic}
              onChange={(e) => setNewTopic(e.target.value)}
              placeholder='e.g. plastic exposure, PFAS in cookware'
            />
          </label>
          <button
            type="button"
            disabled={startingRun || !authUserEmail}
            className="mt-4 rounded-xl bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-700 disabled:opacity-60"
            onClick={() => void handleStartRun()}
          >
            {startingRun ? 'Starting…' : 'Run channel discovery'}
          </button>
          {!authUserEmail ? (
            <p className="mt-2 text-xs text-amber-800">Sign in with Supabase Auth to persist results.</p>
          ) : null}
        </div>
      </div>
    )
  }

  if (view === 'detail' && selected) {
    const runStatus = selected.run_metadata?.run_status

    return (
      <div className="mt-6">
        <button
          type="button"
          className="text-sm font-semibold text-slate-600 hover:text-ink-900"
          onClick={() => {
            setView('library')
            setEditing(false)
          }}
        >
          ← Back to library
        </button>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'rounded-lg border px-2 py-0.5 text-xs font-semibold capitalize',
              statusBadge(selected.status),
            )}
          >
            {selected.status}
          </span>
          {runStatus ? (
            <span
              className={cn(
                'rounded-lg border px-2 py-0.5 text-xs font-semibold capitalize',
                runBadge(runStatus),
              )}
            >
              run: {runStatus}
            </span>
          ) : null}
          <span className="text-xs text-slate-500">Updated {formatDate(selected.updated_at)}</span>
        </div>

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          {editing ? (
            <>
              <button
                type="button"
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                onClick={() => {
                  setEditing(false)
                  setDraftDescription(selected.topic_description ?? '')
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                className="rounded-xl bg-ink-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                onClick={() => void handleSaveEdit()}
              >
                Save edits
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-60"
                disabled={actionLoading || runStatus === 'running' || exportingPdf}
                onClick={() => void handleExportPdf()}
              >
                {exportingPdf ? 'Exporting…' : 'Export to PDF'}
              </button>
              <button
                type="button"
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                disabled={actionLoading || runStatus === 'running'}
                onClick={() => {
                  setDraftDescription(selected.topic_description ?? '')
                  setEditing(true)
                }}
              >
                Edit
              </button>
              <button
                type="button"
                className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900 disabled:opacity-60"
                disabled={actionLoading || selected.status === 'approved'}
                onClick={() => void handleApproveReject('approved')}
              >
                Approve
              </button>
              <button
                type="button"
                className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-800 disabled:opacity-60"
                disabled={actionLoading || selected.status === 'rejected'}
                onClick={() => void handleApproveReject('rejected')}
              >
                Reject
              </button>
              <button
                type="button"
                className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-60"
                disabled={actionLoading || runStatus === 'running'}
                onClick={() => {
                  setNewTopic(selected.topic)
                  void handleStartRun(selected.channel_map_id)
                }}
              >
                Re-run
              </button>
            </>
          )}
        </div>

        {runStatus === 'running' ? (
          <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
            <strong>Running…</strong> Stage: {selected.run_metadata?.stage ?? 'retrieval'}. This page
            refreshes automatically.
            {selected.run_metadata?.angles_completed?.length ? (
              <span className="ml-2">
                Angles done: {selected.run_metadata.angles_completed.join(', ')}
              </span>
            ) : null}
          </div>
        ) : null}

        {runStatus === 'failed' ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <strong>Run failed.</strong> {selected.run_metadata?.error_message}
          </div>
        ) : null}

        <div className="mt-4">
          <CostSummary row={selected} />
        </div>

        <div className="mt-6">
          <ChannelMapProfileBody
            row={selected}
            editing={editing}
            topicDescription={editing ? draftDescription : undefined}
            onTopicDescriptionChange={editing ? setDraftDescription : undefined}
          />
        </div>

        {selected.run_metadata?.logs?.length ? (
          <details className="mt-4 text-xs text-slate-500">
            <summary className="cursor-pointer font-semibold">Run logs</summary>
            <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-slate-50 p-3 whitespace-pre-wrap">
              {selected.run_metadata.logs.join('\n')}
            </pre>
          </details>
        ) : null}
      </div>
    )
  }

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink-900">Channel maps</h2>
          <p className="text-sm text-slate-600">
            US English channel discovery — separate from personas and the product pipeline.
          </p>
        </div>
        <button
          type="button"
          className="rounded-xl bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-700"
          onClick={() => setView('new')}
        >
          New channel map
        </button>
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-slate-600">Loading…</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-card">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-600">
              <tr>
                {(
                  [
                    ['topic', 'Topic'],
                    ['status', 'Status'],
                    ['count', 'Channels'],
                    ['run', 'Run'],
                    ['date', 'Date'],
                  ] as const
                ).map(([key, label]) => (
                  <th key={key} className="px-4 py-3">
                    <button type="button" className="hover:text-ink-900" onClick={() => toggleSort(key)}>
                      {label}
                      {sortKey === key ? (sortAsc ? ' ↑' : ' ↓') : ''}
                    </button>
                  </th>
                ))}
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    No channel maps yet. Click New channel map to run the agent.
                  </td>
                </tr>
              ) : (
                sortedRows.map((row) => (
                  <tr key={row.channel_map_id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-3 font-medium text-ink-900">{row.topic}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'rounded-md border px-2 py-0.5 text-xs font-semibold capitalize',
                          statusBadge(row.status),
                        )}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{row.channel_count ?? 0}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'rounded-md border px-2 py-0.5 text-xs font-semibold capitalize',
                          runBadge(row.run_metadata?.run_status),
                        )}
                      >
                        {row.run_metadata?.run_status ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(row.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="text-xs font-semibold text-emerald-800 hover:underline"
                          onClick={() => {
                            setSelectedId(row.channel_map_id)
                            setView('detail')
                          }}
                        >
                          View
                        </button>
                        <button
                          type="button"
                          className="text-xs font-semibold text-slate-600 hover:underline"
                          disabled={row.run_metadata?.run_status === 'running'}
                          onClick={() => {
                            setNewTopic(row.topic)
                            void handleStartRun(row.channel_map_id)
                          }}
                        >
                          Re-run
                        </button>
                        <button
                          type="button"
                          className="text-xs font-semibold text-slate-600 hover:underline"
                          disabled={actionLoading}
                          onClick={() => void handleDuplicate(row)}
                        >
                          Duplicate
                        </button>
                        <button
                          type="button"
                          className="text-xs font-semibold text-red-700 hover:underline disabled:opacity-60"
                          disabled={actionLoading}
                          onClick={() => void handleDelete(row)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
