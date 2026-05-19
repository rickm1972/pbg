import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { formatSupabaseUnknownError } from '../../lib/supabaseClient'
import {
  approveNormalization,
  canRunAgent2,
  fetchAgent2Dashboard,
  hasNormalizationRun,
  humanizeAgentStatus,
  NORMALIZATION_PIPELINE_STATUSES,
  rejectNormalization,
  runAgent2Batch,
  runAgent2Remote,
} from '../../lib/agent2Review'
import { AGENT_STATUSES } from '../../types/agent'
import type {
  Agent2DashboardData,
  NormalizationComponent,
  NormalizationLayer4a,
  ProductPipelineRow,
  ScoringInputRow,
} from '../../types/agent'

type Props = {
  authUserEmail: string | null
  onNotice: (message: string | null) => void
  onError: (message: string | null) => void
}

export function Agent2ReviewDashboard({ authUserEmail, onNotice, onError }: Props) {
  const [data, setData] = useState<Agent2DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState(false)
  const [rejectNotes, setRejectNotes] = useState('')
  const [listFilter, setListFilter] = useState<'review' | 'run' | 'testing' | 'all'>('review')
  const [selectedRunIds, setSelectedRunIds] = useState<Set<string>>(() => new Set())
  const [batchProgress, setBatchProgress] = useState<{
    current: number
    total: number
    name: string
  } | null>(null)
  const initialTabSet = useRef(false)

  const load = useCallback(async () => {
    setLoading(true)
    onError(null)
    try {
      const dashboard = await fetchAgent2Dashboard()
      setData(dashboard)
    } catch (e: unknown) {
      onError(formatSupabaseUnknownError(e, 'Failed to load Agent 2 dashboard'))
    } finally {
      setLoading(false)
    }
  }, [onError])

  useEffect(() => {
    load()
  }, [load])

  const scoringInputByProductId = useMemo(() => {
    const map = new Map<string, ScoringInputRow>()
    if (!data) return map
    for (const item of data.pendingReview) {
      map.set(item.product.product_id, item.scoringInput)
    }
    for (const item of data.testingQueue) {
      if (item.scoringInput) {
        map.set(item.product.product_id, item.scoringInput)
      }
    }
    return map
  }, [data])

  const reviewQueue = useMemo(() => {
    if (!data) return []
    return data.pendingReview.map((x) => x.product)
  }, [data])

  const testingQueueProducts = useMemo(() => {
    if (!data) return []
    return data.testingQueue.map((x) => x.product)
  }, [data])

  const runnableProducts = useMemo(() => {
    if (!data) return []
    return data.products.filter((p) => canRunAgent2(p.agent_status))
  }, [data])

  const listProducts = useMemo(() => {
    if (!data) return []
    if (listFilter === 'review') return reviewQueue
    if (listFilter === 'run') return runnableProducts
    if (listFilter === 'testing') return testingQueueProducts
    return data.products
  }, [data, listFilter, reviewQueue, runnableProducts, testingQueueProducts])

  const selectedRunnable = useMemo(() => {
    if (!data) return []
    return runnableProducts.filter((p) => selectedRunIds.has(p.product_id))
  }, [data, runnableProducts, selectedRunIds])

  const batchBusy = batchProgress !== null

  const selectedProduct = useMemo(() => {
    if (!data || !selectedId) return null
    return data.products.find((p) => p.product_id === selectedId) ?? null
  }, [data, selectedId])

  const selectedItem = useMemo(() => {
    if (!data || !selectedId) return null
    return data.pendingReview.find((x) => x.product.product_id === selectedId) ?? null
  }, [data, selectedId])

  const selectedTestingItem = useMemo(() => {
    if (!data || !selectedId) return null
    return data.testingQueue.find((x) => x.product.product_id === selectedId) ?? null
  }, [data, selectedId])

  const selectedScoringInput = selectedId ? scoringInputByProductId.get(selectedId) : undefined

  useEffect(() => {
    if (!data || selectedId) return
    if (listFilter === 'review' && reviewQueue.length > 0) {
      setSelectedId(reviewQueue[0].product_id)
    }
    if (listFilter === 'testing' && testingQueueProducts.length > 0) {
      setSelectedId(testingQueueProducts[0].product_id)
    }
  }, [data, listFilter, reviewQueue, testingQueueProducts, selectedId])

  useEffect(() => {
    if (!data || initialTabSet.current) return
    initialTabSet.current = true
    if (runnableProducts.length > 0 && reviewQueue.length === 0) {
      setListFilter('run')
    }
  }, [data, runnableProducts.length, reviewQueue.length])

  const statusSummary = useMemo(() => {
    if (!data) return []
    return AGENT_STATUSES.map((status) => ({
      status,
      count: data.statusCounts[status] ?? 0,
    })).filter((row) => row.count > 0)
  }, [data])

  const normalizationStatusSummary = useMemo(() => {
    if (!data) return []
    return NORMALIZATION_PIPELINE_STATUSES.map((status) => ({
      status,
      count: data.statusCounts[status] ?? 0,
    })).filter((row) => row.count > 0)
  }, [data])

  async function handleApprove(inputId: string, productId: string) {
    if (!authUserEmail) {
      onError('Sign in with Supabase Auth above before approving normalization.')
      return
    }
    setBusyId(productId)
    onError(null)
    onNotice(null)
    try {
      await approveNormalization(inputId, productId, authUserEmail)
      onNotice('Normalization approved.')
      await load()
      setSelectedId(null)
      setRejecting(false)
      setRejectNotes('')
    } catch (e: unknown) {
      onError(formatSupabaseUnknownError(e, 'Approve failed'))
    } finally {
      setBusyId(null)
    }
  }

  function openRejectPanel() {
    if (!authUserEmail) {
      onError('Sign in with Supabase Auth above before rejecting normalization.')
      return
    }
    onError(null)
    setRejecting(true)
    requestAnimationFrame(() => {
      document.getElementById('agent2-reject-panel')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
  }

  async function handleRunAgent2(productId: string) {
    setBusyId(productId)
    onError(null)
    onNotice(null)
    try {
      onNotice('Agent 2 running… this may take 1–2 minutes.')
      const outcome = await runAgent2Remote(productId)
      onNotice(
        outcome.ok
          ? outcome.message ?? 'Agent 2 finished. Refreshing…'
          : outcome.message ?? 'Agent 2 finished with issues.',
      )
      await load()
      setSelectedId(productId)
      setListFilter('review')
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : 'Agent 2 run failed')
    } finally {
      setBusyId(null)
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

  function switchListFilter(filter: 'review' | 'run' | 'testing' | 'all') {
    setListFilter(filter)
    setRejecting(false)
    setRejectNotes('')
    if (filter === 'run') {
      setSelectedId(null)
    } else if (filter === 'review' && reviewQueue.length > 0) {
      setSelectedId(reviewQueue[0].product_id)
    } else if (filter === 'testing' && testingQueueProducts.length > 0) {
      setSelectedId(testingQueueProducts[0].product_id)
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
      const results = await runAgent2Batch(selectedRunnable, (current, total, name) => {
        setBatchProgress({ current, total, name })
      })

      const succeeded = results.filter((r) => r.ok).length
      const failed = results.length - succeeded
      onNotice(
        `Batch complete: ${succeeded} submitted for review, ${failed} failed or skipped.`,
      )
      setSelectedRunIds(new Set())
      setListFilter('review')
      await load()
      const firstOk = results.find((r) => r.ok)
      if (firstOk) setSelectedId(firstOk.productId)
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : 'Batch run failed')
    } finally {
      setBatchProgress(null)
    }
  }

  async function handleReject(inputId: string, productId: string) {
    if (!authUserEmail) {
      onError('Sign in with Supabase Auth above before rejecting normalization.')
      return
    }
    if (!rejectNotes.trim()) {
      onError('Add rejection notes in the panel above, then click Confirm reject.')
      return
    }
    setBusyId(productId)
    onError(null)
    onNotice(null)
    try {
      await rejectNormalization(inputId, productId, rejectNotes, authUserEmail)
      onNotice('Normalization rejected.')
      await load()
      setSelectedId(null)
      setRejecting(false)
      setRejectNotes('')
    } catch (e: unknown) {
      onError(formatSupabaseUnknownError(e, 'Reject failed'))
    } finally {
      setBusyId(null)
    }
  }

  if (loading && !data) {
    return <p className="mt-6 text-sm text-slate-600">Loading Agent 2 dashboard…</p>
  }

  if (!data) {
    return (
      <p className="mt-6 text-sm text-slate-600">
        No dashboard data. Check Supabase Auth and try again.
      </p>
    )
  }

  return (
    <div className="mt-6 space-y-6">

      {!authUserEmail ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-semibold">Sign in above to approve or reject normalization</p>
          <p className="mt-1 text-amber-900/90">
            You can browse the queue below, but Approve/Reject require Supabase Auth sign-in.
          </p>
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-ink-900">Pipeline summary</h2>
            <p className="mt-1 text-xs text-slate-600">
              {data.products.length} products · {reviewQueue.length} awaiting review ·{' '}
              {data.testingQueue.length} in testing queue · {runnableProducts.length} ready to run
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

        {normalizationStatusSummary.length > 0 ? (
          <div className="mt-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-700">
              Agent 2 — normalization
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {normalizationStatusSummary.map(({ status, count }) => (
                <StatusChip key={status} status={status} count={count} highlight />
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          {statusSummary.map(({ status, count }) => (
            <StatusChip
              key={status}
              status={status}
              count={count}
              highlight={NORMALIZATION_PIPELINE_STATUSES.includes(
                status as (typeof NORMALIZATION_PIPELINE_STATUSES)[number],
              )}
            />
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-card">
            <div className="space-y-3 border-b border-slate-100 p-3">
              <div className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
                <button
                  type="button"
                  className={`rounded-lg px-2 py-1.5 text-xs font-semibold ${
                    listFilter === 'review'
                      ? 'bg-white text-ink-900 shadow-sm'
                      : 'text-slate-600'
                  }`}
                  onClick={() => switchListFilter('review')}
                >
                  Awaiting review ({reviewQueue.length})
                </button>
                <button
                  type="button"
                  className={`rounded-lg px-2 py-1.5 text-xs font-semibold ${
                    listFilter === 'run' ? 'bg-white text-ink-900 shadow-sm' : 'text-slate-600'
                  }`}
                  onClick={() => switchListFilter('run')}
                >
                  Run Agent 2 ({runnableProducts.length})
                </button>
                <button
                  type="button"
                  className={`rounded-lg px-2 py-1.5 text-xs font-semibold ${
                    listFilter === 'testing'
                      ? 'bg-white text-ink-900 shadow-sm'
                      : 'text-slate-600'
                  }`}
                  onClick={() => switchListFilter('testing')}
                >
                  Testing queue ({testingQueueProducts.length})
                </button>
                <button
                  type="button"
                  className={`rounded-lg px-2 py-1.5 text-xs font-semibold ${
                    listFilter === 'all' ? 'bg-white text-ink-900 shadow-sm' : 'text-slate-600'
                  }`}
                  onClick={() => switchListFilter('all')}
                >
                  All products
                </button>
              </div>
              {listFilter === 'run' ? (
                <div className="space-y-2">
                  <p className="text-[11px] leading-relaxed text-slate-600">
                    Evidence must be approved first. Select products, then run in sequence (~1–2
                    min each). Rejected normalizations can be re-run from here.
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
                      : `Run Agent 2 on selected (${selectedRunnable.length})`}
                  </button>
                </div>
              ) : null}
            </div>
            <ul className="max-h-[65dvh] divide-y divide-slate-100 overflow-auto">
              {listProducts.length === 0 ? (
                <li className="p-4 text-sm text-slate-600">
                  {listFilter === 'review'
                    ? 'Nothing awaiting normalization review.'
                    : listFilter === 'run'
                      ? 'Nothing to run. Approve Agent 1 evidence first, or reject a normalization to re-run.'
                      : listFilter === 'testing'
                        ? 'Nothing in the testing queue.'
                        : 'No products found.'}
                </li>
              ) : (
                listProducts.map((p) => {
                  const isSelected = p.product_id === selectedId
                  const scoringInput = scoringInputByProductId.get(p.product_id)
                  const runnable = canRunAgent2(p.agent_status)
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
                            setRejectNotes('')
                          }}
                          className="min-w-0 flex-1 px-4 py-3 text-left disabled:opacity-60"
                        >
                          <div className="font-semibold text-ink-900">{p.product_name}</div>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <NormalizationStatusPill status={p.agent_status} />
                            {p.agent_status === 'in_testing_queue' ? (
                              <span className="text-[10px] font-semibold text-amber-800">
                                Testing queue
                              </span>
                            ) : scoringInput && p.agent_status === 'normalization_awaiting_review' ? (
                              <span className="text-[10px] font-semibold text-violet-700">
                                Ready to review
                              </span>
                            ) : runnable ? (
                              <span className="text-[10px] font-semibold text-emerald-800">
                                Ready to run
                              </span>
                            ) : hasNormalizationRun(p.agent_status) ? (
                              <span className="text-[10px] font-semibold text-slate-600">
                                Normalization run
                              </span>
                            ) : p.agent_status === 'evidence_awaiting_review' ? (
                              <span className="text-[10px] font-semibold text-amber-800">
                                Agent 1 review first
                              </span>
                            ) : null}
                            {scoringInput?.human_review_required ? (
                              <span className="text-[10px] font-semibold text-amber-800">
                                Human review flagged
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-xs text-slate-600">
                            {p.brand ?? '—'} · {p.category ?? '—'}
                          </p>
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
            <Agent2RunTabPanel
              selectedProduct={
                selectedProduct && canRunAgent2(selectedProduct.agent_status)
                  ? selectedProduct
                  : null
              }
              selectedRunnable={selectedRunnable}
              batchProgress={batchProgress}
              busyId={busyId}
              onRunSingle={(productId) => handleRunAgent2(productId)}
            />
          ) : !selectedProduct ? (
            <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-600">
              Select a product from the list to review normalization inputs.
            </div>
          ) : selectedTestingItem ? (
            <TestingQueueDetailPanel item={selectedTestingItem} />
          ) : selectedItem ? (
            <NormalizationReviewCard
              product={selectedItem.product}
              scoringInput={selectedItem.scoringInput}
              busy={busyId === selectedItem.product.product_id}
              showRejectNotes={rejecting}
              rejectNotes={rejectNotes}
              onRejectNotesChange={setRejectNotes}
              onApprove={() =>
                handleApprove(
                  selectedItem.scoringInput.input_id,
                  selectedItem.product.product_id,
                )
              }
              onRejectOpen={openRejectPanel}
              onRejectCancel={() => {
                setRejecting(false)
                setRejectNotes('')
              }}
              onRejectConfirm={() =>
                handleReject(
                  selectedItem.scoringInput.input_id,
                  selectedItem.product.product_id,
                )
              }
            />
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
              <h3 className="text-lg font-semibold text-ink-900">{selectedProduct.product_name}</h3>
              <p className="mt-2 text-sm text-slate-600">
                {selectedProduct.brand ?? '—'} · {selectedProduct.category ?? '—'}
                {selectedProduct.subcategory ? ` · ${selectedProduct.subcategory}` : ''}
              </p>
              <div className="mt-3">
                <NormalizationStatusPill status={selectedProduct.agent_status} />
              </div>
              <p className="mt-4 text-sm text-slate-700">
                {selectedProduct.agent_status === 'in_testing_queue'
                  ? 'This product is in the testing queue. Open the Testing queue tab to see tier-change details and normalization notes.'
                  : selectedProduct.agent_status === 'normalization_awaiting_review'
                  ? 'Normalization is awaiting review but could not be loaded. Sign in with Supabase Auth and refresh.'
                  : selectedProduct.agent_status === 'normalization_approved'
                    ? 'Normalization approved. Agent 3 scoring is next.'
                    : selectedProduct.agent_status === 'evidence_awaiting_review' ||
                        selectedProduct.agent_status === 'evidence_in_progress'
                      ? 'Complete Agent 1 evidence review before running normalization.'
                      : selectedScoringInput
                        ? 'Submitted normalization could not be loaded. Refresh the page.'
                        : 'No submitted normalization packet for this product yet.'}
              </p>
              {canRunAgent2(selectedProduct.agent_status) ? (
                <button
                  type="button"
                  disabled={busyId === selectedProduct.product_id}
                  onClick={() => handleRunAgent2(selectedProduct.product_id)}
                  className="mt-4 rounded-xl bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-700 disabled:opacity-60"
                >
                  {busyId === selectedProduct.product_id ? 'Running Agent 2…' : 'Run Agent 2'}
                </button>
              ) : null}
            </div>
          )}
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Use <strong>Run Agent 2</strong> to batch-run products with approved evidence. Review under{' '}
        <strong>Awaiting review</strong>. Tier-change holds appear under <strong>Testing queue</strong>{' '}
        (not approved for Agent 3 until resolved).
      </p>
    </div>
  )
}

function TestingQueueDetailPanel({
  item,
}: {
  item: Agent2DashboardData['testingQueue'][number]
}) {
  const { product, scoringInput } = item
  const inputs = scoringInput?.inputs

  return (
    <article className="max-h-[75dvh] overflow-auto rounded-2xl border border-amber-200 bg-white p-4 shadow-card md:p-6">
      <header className="border-b border-slate-100 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="text-lg font-semibold text-ink-900">{product.product_name}</h3>
          <NormalizationStatusPill status={product.agent_status} />
        </div>
        <p className="mt-2 text-sm text-slate-600">
          {product.brand ?? '—'} · {product.category ?? '—'}
          {product.subcategory ? ` · ${product.subcategory}` : ''}
        </p>
      </header>

      <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
        <p className="text-sm font-semibold text-amber-950">In Testing Queue</p>
        <p className="mt-1 text-sm text-amber-900">
          Agent 2 flagged a tier change (Scenario A). This product is held here until you resolve
          the material ambiguity — it does not advance to Agent 3 scoring while in this state.
        </p>
        {product.score_basis ? (
          <p className="mt-2 text-sm text-amber-950">
            <span className="font-semibold">Score basis:</span> {product.score_basis}
          </p>
        ) : null}
        {product.testing_queue_reason ? (
          <p className="mt-2 text-sm text-amber-950 whitespace-pre-wrap">
            <span className="font-semibold">Reason:</span> {product.testing_queue_reason}
          </p>
        ) : null}
      </div>

      {!scoringInput ? (
        <p className="mt-6 text-sm text-slate-700">
          No normalization packet on file. Re-run Agent 2 after updating evidence, or apply a
          manual hold with scoring_inputs in Supabase.
        </p>
      ) : (
        <>
          <p className="mt-4 text-xs text-slate-500">
            Algorithm {scoringInput.algorithm_version} · run{' '}
            {new Date(scoringInput.run_timestamp).toLocaleString()} · review status{' '}
            {scoringInput.review_status}
          </p>

          {inputs?.product_category_default ? (
            <p className="mt-2 text-sm text-slate-700">
              <span className="font-semibold">Category default:</span>{' '}
              {inputs.product_category_default}
            </p>
          ) : null}

          {scoringInput.human_review_required ? (
            <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              <span className="font-semibold">Human review required:</span>{' '}
              {scoringInput.human_review_reason ??
                inputs?.human_review_reason ??
                'See notes below.'}
            </p>
          ) : null}

          {inputs?.components?.length ? (
            <Section title={`Components (${inputs.components.length})`}>
              <div className="space-y-4">
                {inputs.components.map((component, i) => (
                  <ComponentBlock key={`${component.component_name}-${i}`} component={component} />
                ))}
              </div>
            </Section>
          ) : null}

          {inputs?.layer_4b ? (
            <Section title="Transparency (Layer 4B)">
              <p className="text-sm font-semibold text-ink-900">
                {inputs.layer_4b.transparency_badge ?? '—'}
                {inputs.layer_4b.confidence_interval != null
                  ? ` · ±${inputs.layer_4b.confidence_interval}`
                  : ''}
              </p>
              {inputs.layer_4b.badge_justification ? (
                <p className="mt-2 text-sm text-slate-700">{inputs.layer_4b.badge_justification}</p>
              ) : null}
            </Section>
          ) : null}

          {inputs?.layer_4a ? <Layer4aSection layer4a={inputs.layer_4a} /> : null}

          {inputs?.normalization_notes ? (
            <Section title="Normalization notes">
              <p className="text-sm text-slate-700 whitespace-pre-wrap">
                {inputs.normalization_notes}
              </p>
            </Section>
          ) : null}
        </>
      )}
    </article>
  )
}

function Agent2RunTabPanel({
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
        <p className="text-sm font-semibold text-ink-900">Running Agent 2</p>
        <p className="mt-2 text-sm text-slate-600">
          {batchProgress.current} of {batchProgress.total}
          {batchProgress.name ? `: ${batchProgress.name}` : ''}
        </p>
        <p className="mt-4 max-w-md text-xs text-slate-500">
          Each product takes about 1–2 minutes. Leave this tab open until the batch finishes.
        </p>
      </div>
    )
  }

  if (selectedProduct) {
    const busy = busyId === selectedProduct.product_id
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
        <h3 className="text-lg font-semibold text-ink-900">{selectedProduct.product_name}</h3>
        <p className="mt-2 text-sm text-slate-600">
          {selectedProduct.brand ?? '—'} · {selectedProduct.category ?? '—'}
          {selectedProduct.subcategory ? ` · ${selectedProduct.subcategory}` : ''}
        </p>
        <div className="mt-3">
          <NormalizationStatusPill status={selectedProduct.agent_status} />
        </div>
        <p className="mt-4 text-sm text-slate-700">
          Agent 2 converts approved evidence into scoring inputs. Review and approval happen under{' '}
          <strong>Awaiting review</strong>.
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => onRunSingle(selectedProduct.product_id)}
          className="mt-4 rounded-xl bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-700 disabled:opacity-60"
        >
          {busy ? 'Running Agent 2…' : 'Run Agent 2 on this product'}
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
          Use <strong>Run Agent 2 on selected</strong> in the left panel to start the batch.
        </p>
      </div>
    )
  }

  return (
    <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center shadow-card">
      <div className="max-w-sm space-y-2">
        <p className="text-sm font-semibold text-ink-900">Run Agent 2 on products</p>
        <p className="text-sm text-slate-600">
          Check products on the left, then run in batch. Normalization review is on the{' '}
          <strong>Awaiting review</strong> tab.
        </p>
      </div>
    </div>
  )
}

function NormalizationReviewCard({
  product,
  scoringInput,
  busy,
  showRejectNotes,
  rejectNotes,
  onRejectNotesChange,
  onApprove,
  onRejectOpen,
  onRejectCancel,
  onRejectConfirm,
}: {
  product: ProductPipelineRow
  scoringInput: ScoringInputRow
  busy: boolean
  showRejectNotes: boolean
  rejectNotes: string
  onRejectNotesChange: (v: string) => void
  onApprove: () => void
  onRejectOpen: () => void
  onRejectCancel: () => void
  onRejectConfirm: () => void
}) {
  const inputs = scoringInput.inputs

  return (
    <article className="max-h-[75dvh] overflow-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-card md:p-6">
      <header className="border-b border-slate-100 pb-4">
        <h3 className="text-lg font-semibold text-ink-900">{product.product_name}</h3>
        <dl className="mt-2 grid gap-1 text-sm text-slate-700 sm:grid-cols-3">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Brand</dt>
            <dd>{product.brand ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Category
            </dt>
            <dd>{product.category ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Subcategory
            </dt>
            <dd>{product.subcategory ?? '—'}</dd>
          </div>
        </dl>
        <p className="mt-2 text-xs text-slate-500">
          Algorithm {scoringInput.algorithm_version} · run{' '}
          {new Date(scoringInput.run_timestamp).toLocaleString()}
        </p>
        {inputs.product_category_default ? (
          <p className="mt-2 text-sm text-slate-700">
            <span className="font-semibold">Category default:</span>{' '}
            {inputs.product_category_default}
          </p>
        ) : null}
        {scoringInput.human_review_required ? (
          <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            <span className="font-semibold">Human review required:</span>{' '}
            {scoringInput.human_review_reason ?? inputs.human_review_reason ?? 'See notes below.'}
          </p>
        ) : null}
      </header>

      <Section title={`Components (${inputs.components?.length ?? 0})`}>
        <div className="space-y-4">
          {(inputs.components ?? []).map((component, i) => (
            <ComponentBlock key={`${component.component_name}-${i}`} component={component} />
          ))}
        </div>
      </Section>

      {inputs.layer_4b ? (
        <Section title="Transparency (Layer 4B)">
          <p className="text-sm font-semibold text-ink-900">
            {inputs.layer_4b.transparency_badge ?? '—'}
            {inputs.layer_4b.confidence_interval != null
              ? ` · ±${inputs.layer_4b.confidence_interval}`
              : ''}
          </p>
          {inputs.layer_4b.badge_justification ? (
            <p className="mt-2 text-sm text-slate-700">{inputs.layer_4b.badge_justification}</p>
          ) : null}
        </Section>
      ) : null}

      {inputs.layer_4a ? <Layer4aSection layer4a={inputs.layer_4a} /> : null}

      {inputs.normalization_notes ? (
        <Section title="Normalization notes">
          <p className="text-sm text-slate-700 whitespace-pre-wrap">{inputs.normalization_notes}</p>
        </Section>
      ) : null}

      {showRejectNotes ? (
        <div
          id="agent2-reject-panel"
          className="mt-6 rounded-xl border-2 border-red-300 bg-red-50 p-4 shadow-sm"
        >
          <p className="text-sm font-semibold text-red-900">Reject normalization</p>
          <p className="mt-1 text-xs text-red-800/90">
            Notes are saved on the scoring_inputs row for Agent 2 on the next run.
          </p>
          <label className="mt-3 block text-xs font-semibold text-red-900">Rejection notes</label>
          <textarea
            value={rejectNotes}
            onChange={(e) => onRejectNotesChange(e.target.value)}
            rows={6}
            placeholder="Why are these normalization inputs being rejected? Include corrections for re-normalization."
            className="mt-2 w-full rounded-xl border border-red-200 bg-white px-3 py-2 text-sm"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={onRejectConfirm}
              className="rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-60"
            >
              Confirm reject
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onRejectCancel}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <footer className="sticky bottom-0 mt-6 flex flex-wrap gap-2 border-t border-slate-100 bg-white pt-4 pb-1">
        <button
          type="button"
          disabled={busy}
          onClick={onApprove}
          className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
        >
          Approve
        </button>
        <button
          type="button"
          disabled={busy || showRejectNotes}
          onClick={onRejectOpen}
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-800 hover:bg-red-100 disabled:opacity-60"
        >
          {showRejectNotes ? 'Add notes above…' : 'Reject'}
        </button>
      </footer>
    </article>
  )
}

function ComponentBlock({ component }: { component: NormalizationComponent }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
      <h4 className="font-semibold text-ink-900">{component.component_name}</h4>
      <p className="mt-1 text-sm text-slate-700">{component.material}</p>

      <dl className="mt-3 grid gap-2 sm:grid-cols-3">
        <Metric label="Material Hazard" value={component.material_hazard} />
        <Metric label="Migration Potential" value={component.adjusted_migration_potential} />
        <Metric label="Contact Intimacy" value={component.contact_intimacy} />
      </dl>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Severity ({component.exposure_severity})
          </p>
          <p className="mt-1 text-sm text-slate-700">{component.severity_justification}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Duration ({component.exposure_duration})
          </p>
          <p className="mt-1 text-sm text-slate-700">{component.duration_justification}</p>
        </div>
      </div>

      {component.inert_protection_applies ? (
        <p className="mt-3 inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-900">
          Inert protection applies
        </p>
      ) : null}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold tabular-nums text-ink-900">{value}</dd>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h4>
      <div className="mt-2">{children}</div>
    </section>
  )
}

function Layer4aSection({ layer4a }: { layer4a: NormalizationLayer4a }) {
  const positives = formatLayer4aAdjustments(layer4a.positive_adjustments)
  const negatives = formatLayer4aAdjustments(layer4a.negative_adjustments)

  return (
    <Section title="Layer 4A adjustments">
      {positives.length > 0 ? (
        <div className="mt-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Positive</p>
          <ul className="mt-1 space-y-1 text-sm text-slate-700">
            {positives.map((row, i) => (
              <li key={`pos-${i}`}>
                {row.label}
                {row.value != null ? (
                  <span className="ml-1 font-semibold tabular-nums text-emerald-800">
                    {row.value > 0 ? `+${row.value}` : row.value}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {negatives.length > 0 ? (
        <div className={positives.length > 0 ? 'mt-3' : 'mt-1'}>
          <p className="text-xs font-semibold uppercase tracking-wide text-red-800">Negative</p>
          <ul className="mt-1 space-y-1 text-sm text-slate-700">
            {negatives.map((row, i) => (
              <li key={`neg-${i}`}>
                {row.label}
                {row.value != null ? (
                  <span className="ml-1 font-semibold tabular-nums text-red-800">{row.value}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {positives.length === 0 && negatives.length === 0 ? (
        <p className="text-sm text-slate-600">No itemized adjustments listed.</p>
      ) : null}
      <p className="mt-3 text-sm text-slate-700">
        Net adjustment: <strong className="tabular-nums">{layer4a.net_adjustment ?? 0}</strong>
      </p>
    </Section>
  )
}

function formatLayer4aAdjustments(
  items?: NormalizationLayer4a['positive_adjustments'],
): Array<{ label: string; value: number | null }> {
  if (!items?.length) return []
  return items.map((item) => {
    if (typeof item === 'string') return { label: item, value: null }
    const label = item.reason ?? item.label ?? 'Adjustment'
    const value = item.value ?? item.points ?? null
    return { label, value: value != null ? value : null }
  })
}

function StatusChip({
  status,
  count,
  highlight,
}: {
  status: string
  count: number
  highlight?: boolean
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${
        highlight
          ? 'border-violet-200 bg-violet-50'
          : 'border-slate-200 bg-slate-50'
      }`}
    >
      <span className="font-medium text-ink-900">{humanizeAgentStatus(status)}</span>
      <span className="rounded-full bg-ink-900 px-1.5 py-0.5 text-[10px] font-semibold text-white">
        {count}
      </span>
    </span>
  )
}

function NormalizationStatusPill({ status }: { status: string }) {
  const tone =
    status === 'normalization_awaiting_review'
      ? 'bg-violet-100 text-violet-900'
      : status === 'normalization_approved'
        ? 'bg-emerald-100 text-emerald-900'
        : status === 'normalization_rejected'
          ? 'bg-red-100 text-red-900'
          : status === 'in_testing_queue'
            ? 'bg-amber-100 text-amber-900'
            : status === 'normalization_in_progress'
              ? 'bg-blue-100 text-blue-900'
              : 'bg-slate-100 text-slate-700'

  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${tone}`}>
      {humanizeAgentStatus(status)}
    </span>
  )
}
