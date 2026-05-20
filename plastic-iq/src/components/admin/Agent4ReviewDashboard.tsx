import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatSupabaseUnknownError } from '../../lib/supabaseClient'
import {
  approveProductQa,
  canRunAgent4,
  fetchAgent4Dashboard,
  humanizeAgentStatus,
  rejectProductQa,
  runAgent4Batch,
  runAgent4Remote,
} from '../../lib/agent4Review'
import { colorForTier } from '../../lib/score'
import type { ProductTier } from '../../types'
import type {
  Agent4DashboardData,
  ProductPipelineRow,
  ProductQaChecks,
  ProductQaRow,
  ProductScoreRow,
  QaCheckStatus,
  QaFlag,
} from '../../types/agent'

type Props = {
  authUserEmail: string | null
  onNotice: (message: string | null) => void
  onError: (message: string | null) => void
}

type ListFilter = 'review' | 'run' | 'history'

const CHECK_META: Array<{
  key: keyof ProductQaChecks
  title: string
}> = [
  { key: 'certification_audit', title: 'Certification audit' },
  { key: 'layer_4a_audit', title: 'Layer 4A audit' },
  { key: 'score_sanity', title: 'Score sanity' },
  { key: 'evidence_gaps', title: 'Evidence gaps' },
  { key: 'explanation_accuracy', title: 'Explanation accuracy' },
]

