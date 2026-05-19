import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatSupabaseUnknownError } from '../../lib/supabaseClient'
import {
  approveProductScore,
  canRunAgent3,
  fetchAgent3Dashboard,
  humanizeAgentStatus,
  rejectProductScore,
  runAgent3Batch,
  runAgent3Remote,
} from '../../lib/agent3Review'
import { colorForTier } from '../../lib/score'
import type { ProductTier } from '../../types'
import type {
  Agent3DashboardData,
  NormalizationLayer4a,
  ProductPipelineRow,
  ProductScoreRow,
} from '../../types/agent'
import { Layer4aBreakdown } from './Layer4aBreakdown'

type Props = {
  authUserEmail: string | null
  onNotice: (message: string | null) => void
  onError: (message: string | null) => void
}

export function Agent3ReviewDashboard({ authUserEmail, onNotice, onError }: Props) {
  const [data, setData] = useState<Agent3DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [listFilter, setListFilter] = useState<'review' | 'run' | 'all'>('review')
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
      const dashboard = await fetchAgent3Dashboard()
      setData(dashboard)
    } catch (e: unknown) {
      setData(null)
      onError(formatSupabaseUnknownError(e, 'Failed to load Agent 3 dashboard'))
    } finally {
      setLoading(false)
    }
  }, [onError])

  useEffect(() => {
    load()
  }, [load])

  const reviewQueue = useMemo(
    () => data?.pendingReview.map((x) => x.product) ?? [],
    [data],
  )

  const runnableProducts = useMemo(() => data?.runnable ?? [], [data])

  const selectedRunnable = useMemo(() => {
    if (!data) return []
    return runnableProducts.filter((p) => selectedRunIds.has(p.product_id))
  }, [data, runnableProducts, selectedRunIds])

  const batchBusy = batchProgress !== null

  const listProducts = useMemo(() => {
    if (!data) return []
    if (listFilter === 'review') return reviewQueue
    if (listFilter === 'run') return runnableProducts
    return data.products
  }, [data, listFilter, reviewQueue, runnableProducts])

  const selectedItem = useMemo(() => {
    if (!data || !selectedId) return null
    return data.pendingReview.find((x) => x.product.product_id === selectedId) ?? null
  }, [data, selectedId])

  const selectedScoreView = useMemo(() => {
    if (!data || !selectedId) return null
    const pending = data.pendingReview.find((x) => x.product.product_id === selectedId)
    if (pending) {
      return { product: pending.product, productScore: pending.productScore, readOnly: false }
    }
    const product = data.products.find((p) => p.product_id === selectedId)
    if (!product) return null
    const approved = data.approvedByProductId[selectedId]
    if (approved) {
      return { product, productScore: approved, readOnly: true, reviewLabel: 'Approved' }
    }
    const latest = data.latestScoreByProductId[selectedId]
    if (latest) {
      const label =
        latest.review_status === 'rejected'
          ? 'Rejected'
          : latest.review_status === 'superseded'
            ? 'Superseded'
            : latest.review_status
      return { product, productScore: latest, readOnly: true, reviewLabel: label }
    }
    return { product, productScore: null, readOnly: true, reviewLabel: null }
  }, [data, selectedId])

  const selectedProduct = useMemo(() => {
    if (!data || !selectedId) return null
    return data.products.find((p) => p.product_id === selectedId) ?? null
  }, [data, selectedId])

  useEffect(() => {
    if (!data || selectedId) return
    if (listFilter === 'review' && reviewQueue.length > 0) {
      setSelectedId(reviewQueue[0].product_id)
    }
  }, [data, listFilter, reviewQueue, selectedId])

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

  function switchListFilter(filter: 'review' | 'run' | 'all') {
    setListFilter(filter)
    setRejecting(false)
    setRejectNotes('')
    if (filter === 'run') {
      setSelectedId(null)
    } else if (filter === 'review' && reviewQueue.length > 0) {
      setSelectedId(reviewQueue[0].product_id)
    } else if (filter === 'all') {
      setSelectedId(null)
    }
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
      const results = await runAgent3Batch(selectedRunnable, (current, total, name) => {
        setBatchProgress({ current, total, name })
      })

      const succeeded = results.filter((r) => r.ok).length
      const failed = results.length - succeeded
      onNotice(`Batch complete: ${succeeded} scored, ${failed} failed or skipped.`)
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
      const outcome = await runAgent3Remote(productId)
      if (!outcome.ok) {
        onError(outcome.message ?? 'Agent 3 run failed')
        return
      }
      onNotice(outcome.message ?? 'Scoring complete — review pending.')
      await load()
      setListFilter('review')
      setSelectedId(productId)
    } catch (e: unknown) {
      onError(formatSupabaseUnknownError(e, 'Agent 3 run failed'))
    } finally {
      setBusyId(null)
    }
  }

  async function handleApprove() {
    if (!selectedItem || !authUserEmail) {
      onError('Sign in with Supabase Auth before approving scores.')
      return
    }
    setBusyId(selectedItem.product.product_id)
    onError(null)
    try {
      await approveProductScore(
        selectedItem.productScore.score_id,
        selectedItem.product.product_id,
        selectedItem.productScore,
        authUserEmail,
      )
      onNotice('Score approved and written to product.')
      await load()
      setSelectedId(null)
    } catch (e: unknown) {
      onError(formatSupabaseUnknownError(e, 'Approve failed'))
    } finally {
      setBusyId(null)
    }
  }

  async function handleReject() {
    if (!selectedItem || !authUserEmail) return
    if (!rejectNotes.trim()) {
      onError('Add rejection notes before rejecting.')
      return
    }
    setBusyId(selectedItem.product.product_id)
    onError(null)
    try {
      await rejectProductScore(
        selectedItem.productScore.score_id,
        selectedItem.product.product_id,
        rejectNotes,
        authUserEmail,
      )
      onNotice('Score rejected.')
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
    return <p className="mt-6 text-sm text-slate-600">Loading Agent 3 dashboard…</p>
  }

  if (!data) {
    return (
      <p className="mt-6 text-sm text-slate-600">
        Could not load Agent 3 dashboard. Check the error above and click Refresh.
      </p>
    )
  }

  return (
    <div className="mt-6 space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-ink-900">Agent 3 — Scoring</h2>
            <p className="mt-1 text-sm text-slate-600">
              {reviewQueue.length} awaiting review · {runnableProducts.length} ready to run · Algorithm
              V2.3.3
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
                {(['review', 'run', 'all'] as const).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    className={`rounded-lg px-2 py-1.5 text-xs font-semibold ${
                      listFilter === filter ? 'bg-white text-ink-900 shadow-sm' : 'text-slate-600'
                    }`}
                    onClick={() => switchListFilter(filter)}
                  >
                    {filter === 'review'
                      ? `Awaiting review (${reviewQueue.length})`
                      : filter === 'run'
                        ? `Run Agent 3 (${runnableProducts.length})`
                        : 'All products'}
                  </button>
                ))}
              </div>
              {listFilter === 'run' ? (
                <div className="space-y-2">
                  <p className="text-[11px] leading-relaxed text-slate-600">
                    Normalization must be approved first. Select products, then run scoring in
                    sequence.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={batchBusy || runnableProducts.length === 0}
                      onClick={selectAllRunnable}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Select all
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
                      : `Run Agent 3 on selected (${selectedRunnable.length})`}
                  </button>
                </div>
              ) : null}
            </div>
            <ul className="max-h-[60dvh] divide-y divide-slate-100 overflow-auto">
              {listProducts.length === 0 ? (
                <li className="p-4 text-sm text-slate-600">
                  {listFilter === 'review'
                    ? 'Nothing awaiting score review.'
                    : listFilter === 'run'
                      ? 'Nothing ready — approve Agent 2 normalization first.'
                      : 'No products found.'}
                </li>
              ) : (
                listProducts.map((p) => {
                  const isSelected = p.product_id === selectedId
                  const runnable = canRunAgent3(p.agent_status)
                  const checked = selectedRunIds.has(p.product_id)
                  return (
                    <li key={p.product_id}>
                      <div
                        className={`flex w-full transition ${
                          isSelected ? 'bg-violet-50' : 'hover:bg-slate-50'
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
                            {runnable ? (
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
            <Agent3RunTabPanel
              selectedProduct={selectedProduct}
              selectedRunnable={selectedRunnable}
              batchProgress={batchProgress}
              busyId={busyId}
              onRunSingle={handleRun}
            />
          ) : selectedScoreView?.productScore ? (
            <ScoreReviewPanel
              product={selectedScoreView.product}
              score={selectedScoreView.productScore}
              layer4a={
                selectedScoreView.productScore.input_id
                  ? data?.layer4aByInputId[selectedScoreView.productScore.input_id]
                  : undefined
              }
              readOnly={selectedScoreView.readOnly}
              reviewLabel={selectedScoreView.reviewLabel ?? undefined}
              busy={busyId === selectedScoreView.product.product_id}
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
          ) : selectedScoreView?.product ? (
            <div className="flex min-h-[320px] flex-col justify-center rounded-2xl border border-slate-200 bg-white p-8 shadow-card">
              <h3 className="text-lg font-semibold text-ink-900">{selectedScoreView.product.product_name}</h3>
              <p className="mt-2 text-sm text-slate-600">
                {humanizeAgentStatus(selectedScoreView.product.agent_status)} — no score on file yet.
                {canRunAgent3(selectedScoreView.product.agent_status)
                  ? ' Run Agent 3 from the Run tab when normalization is approved.'
                  : ' Complete Agent 2 normalization first.'}
              </p>
            </div>
          ) : (
            <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-600">
              Select a product to review scores or run Agent 3.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Agent3RunTabPanel({
  selectedProduct,
  selectedRunnable,
  batchProgress,
  busyId,
  onRunSingle,
}: {
  selectedProduct: ProductPipelineRow | null
  selectedRunnable: ProductPipelineRow[]
  batchProgress: { current: number; total: number; name: string } | null
  busyId: string | null
  onRunSingle: (productId: string) => void
}) {
  if (batchProgress) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-card">
        <p className="text-sm font-semibold text-ink-900">Running Agent 3</p>
        <p className="mt-2 text-sm text-slate-600">
          {batchProgress.current} of {batchProgress.total}
          {batchProgress.name ? `: ${batchProgress.name}` : ''}
        </p>
        <p className="mt-4 max-w-md text-xs text-slate-500">
          Scoring runs locally via the dev API. Leave this tab open until the batch finishes.
        </p>
      </div>
    )
  }

  if (selectedProduct && canRunAgent3(selectedProduct.agent_status)) {
    const busy = busyId === selectedProduct.product_id
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
        <h3 className="text-lg font-semibold text-ink-900">{selectedProduct.product_name}</h3>
        <p className="mt-2 text-sm text-slate-600">
          {selectedProduct.brand ?? '—'} · {selectedProduct.category ?? '—'}
          {selectedProduct.subcategory ? ` · ${selectedProduct.subcategory}` : ''}
        </p>
        <div className="mt-3">
          <StatusPill status={selectedProduct.agent_status} />
        </div>
        <p className="mt-4 text-sm text-slate-700">
          Runs V2.3.3 scoring on the approved normalization packet and saves to{' '}
          <strong>product_scores</strong>. Review under <strong>Awaiting review</strong>.
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => onRunSingle(selectedProduct.product_id)}
          className="mt-4 rounded-xl bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-700 disabled:opacity-60"
        >
          {busy ? 'Running Agent 3…' : 'Run Agent 3 on this product'}
        </button>
      </div>
    )
  }

  if (selectedRunnable.length > 0) {
    return (
      <div className="flex min-h-[320px] flex-col justify-center rounded-2xl border border-slate-200 bg-white p-8 shadow-card">
        <p className="text-sm font-semibold text-ink-900">
          {selectedRunnable.length} product{selectedRunnable.length === 1 ? '' : 's'} selected
        </p>
        <ul className="mt-3 max-h-48 space-y-1 overflow-auto text-sm text-slate-700">
          {selectedRunnable.map((p) => (
            <li key={p.product_id}>· {p.product_name}</li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-slate-600">
          Use <strong>Run Agent 3 on selected</strong> in the left panel to start the batch.
        </p>
      </div>
    )
  }

  return (
    <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center shadow-card">
      <div className="max-w-sm space-y-2">
        <p className="text-sm font-semibold text-ink-900">Run Agent 3 on products</p>
        <p className="text-sm text-slate-600">
          Check products on the left, then run in batch. Score review is on the{' '}
          <strong>Awaiting review</strong> tab.
        </p>
      </div>
    </div>
  )
}

function ScoreReviewPanel({
  product,
  score,
  layer4a,
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
  score: ProductScoreRow
  layer4a?: NormalizationLayer4a
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
  const tierStyles = colorForTier(score.tier as ProductTier)
  const components = score.component_nprs?.components ?? []

  return (
    <article className="max-h-[75dvh] overflow-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-card md:p-6">
      <header className="border-b border-slate-100 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="text-lg font-semibold text-ink-900">{product.product_name}</h3>
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
        <p className="mt-1 text-sm text-slate-600">
          {product.brand ?? '—'} · {product.category ?? '—'}
        </p>
      </header>

      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        <MetricCard label="PAC Safety Score" value={String(score.pac_safety_score)} large />
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tier</p>
          <p className={`mt-1 text-xl font-semibold ${tierStyles.text}`}>{score.tier}</p>
        </div>
        <MetricCard label="Confidence range" value={score.displayed_confidence_range ?? '—'} />
        <MetricCard label="Transparency badge" value={score.transparency_badge ?? '—'} />
        <MetricCard label="Weighted NPR" value={String(score.weighted_npr)} />
        {score.ingredient_transparency_score != null ? (
          <MetricCard label="ITS (formulation)" value={String(score.ingredient_transparency_score)} />
        ) : null}
        {score.escalator_applied ? (
          <MetricCard label="Escalator applied" value={score.escalator_applied} />
        ) : null}
      </section>

      {layer4a ? (
        <Layer4aBreakdown layer4a={layer4a} />
      ) : score.input_id ? (
        <section className="mt-6">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Layer 4A adjustments
          </h4>
          <p className="mt-2 text-sm text-slate-600">
            No normalization packet linked, or Layer 4A not found on scoring_inputs.
          </p>
          <p className="mt-2 text-sm text-slate-700">
            Net from score run: <strong className="tabular-nums">{score.layer_4a_net}</strong>
          </p>
        </section>
      ) : (
        <section className="mt-6">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Layer 4A adjustments
          </h4>
          <p className="mt-2 text-sm text-slate-700">
            Net adjustment: <strong className="tabular-nums">{score.layer_4a_net}</strong>
          </p>
        </section>
      )}

      <section className="mt-6">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Component NPRs</h4>
        <ul className="mt-2 space-y-2">
          {components.map((c, i) => (
            <li
              key={`${c.component_name}-${i}`}
              className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-sm text-slate-700"
            >
              <p className="font-semibold text-ink-900">{String(c.component_name)}</p>
              <p className="mt-1 tabular-nums">
                NPR {Number(c.final_npr).toFixed(4)} · CI {Number(c.contact_intimacy)} · hazard{' '}
                {Number(c.material_hazard)} · migration {Number(c.adjusted_migration_potential)}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {score.explanation_draft ? (
        <section className="mt-6">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Explanation draft
          </h4>
          <p className="mt-2 text-sm text-slate-700">{score.explanation_draft}</p>
        </section>
      ) : null}

      {!readOnly && rejecting ? (
        <div className="mt-6 rounded-xl border-2 border-red-300 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-900">Reject score</p>
          <textarea
            value={rejectNotes}
            onChange={(e) => onRejectNotesChange(e.target.value)}
            rows={4}
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
            Approve score
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

function MetricCard({
  label,
  value,
  large,
}: {
  label: string
  value: string
  large?: boolean
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 font-semibold text-ink-900 ${large ? 'text-3xl tabular-nums' : 'text-sm'}`}>
        {value}
      </p>
    </div>
  )
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === 'scoring_review_pending'
      ? 'bg-violet-100 text-violet-900'
      : status === 'normalization_approved'
        ? 'bg-emerald-100 text-emerald-900'
        : status === 'scoring_approved'
          ? 'bg-emerald-100 text-emerald-900'
          : 'bg-slate-100 text-slate-700'

  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${tone}`}>
      {humanizeAgentStatus(status)}
    </span>
  )
}
