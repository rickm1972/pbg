import { useCallback, useEffect, useMemo, useState } from 'react'
import { cn } from '../../lib/cn'
import { formatPersonaDisplayName, personaExportFilename } from '../../lib/personaDisplay'
import { downloadPersonaPdf } from '../../lib/personaExportPdf'
import { formatSupabaseUnknownError } from '../../lib/supabaseClient'
import { PersonaProfileBody } from './PersonaProfileBody'
import {
  deletePersona,
  duplicatePersonaRow,
  fetchPersonaById,
  fetchPersonas,
  savePersonaContent,
  startPersonaRun,
  updatePersonaWorkflowStatus,
} from '../../lib/personaReview'
import type { PersonaContent, PersonaRow, PersonaWorkflowStatus } from '../../types/persona'

type Props = {
  authUserEmail: string | null
  onNotice: (msg: string | null) => void
  onError: (msg: string | null) => void
}

type View = 'library' | 'detail' | 'new'

type SortKey = 'name' | 'segment' | 'status' | 'date' | 'run'

function statusBadge(status: PersonaWorkflowStatus) {
  const map: Record<PersonaWorkflowStatus, string> = {
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

function CostSummary({ row }: { row: PersonaRow }) {
  const u = row.run_metadata?.api_usage
  if (!u) return null
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-700">
      <div className="font-semibold text-ink-900">Run cost (estimate)</div>
      <div className="mt-1 grid gap-1 sm:grid-cols-2">
        <span>
          Total: <strong>${(u.total_estimated_cost_usd ?? 0).toFixed(4)}</strong>
        </span>
        <span>Sources: {u.source_count ?? row.sources?.length ?? 0}</span>
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

export function PersonaDashboard({ authUserEmail, onNotice, onError }: Props) {
  const [exportingPdf, setExportingPdf] = useState(false)
  const [rows, setRows] = useState<PersonaRow[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<View>('library')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selected, setSelected] = useState<PersonaRow | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortAsc, setSortAsc] = useState(false)
  const [newSegment, setNewSegment] = useState('')
  const [startingRun, setStartingRun] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draftContent, setDraftContent] = useState<PersonaContent>({})
  const [actionLoading, setActionLoading] = useState(false)

  const loadLibrary = useCallback(async () => {
    setLoading(true)
    onError(null)
    try {
      const list = await fetchPersonas()
      setRows(list)
    } catch (e: unknown) {
      onError(formatSupabaseUnknownError(e, 'Failed to load personas'))
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [onError])

  const refreshSelected = useCallback(
    async (id: string) => {
      try {
        const row = await fetchPersonaById(id)
        setSelected(row)
        setRows((prev) => {
          if (!prev) return [row]
          const idx = prev.findIndex((r) => r.persona_id === id)
          if (idx < 0) return [row, ...prev]
          const next = [...prev]
          next[idx] = row
          return next
        })
        return row
      } catch (e: unknown) {
        onError(formatSupabaseUnknownError(e, 'Failed to refresh persona'))
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
        case 'name':
          return dir * (a.persona_name ?? '').localeCompare(b.persona_name ?? '')
        case 'segment':
          return dir * (a.segment ?? a.target_segment).localeCompare(b.segment ?? b.target_segment)
        case 'status':
          return dir * a.status.localeCompare(b.status)
        case 'run':
          return dir * (a.run_metadata?.run_status ?? '').localeCompare(b.run_metadata?.run_status ?? '')
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
      setSortAsc(key === 'name' || key === 'segment')
    }
  }

  async function handleStartRun(rerunId?: string) {
    const target = newSegment.trim()
    if (!target) {
      onError('Enter a target demographic or segment')
      return
    }
    if (!authUserEmail) {
      onError('Sign in with Supabase Auth to save personas')
      return
    }
    setStartingRun(true)
    onError(null)
    try {
      const { persona_id } = await startPersonaRun({
        target_segment: target,
        persona_id: rerunId,
      })
      onNotice('Persona run started — retrieval in progress…')
      setNewSegment('')
      setView('detail')
      setSelectedId(persona_id)
      await loadLibrary()
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : 'Failed to start run')
    } finally {
      setStartingRun(false)
    }
  }

  async function handleApproveReject(status: PersonaWorkflowStatus) {
    if (!selected) return
    setActionLoading(true)
    onError(null)
    try {
      await updatePersonaWorkflowStatus(selected.persona_id, status)
      onNotice(status === 'approved' ? 'Persona approved' : 'Persona rejected')
      await refreshSelected(selected.persona_id)
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
      await savePersonaContent(
        selected.persona_id,
        draftContent,
        draftContent.persona_name ?? selected.persona_name,
        draftContent.segment ?? selected.segment,
      )
      onNotice('Persona saved')
      setEditing(false)
      await refreshSelected(selected.persona_id)
      await loadLibrary()
    } catch (e: unknown) {
      onError(formatSupabaseUnknownError(e, 'Save failed'))
    } finally {
      setActionLoading(false)
    }
  }

  async function handleDuplicate(row: PersonaRow) {
    setActionLoading(true)
    onError(null)
    try {
      const copy = await duplicatePersonaRow(row)
      onNotice('Persona duplicated')
      await loadLibrary()
      setSelectedId(copy.persona_id)
      setView('detail')
    } catch (e: unknown) {
      onError(formatSupabaseUnknownError(e, 'Duplicate failed'))
    } finally {
      setActionLoading(false)
    }
  }

  async function handleDelete(row: PersonaRow) {
    const label = row.persona_name || row.target_segment || row.persona_id
    if (
      !window.confirm(
        `Delete persona "${label}"? This cannot be undone.`,
      )
    ) {
      return
    }
    if (!authUserEmail) {
      onError('Sign in with Supabase Auth to delete personas')
      return
    }
    setActionLoading(true)
    onError(null)
    try {
      await deletePersona(row.persona_id)
      if (selectedId === row.persona_id) {
        setSelectedId(null)
        setSelected(null)
        setView('library')
        setEditing(false)
      }
      onNotice('Persona deleted')
      await loadLibrary()
    } catch (e: unknown) {
      onError(formatSupabaseUnknownError(e, 'Delete failed'))
    } finally {
      setActionLoading(false)
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
          <h2 className="text-lg font-semibold text-ink-900">New persona run</h2>
          <p className="mt-2 text-sm text-slate-600">
            Describe the buyer segment to research. The agent runs Perplexity retrieval, then Claude
            synthesis. Saves as draft when complete.
          </p>
          <label className="mt-4 block">
            <span className="text-xs font-semibold text-slate-600">Target segment</span>
            <textarea
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              rows={3}
              value={newSegment}
              onChange={(e) => setNewSegment(e.target.value)}
              placeholder="e.g. primary buyer for kitchen / non-toxic products"
            />
          </label>
          <button
            type="button"
            disabled={startingRun || !authUserEmail}
            className="mt-4 rounded-xl bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-700 disabled:opacity-60"
            onClick={() => void handleStartRun()}
          >
            {startingRun ? 'Starting…' : 'Run persona agent'}
          </button>
          {!authUserEmail ? (
            <p className="mt-2 text-xs text-amber-800">Sign in with Supabase Auth to persist results.</p>
          ) : null}
        </div>
      </div>
    )
  }

  async function handleExportPdf() {
    if (!selected) return
    setExportingPdf(true)
    onError(null)
    try {
      const name =
        selected.persona_name ??
        formatPersonaDisplayName(selected.persona_content ?? {}) ??
        undefined
      await downloadPersonaPdf(selected.persona_id, personaExportFilename(name))
      onNotice('PDF downloaded')
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : 'PDF export failed')
    } finally {
      setExportingPdf(false)
    }
  }

  if (view === 'detail' && selected) {
    const content = editing ? draftContent : (selected.persona_content ?? {})
    const runStatus = selected.run_metadata?.run_status
    const displayRow: PersonaRow = editing
      ? { ...selected, persona_content: draftContent }
      : selected

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
          <span className="text-xs text-slate-500">
            Updated {formatDate(selected.updated_at)}
          </span>
        </div>

        {editing ? (
          <label className="mt-3 block max-w-2xl">
            <span className="text-xs font-semibold text-slate-600">One-line summary (header)</span>
            <input
              type="text"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={draftContent.summary_one_liner ?? ''}
              onChange={(e) =>
                setDraftContent((prev) => ({ ...prev, summary_one_liner: e.target.value }))
              }
              placeholder="Short single sentence for the top of the profile"
            />
          </label>
        ) : null}

        <div className="mt-4 flex flex-wrap items-start justify-end gap-2">
          <div className="flex flex-wrap gap-2">
            {editing ? (
              <>
                <button
                  type="button"
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                  onClick={() => {
                    setEditing(false)
                    setDraftContent(selected.persona_content ?? {})
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
                    setDraftContent({ ...(selected.persona_content ?? {}) })
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
                    setNewSegment(selected.target_segment)
                    void handleStartRun(selected.persona_id)
                  }}
                >
                  Re-run
                </button>
              </>
            )}
          </div>
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
          <PersonaProfileBody
            row={displayRow}
            content={content}
            editing={editing}
            onFieldChange={(key, value) =>
              setDraftContent((prev) => ({ ...prev, [key]: value }))
            }
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
          <h2 className="text-lg font-semibold text-ink-900">Personas</h2>
          <p className="text-sm text-slate-600">
            Standalone buyer research — not connected to the product scoring pipeline.
          </p>
        </div>
        <button
          type="button"
          className="rounded-xl bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-700"
          onClick={() => setView('new')}
        >
          New persona
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
                    ['name', 'Name'],
                    ['segment', 'Segment'],
                    ['status', 'Status'],
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
                    No personas yet. Click New persona to run the agent.
                  </td>
                </tr>
              ) : (
                sortedRows.map((row) => (
                  <tr key={row.persona_id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-3 font-medium text-ink-900">
                      {row.persona_name || '(unnamed)'}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{row.segment || row.target_segment}</td>
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
                            setSelectedId(row.persona_id)
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
                            setNewSegment(row.target_segment)
                            void handleStartRun(row.persona_id)
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