export function Agent4ReviewDashboard({ authUserEmail, onNotice, onError }: Props) {
  const [data, setData] = useState<Agent4DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [listFilter, setListFilter] = useState<ListFilter>('review')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState(false)
  const [rejectNotes, setRejectNotes] = useState('')
  const [selectedRunIds, setSelectedRunIds] = useState<Set<string>>(() => new Set())
  const [batchProgress, setBatchProgress] = useState<{
    current: number
    total: number
    name: string
  } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    onError(null)
    try {
      const dashboard = await fetchAgent4Dashboard()
      setData(dashboard)
    } catch (e: unknown) {
      setData(null)
      onError(formatSupabaseUnknownError(e, 'Failed to load Agent 4 dashboard'))
    } finally {
      setLoading(false)
    }
  }, [onError])

  useEffect(() => {
    load()
  }, [load])

  const reviewQueue = useMemo(() => data?.pendingReview.map((x) => x.product) ?? [], [data])
  const runnableProducts = useMemo(() => data?.runnable ?? [], [data])
  const historyProducts = useMemo(() => data?.withQaHistory ?? [], [data])

  const selectedRunnable = useMemo(() => {
    if (!data) return []
    return runnableProducts.filter((p) => selectedRunIds.has(p.product_id))
  }, [data, runnableProducts, selectedRunIds])

  const batchBusy = batchProgress !== null

  const listProducts = useMemo(() => {
    if (!data) return []
    if (listFilter === 'review') return reviewQueue
    if (listFilter === 'run') return runnableProducts
    return historyProducts
  }, [data, listFilter, reviewQueue, runnableProducts, historyProducts])

  const selectedReviewItem = useMemo(() => {
    if (!data || !selectedId) return null
    return data.pendingReview.find((x) => x.product.product_id === selectedId) ?? null
  }, [data, selectedId])

  const selectedHistoryView = useMemo(() => {
    if (!data || !selectedId || listFilter !== 'history') return null
    const product = data.products.find((p) => p.product_id === selectedId)
    if (!product) return null
    const qa = data.latestQaByProductId[selectedId]
    if (!qa) return { product, qa: null, score: null, readOnly: true, reviewLabel: null }
    const score =
      data.scoreById[qa.score_id] ??
      data.approvedScoreByProductId[selectedId] ??
      null
    return {
      product,
      qa,
      score,
      readOnly: true,
      reviewLabel:
        qa.review_status === 'approved'
          ? 'Approved'
          : qa.review_status === 'rejected'
            ? 'Rejected'
            : qa.review_status,
    }
  }, [data, selectedId, listFilter])

  const selectedProduct = useMemo(() => {
    if (!data || !selectedId) return null
    return data.products.find((p) => p.product_id === selectedId) ?? null
  }, [data, selectedId])

  const qaMetaByProductId = useMemo(() => {
    const map = new Map<string, { overall: string; flagged: number }>()
    if (!data) return map
    for (const item of data.pendingReview) {
      const flagged = countFlaggedChecks(item.qa.checks)
      map.set(item.product.product_id, {
        overall: item.qa.overall_status,
        flagged,
      })
    }
    for (const p of data.withQaHistory) {
      if (map.has(p.product_id)) continue
      const qa = data.latestQaByProductId[p.product_id]
      if (qa) {
        map.set(p.product_id, {
          overall: qa.overall_status,
          flagged: countFlaggedChecks(qa.checks),
        })
      }
    }
    return map
  }, [data])

  useEffect(() => {
    if (!data || selectedId) return
    if (listFilter === 'review' && reviewQueue.length > 0) {
      setSelectedId(reviewQueue[0].product_id)
    }
  }, [data, listFilter, reviewQueue, selectedId])

  function switchListFilter(filter: ListFilter) {
    setListFilter(filter)
    setRejecting(false)
    setRejectNotes('')
    if (filter === 'run') {
      setSelectedId(null)
    } else if (filter === 'review' && reviewQueue.length > 0) {
      setSelectedId(reviewQueue[0].product_id)
    } else {
      setSelectedId(null)
    }
  }

  function toggleRunSelection(productId: string) {
    setSelectedRunIds((prev) => {
      const next = new Set(prev)
      if (next.has(productId)) next.delete(productId)
      else next.add(productId)
      return next
    })
  }

  function selectAllRunnable() {
    setSelectedRunIds(new Set(runnableProducts.map((p) => p.product_id)))
  }

  function clearRunSelection() {
    setSelectedRunIds(new Set())
  }

  async function handleRunBatch() {
    if (selectedRunnable.length === 0) {
      onError('Select at least one product to run.')
      return
    }
    onError(null)
    onNotice(null)
    setBatchProgress({ current: 0, total: selectedRunnable.length, name: '' })

    try {
      const results = await runAgent4Batch(selectedRunnable, (current, total, name) => {
        setBatchProgress({ current, total, name })
      })
      const succeeded = results.filter((r) => r.ok).length
      const failed = results.length - succeeded
      onNotice(`Agent 4 batch: ${succeeded} completed, ${failed} failed or skipped.`)
      setSelectedRunIds(new Set())
      setListFilter('review')
      await load()
      const firstOk = results.find((r) => r.ok)
      if (firstOk) setSelectedId(firstOk.productId)
    } catch (e: unknown) {
      onError(formatSupabaseUnknownError(e, 'Batch run failed'))
    } finally {
      setBatchProgress(null)
    }
  }

  async function handleRun(productId: string) {
    onError(null)
    onNotice(null)
    setBusyId(productId)
    try {
      const outcome = await runAgent4Remote(productId, { replaceExisting: true })
      if (!outcome.ok) {
        onError(outcome.message ?? 'Agent 4 run failed')
        return
      }
      onNotice(outcome.message ?? 'QA complete — awaiting review.')
      await load()
      setListFilter('review')
      setSelectedId(productId)
    } catch (e: unknown) {
      onError(formatSupabaseUnknownError(e, 'Agent 4 run failed'))
    } finally {
      setBusyId(null)
    }
  }

  async function handleApprove() {
    if (!selectedReviewItem || !authUserEmail) {
      onError('Sign in with Supabase Auth before approving QA reports.')
      return
    }
    setBusyId(selectedReviewItem.product.product_id)
    onError(null)
    try {
      await approveProductQa(
        selectedReviewItem.qa.qa_id,
        selectedReviewItem.product.product_id,
        authUserEmail,
      )
      onNotice('QA report approved.')
      await load()
      setSelectedId(null)
    } catch (e: unknown) {
      onError(formatSupabaseUnknownError(e, 'Approve failed'))
    } finally {
      setBusyId(null)
    }
  }

  async function handleReject() {
    if (!selectedReviewItem || !authUserEmail) return
    if (!rejectNotes.trim()) {
      onError('Add rejection notes before rejecting.')
      return
    }
    setBusyId(selectedReviewItem.product.product_id)
    onError(null)
    try {
      await rejectProductQa(
        selectedReviewItem.qa.qa_id,
        selectedReviewItem.product.product_id,
        rejectNotes,
        authUserEmail,
      )
      onNotice('QA report rejected.')
      setRejecting(false)
      setRejectNotes('')
      await load()
      setSelectedId(null)
    } catch (e: unknown) {
      onError(formatSupabaseUnknownError(e, 'Reject failed'))
    } finally {
      setBusyId(null)
    }
  }

  if (loading && !data) {
    return <p className="mt-6 text-sm text-slate-600">Loading Agent 4 dashboard…</p>
  }

  if (!data) {
    return (
      <p className="mt-6 text-sm text-slate-600">
        Could not load Agent 4 dashboard. Check the error above and click Refresh.
      </p>
    )
  }

  return (
    <div className="mt-6 space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-ink-900">Agent 4 — QA Review</h2>
            <p className="mt-1 text-sm text-slate-600">
              {reviewQueue.length} awaiting review · {runnableProducts.length} ready to run ·{' '}
              {historyProducts.length} with QA history
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
      </section>

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-card">
            <div className="space-y-3 border-b border-slate-100 p-3">
              <div className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
                {(
                  [
                    ['review', `Awaiting review (${reviewQueue.length})`],
                    ['run', `Run Agent 4 (${runnableProducts.length})`],
                    ['history', `All with QA (${historyProducts.length})`],
                  ] as const
                ).map(([filter, label]) => (
                  <button
                    key={filter}
                    type="button"
                    className={`rounded-lg px-2 py-1.5 text-xs font-semibold ${
                      listFilter === filter ? 'bg-white text-ink-900 shadow-sm' : 'text-slate-600'
                    }`}
                    onClick={() => switchListFilter(filter)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {listFilter === 'run' ? (
                <div className="space-y-2">
                  <p className="text-[11px] leading-relaxed text-slate-600">
                    Products need an approved (or pending) score. Runs use replace if a QA report
                    already exists for that score.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={batchBusy || runnableProducts.length === 0}
                      onClick={selectAllRunnable}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Select all ({runnableProducts.length})
                    </button>
                    <button
                      type="button"
                      disabled={batchBusy || selectedRunIds.size === 0}
                      onClick={clearRunSelection}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Clear
                    </button>
                  </div>
                  <button
                    type="button"
                    disabled={batchBusy || selectedRunnable.length === 0}
                    onClick={handleRunBatch}
                    className="w-full rounded-xl bg-ink-900 px-3 py-2 text-xs font-semibold text-white hover:bg-ink-700 disabled:opacity-60"
                  >
                    {batchBusy
                      ? batchProgress
                        ? `Running ${batchProgress.current}/${batchProgress.total}: ${batchProgress.name}`
                        : 'Running…'
                      : `Run Agent 4 on selected (${selectedRunnable.length})`}
                  </button>
                </div>
              ) : null}
            </div>
            <ul className="max-h-[60dvh] divide-y divide-slate-100 overflow-auto">
              {listProducts.length === 0 ? (
                <li className="p-4 text-sm text-slate-600">
                  {listFilter === 'review'
                    ? 'Nothing awaiting QA review. Run Agent 4 from the Run tab.'
                    : listFilter === 'run'
                      ? 'Nothing ready — approve Agent 3 scores first.'
                      : 'No QA reports yet.'}
                </li>
              ) : (
                listProducts.map((p) => {
                  const isSelected = p.product_id === selectedId
                  const meta = qaMetaByProductId.get(p.product_id)
                  const runnable = canRunAgent4(p.agent_status)
                  const checked = selectedRunIds.has(p.product_id)
                  return (
                    <li key={p.product_id}>
                      <div
                        className={`flex w-full transition ${
                          isSelected ? 'bg-amber-50' : 'hover:bg-slate-50'
                        }`}
                      >
                        {listFilter === 'run' && runnable ? (
                          <label className="flex shrink-0 cursor-pointer items-start px-3 pt-4">
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={batchBusy}
                              onChange={() => toggleRunSelection(p.product_id)}
                              className="mt-0.5 h-4 w-4 rounded border-slate-300"
                            />
                          </label>
                        ) : null}
                        <button
                          type="button"
                          disabled={batchBusy}
                          onClick={() => {
                            setSelectedId(p.product_id)
                            setRejecting(false)
                          }}
                          className="min-w-0 flex-1 px-4 py-3 text-left disabled:opacity-60"
                        >
                          <div className="font-semibold text-ink-900">{p.product_name}</div>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <StatusPill status={p.agent_status} />
                            {meta ? (
                              <OverallQaBadge overall={meta.overall} flagged={meta.flagged} />
                            ) : listFilter === 'run' ? (
                              <span className="text-[10px] font-semibold text-emerald-800">
                                Ready to run
                              </span>
                            ) : null}
                          </div>
                        </button>
                      </div>
                    </li>
                  )
                })
              )}
            </ul>
          </div>
        </div>

        <div className="lg:col-span-8">
          {listFilter === 'run' ? (
            <Agent4RunTabPanel
              selectedProduct={selectedProduct}
              selectedRunnable={selectedRunnable}
              runnableCount={runnableProducts.length}
              batchProgress={batchProgress}
              busyId={busyId}
              onRunSingle={handleRun}
            />
          ) : selectedReviewItem ? (
            <QaReviewPanel
              product={selectedReviewItem.product}
              qa={selectedReviewItem.qa}
              score={selectedReviewItem.score}
              busy={busyId === selectedReviewItem.product.product_id}
              rejecting={rejecting}
              rejectNotes={rejectNotes}
              onRejectNotesChange={setRejectNotes}
              onApprove={handleApprove}
              onRejectOpen={() => setRejecting(true)}
              onRejectCancel={() => {
                setRejecting(false)
                setRejectNotes('')
              }}
              onRejectConfirm={handleReject}
            />
          ) : selectedHistoryView?.qa ? (
            <QaReviewPanel
              product={selectedHistoryView.product}
              qa={selectedHistoryView.qa}
              score={selectedHistoryView.score}
              readOnly
              reviewLabel={selectedHistoryView.reviewLabel ?? undefined}
              busy={false}
              rejecting={false}
              rejectNotes=""
              onRejectNotesChange={() => {}}
              onApprove={() => {}}
              onRejectOpen={() => {}}
              onRejectCancel={() => {}}
              onRejectConfirm={() => {}}
            />
          ) : (
            <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-600">
              Select a product to review QA or run Agent 4.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function countFlaggedChecks(checks: ProductQaChecks): number {
  return CHECK_META.filter(({ key }) => checks[key]?.status === 'flag').length
}

function Agent4RunTabPanel({
  selectedProduct,
  selectedRunnable,
  runnableCount,
  batchProgress,
  busyId,
  onRunSingle,
}: {
  selectedProduct: ProductPipelineRow | null
  selectedRunnable: ProductPipelineRow[]
  runnableCount: number
  batchProgress: { current: number; total: number; name: string } | null
  busyId: string | null
  onRunSingle: (productId: string) => void
}) {
  if (batchProgress) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-card">
        <p className="text-sm font-semibold text-ink-900">Running Agent 4</p>
        <p className="mt-2 text-sm text-slate-600">
          {batchProgress.current} of {batchProgress.total}
          {batchProgress.name ? `: ${batchProgress.name}` : ''}
        </p>
        <p className="mt-4 max-w-md text-xs text-slate-500">
          QA runs locally via the dev API. Leave this tab open until the batch finishes.
        </p>
      </div>
    )
  }

  if (selectedProduct && canRunAgent4(selectedProduct.agent_status)) {
    const busy = busyId === selectedProduct.product_id
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
        <h3 className="text-lg font-semibold text-ink-900">{selectedProduct.product_name}</h3>
        <p className="mt-2 text-sm text-slate-600">
          {selectedProduct.brand ?? '—'} · {selectedProduct.category ?? '—'}
          {selectedProduct.subcategory ? ` · ${selectedProduct.subcategory}` : ''}
        </p>
        <p className="mt-4 text-sm text-slate-600">
          Run a read-only QA audit on the approved evidence → normalization → score chain. Results
          appear on <strong>Awaiting review</strong>.
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => onRunSingle(selectedProduct.product_id)}
          className="mt-6 rounded-xl bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-700 disabled:opacity-60"
        >
          {busy ? 'Running…' : 'Run Agent 4 on this product'}
        </button>
      </div>
    )
  }

  if (selectedRunnable.length > 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
        <h3 className="text-lg font-semibold text-ink-900">Batch ready</h3>
        <p className="mt-2 text-sm text-slate-600">
          {selectedRunnable.length} product(s) selected. Use{' '}
          <strong>Run Agent 4 on selected</strong> in the left panel, or select all {runnableCount}{' '}
          and run the full catalog.
        </p>
      </div>
    )
  }

  return (
    <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center shadow-card">
      <div className="max-w-sm space-y-2">
        <p className="text-sm font-semibold text-ink-900">Run Agent 4 on products</p>
        <p className="text-sm text-slate-600">
          Check products on the left (or Select all), then run QA in batch. Review results on{' '}
          <strong>Awaiting review</strong>.
        </p>
      </div>
    </div>
  )
}

function QaReviewPanel({
  product,
  qa,
  score,
  readOnly = false,
  reviewLabel,
  busy,
  rejecting,
  rejectNotes,
  onRejectNotesChange,
  onApprove,
  onRejectOpen,
  onRejectCancel,
  onRejectConfirm,
}: {
  product: ProductPipelineRow
  qa: ProductQaRow
  score: ProductScoreRow | null
  readOnly?: boolean
  reviewLabel?: string
  busy: boolean
  rejecting: boolean
  rejectNotes: string
  onRejectNotesChange: (v: string) => void
  onApprove: () => void
  onRejectOpen: () => void
  onRejectCancel: () => void
  onRejectConfirm: () => void
}) {
  const tierStyles = score ? colorForTier(score.tier as ProductTier) : null
  const flaggedCount = countFlaggedChecks(qa.checks)

  return (
    <article className="max-h-[75dvh] overflow-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-card md:p-6">
      <header className="border-b border-slate-100 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="text-lg font-semibold text-ink-900">{product.product_name}</h3>
          <div className="flex flex-wrap gap-2">
            <OverallQaBadge overall={qa.overall_status} flagged={flaggedCount} large />
            {readOnly && reviewLabel ? (
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                  reviewLabel === 'Approved'
                    ? 'bg-emerald-100 text-emerald-900'
                    : reviewLabel === 'Rejected'
                      ? 'bg-red-100 text-red-900'
                      : 'bg-slate-100 text-slate-700'
                }`}
              >
                {reviewLabel}
              </span>
            ) : null}
          </div>
        </div>
        <p className="mt-1 text-sm text-slate-600">
          {product.brand ?? '—'} · {product.category ?? '—'}
          {product.subcategory ? ` · ${product.subcategory}` : ''}
        </p>
        <p className="mt-2 text-xs text-slate-500">
          {humanizeAgentStatus(product.agent_status)} · QA run{' '}
          {new Date(qa.run_timestamp).toLocaleString()}
        </p>
        {!readOnly ? (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {qa.overall_status === 'pass'
              ? 'All checks passed — human approval still required before publish.'
              : `${flaggedCount} check(s) flagged — review flags below before approving.`}
          </p>
        ) : null}
      </header>

      {score ? (
        <section className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">PAC score</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-ink-900">
              {score.pac_safety_score}
            </p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tier</p>
            <p className={`mt-1 text-lg font-semibold ${tierStyles?.text ?? 'text-ink-900'}`}>
              {score.tier}
            </p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Range</p>
            <p className="mt-1 text-sm font-semibold text-ink-900">
              {score.displayed_confidence_range ?? '—'}
            </p>
          </div>
        </section>
      ) : null}

      <details className="mt-4 rounded-xl border border-slate-100 bg-slate-50/50 p-3 text-xs">
        <summary className="cursor-pointer font-semibold text-slate-700">Audit trail IDs</summary>
        <ul className="mt-2 space-y-1 font-mono text-[11px] text-slate-600">
          <li>qa_id: {qa.qa_id}</li>
          <li>score_id: {qa.score_id}</li>
          <li>input_id: {qa.input_id}</li>
          <li>evidence_id: {qa.evidence_id}</li>
        </ul>
      </details>

      <section className="mt-6 space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Five QA checks
        </h4>
        {CHECK_META.map(({ key, title }) => (
          <CheckCard key={key} title={title} check={qa.checks[key]} qa={qa} checkKey={key} />
        ))}
      </section>

      {score?.explanation_draft ? (
        <section className="mt-6">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Explanation draft (audited)
          </h4>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">{score.explanation_draft}</p>
        </section>
      ) : null}

      {qa.certifications_verified?.length ? (
        <section className="mt-6">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Certifications verified (QA output)
          </h4>
          <ul className="mt-2 space-y-1 text-sm text-slate-700">
            {qa.certifications_verified.map((c, i) => (
              <li key={`${c.certification_name}-${i}`}>
                {c.certification_name}
                {c.source_url ? (
                  <span className="text-xs text-slate-500"> — {c.source_url}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!readOnly && rejecting ? (
        <div className="mt-6 rounded-xl border-2 border-red-300 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-900">Reject QA report</p>
          <textarea
            value={rejectNotes}
            onChange={(e) => onRejectNotesChange(e.target.value)}
            rows={4}
            placeholder="Why is this QA report rejected?"
            className="mt-2 w-full rounded-xl border border-red-200 bg-white px-3 py-2 text-sm"
          />
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={onRejectConfirm}
              className="rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white"
            >
              Confirm reject
            </button>
            <button type="button" onClick={onRejectCancel} className="rounded-xl border px-4 py-2 text-sm">
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {!readOnly ? (
        <footer className="sticky bottom-0 mt-6 flex gap-2 border-t border-slate-100 bg-white pt-4">
          <button
            type="button"
            disabled={busy}
            onClick={onApprove}
            className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            Approve QA report
          </button>
          <button
            type="button"
            disabled={busy || rejecting}
            onClick={onRejectOpen}
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-800"
          >
            Reject
          </button>
        </footer>
      ) : null}
    </article>
  )
}

function CheckCard({
  title,
  check,
  qa,
  checkKey,
}: {
  title: string
  check: ProductQaChecks[keyof ProductQaChecks]
  qa: ProductQaRow
  checkKey: keyof ProductQaChecks
}) {
  if (!check) return null
  const summary = checkSummary(checkKey, check, qa)

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h5 className="text-sm font-semibold text-ink-900">{title}</h5>
        <CheckStatusChip status={check.status} />
      </div>
      {summary ? <p className="mt-1 text-xs text-slate-600">{summary}</p> : null}
      {check.flags?.length ? (
        <ul className="mt-3 space-y-2">
          {check.flags.map((flag, i) => (
            <FlagRow key={`${flag.code}-${i}`} flag={flag} />
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-slate-500">No flags.</p>
      )}
      {checkKey === 'certification_audit' &&
      'certifications_verified' in check &&
      check.certifications_verified?.length ? (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <p className="text-[11px] font-semibold text-emerald-800">Verified on product page</p>
          <ul className="mt-1 space-y-1 text-xs text-slate-700">
            {check.certifications_verified.map((c, i) => (
              <li key={i}>· {c.certification_name}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

function checkSummary(
  key: keyof ProductQaChecks,
  check: ProductQaChecks[keyof ProductQaChecks],
  qa: ProductQaRow,
): string {
  if (key === 'certification_audit' && 'audited_claim_count' in check) {
    const verified =
      check.certifications_verified?.length ?? qa.certifications_verified?.length ?? 0
    return `${check.audited_claim_count} claim(s) audited · ${verified} verified on product page`
  }
  if (key === 'layer_4a_audit' && 'positives_audited' in check) {
    return `${check.positives_audited} positive · ${check.negatives_audited} negative · net ${check.net_adjustment_reported} (recomputed ${check.net_adjustment_recomputed})`
  }
  if (key === 'score_sanity' && 'peer_count' in check) {
    if (check.status === 'skip') {
      return check.skip_reason === 'insufficient_peers'
        ? 'Skipped — fewer than 2 peer scores in subcategory'
        : 'Skipped'
    }
    if (check.peer_median != null && check.delta_from_median != null) {
      return `Score ${check.product_score} vs peer median ${check.peer_median} (Δ${Math.round(check.delta_from_median)}, ${check.peer_count} peers)`
    }
    return `Score ${check.product_score}`
  }
  if (key === 'evidence_gaps' && 'primary_contact_components' in check) {
    const n = check.primary_contact_components?.length ?? 0
    const flags = check.flags?.length ?? 0
    return `${n} primary contact component(s) · ${flags} gap(s) flagged`
  }
  if (key === 'explanation_accuracy' && 'issues' in check) {
    return check.issues?.length
      ? `${check.issues.length} issue(s): ${check.issues.join(', ')}`
      : 'No issues detected'
  }
  return ''
}

function FlagRow({ flag }: { flag: QaFlag }) {
  const severity =
    flag.severity === 'info'
      ? 'bg-slate-100 text-slate-700'
      : flag.severity === 'critical'
        ? 'bg-red-100 text-red-900'
        : 'bg-amber-100 text-amber-900'

  return (
    <li className="rounded-lg border border-slate-100 bg-slate-50/80 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <code className="text-[11px] font-semibold text-ink-900">{flag.code}</code>
        {flag.severity ? (
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${severity}`}>
            {flag.severity}
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-slate-700">{flag.message}</p>
      {flag.context && Object.keys(flag.context).length > 0 ? (
        <details className="mt-2">
          <summary className="cursor-pointer text-[11px] font-semibold text-slate-500">Context</summary>
          <pre className="mt-1 overflow-auto rounded bg-white p-2 text-[10px] text-slate-600">
            {JSON.stringify(flag.context, null, 2)}
          </pre>
        </details>
      ) : null}
    </li>
  )
}

function CheckStatusChip({ status }: { status: QaCheckStatus }) {
  const styles =
    status === 'pass'
      ? 'bg-emerald-100 text-emerald-900'
      : status === 'flag'
        ? 'bg-amber-100 text-amber-900'
        : status === 'skip'
          ? 'bg-slate-100 text-slate-600'
          : 'bg-red-100 text-red-900'

  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${styles}`}>
      {status}
    </span>
  )
}

function OverallQaBadge({
  overall,
  flagged,
  large,
}: {
  overall: string
  flagged: number
  large?: boolean
}) {
  const styles =
    overall === 'pass'
      ? 'bg-emerald-100 text-emerald-900'
      : overall === 'flag'
        ? 'bg-amber-100 text-amber-900'
        : 'bg-red-100 text-red-900'

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold ${styles} ${
        large ? 'px-3 py-1 text-xs' : 'px-2 py-0.5 text-[10px]'
      }`}
    >
      {overall.toUpperCase()}
      {flagged > 0 ? <span className="opacity-80">· {flagged}/5 flagged</span> : null}
    </span>
  )
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === 'qa_awaiting_review'
      ? 'bg-amber-100 text-amber-900'
      : status === 'qa_approved'
        ? 'bg-emerald-100 text-emerald-900'
        : status === 'scoring_approved'
          ? 'bg-violet-100 text-violet-900'
          : 'bg-slate-100 text-slate-700'

  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${tone}`}>
      {humanizeAgentStatus(status)}
    </span>
  )
}
