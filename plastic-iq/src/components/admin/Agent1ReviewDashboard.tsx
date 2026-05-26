import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatSupabaseUnknownError } from '../../lib/supabaseClient'
import {
  approveEvidence,
  AGENT1_VALIDATION_RERUN_PRODUCT_IDS,
  BRANCH_BASICS_PRODUCT_ID,
  canRerunAgent1FromReviewCard,
  canShowOnAgent1RunTab,
  isAgent1ValidationRerunProduct,
  confidenceBadgeClass,
  fetchAgent1Dashboard,
  formatAgent1ApiUsage,
  formatFactValue,
  isAgent1Rerun,
  getDisplayFacts,
  getEvidenceGaps,
  getStructuredEvidence,
  getWarnings,
  humanizeAgentStatus,
  rejectEvidence,
  CACHE_TEST_AGENT1_BATCH_PRODUCT_IDS,
  runAgent1Batch,
  runAgent1Remote,
} from '../../lib/agent1Review'
import { NORMALIZATION_PIPELINE_STATUSES } from '../../lib/agent2Review'
import type { Agent1DashboardData, ProductEvidence, ProductPipelineRow } from '../../types/agent'
import { AGENT_STATUSES } from '../../types/agent'

type Props = {
  authUserEmail: string | null
  onNotice: (message: string | null) => void
  onError: (message: string | null) => void
}

export function Agent1ReviewDashboard({ authUserEmail, onNotice, onError }: Props) {
  const [data, setData] = useState<Agent1DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState(false)
  const [rejectNotes, setRejectNotes] = useState('')
  const [listFilter, setListFilter] = useState<'review' | 'run' | 'all'>('run')
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
      const dashboard = await fetchAgent1Dashboard()
      setData(dashboard)
    } catch (e: unknown) {
      onError(formatSupabaseUnknownError(e, 'Failed to load Agent 1 dashboard'))
    } finally {
      setLoading(false)
    }
  }, [onError])

  useEffect(() => {
    load()
  }, [load])

  const evidenceByProductId = useMemo(() => {
    const map = new Map<string, ProductEvidence>()
    if (!data) return map
    for (const item of data.pendingReview) {
      if (item.evidence) map.set(item.product.product_id, item.evidence)
    }
    return map
  }, [data])

  const reviewQueue = useMemo(() => {
    if (!data) return []
    return data.pendingReview
      .filter((x) => x.evidence != null)
      .map((x) => x.product)
  }, [data])

  const runnableProducts = useMemo(() => {
    if (!data) return []
    return data.products
      .filter((p) => canShowOnAgent1RunTab(p))
      .sort((a, b) => {
        const aVal = isAgent1ValidationRerunProduct(a.product_id) ? 0 : 1
        const bVal = isAgent1ValidationRerunProduct(b.product_id) ? 0 : 1
        if (aVal !== bVal) return aVal - bVal
        return a.product_name.localeCompare(b.product_name)
      })
  }, [data])

  const listProducts = useMemo(() => {
    if (!data) return []
    if (listFilter === 'review') return reviewQueue
    if (listFilter === 'run') return runnableProducts
    return data.products
  }, [data, listFilter, reviewQueue, runnableProducts])

  const selectedRunnable = useMemo(() => {
    if (!data) return []
    return runnableProducts.filter((p) => selectedRunIds.has(p.product_id))
  }, [data, runnableProducts, selectedRunIds])

  const batchBusy = batchProgress !== null

  const selectedProduct = useMemo(() => {
    if (!data || !selectedId) return null
    return data.products.find((p) => p.product_id === selectedId) ?? null
  }, [data, selectedId])

  const selectedEvidence = selectedId ? evidenceByProductId.get(selectedId) : undefined

  useEffect(() => {
    if (!data || selectedId) return
    if (listFilter === 'review' && reviewQueue.length > 0) {
      setSelectedId(reviewQueue[0].product_id)
    }
  }, [data, listFilter, reviewQueue, selectedId])

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

  async function handleApprove(evidenceId: string, productId: string) {
    if (!authUserEmail) {
      onError('Sign in with Supabase Auth above before approving evidence.')
      return
    }
    setBusyId(productId)
    onError(null)
    onNotice(null)
    try {
      await approveEvidence(evidenceId, productId, authUserEmail)
      onNotice('Evidence approved.')
      setSelectedId(null)
      setRejecting(false)
      setRejectNotes('')
      await load()
    } catch (e: unknown) {
      onError(formatSupabaseUnknownError(e, 'Approve failed'))
    } finally {
      setBusyId(null)
    }
  }

  async function handleReject(evidenceId: string, productId: string) {
    if (!authUserEmail) {
      onError('Sign in with Supabase Auth above before rejecting evidence.')
      return
    }
    if (!rejectNotes.trim()) {
      onError('Add rejection notes before rejecting.')
      return
    }
    setBusyId(productId)
    onError(null)
    onNotice(null)
    try {
      await rejectEvidence(evidenceId, productId, rejectNotes, authUserEmail)
      onNotice('Evidence rejected.')
      setSelectedId(null)
      setRejecting(false)
      setRejectNotes('')
      await load()
    } catch (e: unknown) {
      onError(formatSupabaseUnknownError(e, 'Reject failed'))
    } finally {
      setBusyId(null)
    }
  }

  async function handleRunAgent1(productId: string, productName?: string) {
    const product =
      data?.products.find((p) => p.product_id === productId) ??
      ({ agent_status: 'unscored', product_name: productName ?? 'this product' } as ProductPipelineRow)

    if (isAgent1Rerun(product.agent_status)) {
      const label = productName ?? product.product_name
      const ok = window.confirm(
        `Re-run Agent 1 on “${label}”? This calls the Anthropic API (your API key) and creates a new evidence bundle. Current status: ${humanizeAgentStatus(product.agent_status)}.`,
      )
      if (!ok) return
    }

    setBusyId(productId)
    onError(null)
    onNotice(null)
    try {
      onNotice('Agent 1 running… this may take 1–2 minutes. Watch your Anthropic usage dashboard.')
      const outcome = await runAgent1Remote(productId)
      onNotice(
        outcome.ok
          ? outcome.message ?? 'Agent 1 finished. Refreshing…'
          : outcome.message ?? 'Agent 1 finished with issues.',
      )
      await load()
      setSelectedId(productId)
      if (outcome.ok) setListFilter('review')
      else setListFilter('run')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Agent 1 run failed'
      onError(
        msg.includes('fetch') || msg.includes('Failed to fetch')
          ? `${msg} — Dev server not reachable.`
          : msg,
      )
      setListFilter('run')
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

  function selectValidationBatch() {
    const ids = AGENT1_VALIDATION_RERUN_PRODUCT_IDS.filter((id) =>
      runnableProducts.some((p) => p.product_id === id),
    )
    setSelectedRunIds(new Set(ids))
  }

  function selectBranchBasicsOnly() {
    if (runnableProducts.some((p) => p.product_id === BRANCH_BASICS_PRODUCT_ID)) {
      setSelectedRunIds(new Set([BRANCH_BASICS_PRODUCT_ID]))
    }
    if (listFilter !== 'run') switchListFilter('run')
  }

  function selectCacheTestBatch() {
    const ids = CACHE_TEST_AGENT1_BATCH_PRODUCT_IDS.filter((id) =>
      runnableProducts.some((p) => p.product_id === id),
    )
    setSelectedRunIds(new Set(ids))
    if (listFilter !== 'run') switchListFilter('run')
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
      setRejecting(false)
      setRejectNotes('')
    } else if (filter === 'review' && reviewQueue.length > 0) {
      setSelectedId((id) => id ?? reviewQueue[0].product_id)
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
      const results = await runAgent1Batch(selectedRunnable, (current, total, name) => {
        setBatchProgress({ current, total, name })
      })

      const succeeded = results.filter((r) => r.ok).length
      const failed = results.length - succeeded
      onNotice(
        `Batch complete: ${succeeded} submitted for review${failed > 0 ? `, ${failed} did not submit` : ''}.`,
      )
      setSelectedRunIds(new Set())
      await load()
      const firstOk = results.find((r) => r.ok)
      const firstAny = results[0]
      if (firstOk) {
        setListFilter('review')
        setSelectedId(firstOk.productId)
      } else if (firstAny) {
        setListFilter('run')
        setSelectedId(firstAny.productId)
      }
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : 'Batch run failed')
    } finally {
      setBatchProgress(null)
    }
  }

  if (loading && !data) {
    return <p className="mt-6 text-sm text-slate-600">Loading Agent 1 dashboard…</p>
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
          <p className="font-semibold">Sign in above to approve or reject evidence</p>
          <p className="mt-1 text-amber-900/90">
            Evidence packets load via the dev API. Approve/Reject still requires Supabase Auth
            sign-in.
          </p>
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-ink-900">Pipeline summary</h2>
            <p className="mt-1 text-xs text-slate-600">
              {data.products.length} products · {reviewQueue.length} awaiting review
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
                <span
                  key={status}
                  className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs"
                >
                  <span className="font-medium text-ink-900">{humanizeAgentStatus(status)}</span>
                  <span className="rounded-full bg-ink-900 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    {count}
                  </span>
                </span>
              ))}
            </div>
          </div>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          {statusSummary.map(({ status, count }) => (
            <span
              key={status}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${
                NORMALIZATION_PIPELINE_STATUSES.includes(
                  status as (typeof NORMALIZATION_PIPELINE_STATUSES)[number],
                )
                  ? 'border-violet-200 bg-violet-50'
                  : 'border-slate-200 bg-slate-50'
              }`}
            >
              <span className="font-medium text-ink-900">{humanizeAgentStatus(status)}</span>
              <span className="rounded-full bg-ink-900 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                {count}
              </span>
            </span>
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
                  Run Agent 1 ({runnableProducts.length})
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
                    Select products, then run in sequence (~2 min each). After a successful run they
                    move to <strong>Awaiting review</strong>. Use{' '}
                    <strong>Select Branch Basics</strong> to run only that product.
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
                      disabled={batchBusy}
                      onClick={selectBranchBasicsOnly}
                      className="rounded-lg border border-violet-200 bg-violet-50 px-2 py-1 text-[11px] font-semibold text-violet-900 hover:bg-violet-100 disabled:opacity-50"
                    >
                      Select Branch Basics
                    </button>
                    <button
                      type="button"
                      disabled={batchBusy}
                      onClick={selectValidationBatch}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Select validation (3)
                    </button>
                    <button
                      type="button"
                      disabled={batchBusy}
                      onClick={selectCacheTestBatch}
                      className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-900 hover:bg-emerald-100 disabled:opacity-50"
                    >
                      Select cache test (5)
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
                      : `Run Agent 1 on selected (${selectedRunnable.length})`}
                  </button>
                </div>
              ) : null}
            </div>
            <ul className="max-h-[65dvh] divide-y divide-slate-100 overflow-auto">
              {listProducts.length === 0 ? (
                <li className="p-4 text-sm text-slate-600">
                  {listFilter === 'review'
                    ? 'Nothing awaiting review.'
                    : listFilter === 'run'
                      ? 'Nothing to run. New or reset products and retries after reject appear here.'
                      : 'No products found.'}
                </li>
              ) : (
                listProducts.map((p) => {
                  const isSelected = listFilter !== 'run' && p.product_id === selectedId
                  const hasEvidence = evidenceByProductId.has(p.product_id)
                  const runnable = canShowOnAgent1RunTab(p)
                  const checked = selectedRunIds.has(p.product_id)
                  const rowBody = (
                    <>
                      <div className="font-semibold text-ink-900">{p.product_name}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <StatusPill status={p.agent_status} />
                        {listFilter !== 'run' && hasEvidence ? (
                          <span className="text-[10px] font-semibold text-violet-700">
                            Ready to review
                          </span>
                        ) : listFilter === 'run' && runnable ? (
                          <span className="text-[10px] font-semibold text-emerald-800">
                            Ready to run
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs text-slate-600">
                        {p.brand ?? '—'} · {p.category ?? '—'}
                      </p>
                    </>
                  )
                  return (
                    <li key={p.product_id}>
                      <div
                        className={`flex w-full transition ${
                          isSelected || (listFilter === 'run' && checked)
                            ? 'bg-violet-50'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        {listFilter === 'run' && runnable ? (
                          <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-0 px-3 py-3">
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={batchBusy}
                              onChange={() => toggleRunSelection(p.product_id)}
                              className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300"
                            />
                            <span className="min-w-0 flex-1 pl-3 text-left">{rowBody}</span>
                          </label>
                        ) : (
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
                            {rowBody}
                          </button>
                        )}
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
            <RunTabPanel
              selectedProduct={null}
              selectedRunnable={selectedRunnable}
              batchProgress={batchProgress}
              busyId={busyId}
              onRunSingle={(productId, productName) => handleRunAgent1(productId, productName)}
            />
          ) : !selectedProduct ? (
            <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-600">
              Select a product from the list to view evidence and approve or reject.
            </div>
          ) : selectedEvidence ? (
            <ReviewCard
              product={selectedProduct}
              evidence={selectedEvidence}
              busy={busyId === selectedProduct.product_id}
              showRejectNotes={rejecting}
              rejectNotes={rejectNotes}
              onRejectNotesChange={setRejectNotes}
              onApprove={() =>
                handleApprove(selectedEvidence.evidence_id, selectedProduct.product_id)
              }
              onRejectOpen={() => setRejecting(true)}
              onRejectCancel={() => {
                setRejecting(false)
                setRejectNotes('')
              }}
              onRejectConfirm={() =>
                handleReject(selectedEvidence.evidence_id, selectedProduct.product_id)
              }
              onRerun={
                canRerunAgent1FromReviewCard(
                  selectedProduct.agent_status,
                  selectedProduct.product_id,
                )
                  ? () =>
                      handleRunAgent1(
                        selectedProduct.product_id,
                        selectedProduct.product_name,
                      )
                  : undefined
              }
            />
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
              <h3 className="text-lg font-semibold text-ink-900">
                {selectedProduct.product_name}
              </h3>
              <p className="mt-2 text-sm text-slate-600">
                {selectedProduct.brand ?? '—'} · {selectedProduct.category ?? '—'}
                {selectedProduct.subcategory ? ` · ${selectedProduct.subcategory}` : ''}
              </p>
              <div className="mt-3">
                <StatusPill status={selectedProduct.agent_status} />
              </div>
              <p className="mt-4 text-sm text-slate-700">
                {selectedProduct.agent_status === 'evidence_pending'
                  ? 'The last Agent 1 run did not save a submitted bundle (server error or threshold failure). Re-run from the Run Agent 1 tab after restarting npm run dev if you recently pulled fixes.'
                  : selectedProduct.agent_status === 'evidence_awaiting_review'
                    ? 'Evidence is awaiting review but could not be loaded. Refresh the page; if it persists, sign in with Supabase Auth.'
                    : 'No submitted evidence packet for this product yet.'}
              </p>
              {canShowOnAgent1RunTab(selectedProduct) ? (
                <button
                  type="button"
                  disabled={busyId === selectedProduct.product_id}
                  onClick={() =>
                    handleRunAgent1(selectedProduct.product_id, selectedProduct.product_name)
                  }
                  className="mt-4 rounded-xl bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-700 disabled:opacity-60"
                >
                  {busyId === selectedProduct.product_id
                    ? 'Running Agent 1…'
                    : isAgent1Rerun(selectedProduct.agent_status)
                      ? 'Re-run Agent 1'
                      : 'Run Agent 1'}
                </button>
              ) : null}
            </div>
          )}
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Run products on <strong>Run Agent 1</strong>. After a successful run they always move to{' '}
        <strong>Awaiting review</strong>. Re-run from Run when unscored, failed, or after
        reject/approve; re-run Lodge / Branch Basics / HexClad from the review card while awaiting
        review.
      </p>
    </div>
  )
}

function ReviewCard({
  product,
  evidence,
  busy,
  showRejectNotes,
  rejectNotes,
  onRejectNotesChange,
  onApprove,
  onRejectOpen,
  onRejectCancel,
  onRejectConfirm,
  onRerun,
}: {
  product: ProductPipelineRow
  evidence: ProductEvidence
  busy: boolean
  showRejectNotes: boolean
  rejectNotes: string
  onRejectNotesChange: (v: string) => void
  onApprove: () => void
  onRejectOpen: () => void
  onRejectCancel: () => void
  onRejectConfirm: () => void
  onRerun?: () => void
}) {
  const warnings = getWarnings(evidence.agent_metadata ?? {})
  const facts = evidence.facts ?? []
  const gaps = getEvidenceGaps(facts)
  const structured = getStructuredEvidence(evidence.agent_metadata ?? {})
  const displayFacts = getDisplayFacts(facts)
  const threshold = evidence.agent_metadata.minimum_threshold
  const apiUsageLine = formatAgent1ApiUsage(evidence.agent_metadata.api_usage)

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
          Bundle v{evidence.bundle_version} · {evidence.algorithm_version} · submitted{' '}
          {evidence.submitted_at
            ? new Date(evidence.submitted_at).toLocaleString()
            : '—'}
        </p>
        {apiUsageLine ? (
          <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700 ring-1 ring-slate-200">
            <span className="font-semibold text-ink-900">Last run API usage:</span> {apiUsageLine}
          </p>
        ) : null}
      </header>

      <Section title={`Sources (${evidence.sources.length})`}>
        <ul className="space-y-2">
          {evidence.sources.map((s, i) => (
            <li
              key={`${s.url}-${i}`}
              className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2 text-sm"
            >
              <span className="mr-2 inline-block rounded-md bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 ring-1 ring-slate-200">
                {s.source_type}
              </span>
              <a
                href={s.url}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-ink-900 underline decoration-slate-300 underline-offset-2 hover:decoration-ink-900"
              >
                {s.title}
              </a>
              <p className="mt-1 break-all text-xs text-slate-500">{s.url}</p>
            </li>
          ))}
        </ul>
      </Section>

      {structured ? <StructuredEvidenceSection structured={structured} /> : null}

      <Section title={`Facts (${displayFacts.length})`}>
        <div className="space-y-3">
          {(displayFacts ?? []).map((fact, i) => (
            <div
              key={`${fact.fact_key}-${i}`}
              className="rounded-xl border border-slate-100 bg-white px-3 py-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <code className="text-xs font-semibold text-ink-900">{fact.fact_key}</code>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${confidenceBadgeClass(fact.confidence)}`}
                >
                  {fact.confidence}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-800">{formatFactValue(fact.fact_value)}</p>
              {fact.excerpt ? (
                <blockquote className="mt-2 border-l-2 border-slate-200 pl-3 text-xs italic text-slate-600">
                  &ldquo;{fact.excerpt}&rdquo;
                </blockquote>
              ) : null}
              {fact.source_url ? (
                <p className="mt-1 break-all text-[10px] text-slate-500">
                  <a href={fact.source_url} target="_blank" rel="noreferrer" className="underline">
                    {fact.source_url}
                  </a>
                </p>
              ) : fact.source_index != null && (evidence.sources ?? [])[fact.source_index] ? (
                <p className="mt-1 text-[10px] text-slate-500">
                  Source [{fact.source_index}]:{' '}
                  {(evidence.sources ?? [])[fact.source_index].source_type}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </Section>

      <Section title={`Warnings (${warnings.length})`}>
        {warnings.length === 0 ? (
          <p className="text-sm text-slate-600">None recorded.</p>
        ) : (
          <ul className="list-disc space-y-1 pl-5 text-sm text-amber-900">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Minimum threshold">
        {threshold ? (
          <div className="space-y-2">
            <p
              className={`text-sm font-semibold ${threshold.met ? 'text-emerald-800' : 'text-red-800'}`}
            >
              {threshold.met ? 'All four checks passed' : 'One or more checks failed'}
            </p>
            <ul className="grid gap-1 sm:grid-cols-2">
              {Object.entries(threshold.checks).map(([key, ok]) => (
                <li
                  key={key}
                  className={`rounded-lg px-2 py-1 text-xs ${ok ? 'bg-emerald-50 text-emerald-900' : 'bg-red-50 text-red-900'}`}
                >
                  {ok ? '✓' : '✗'} {key.replace(/_/g, ' ')}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-slate-600">No threshold metadata on this packet.</p>
        )}
      </Section>

      <Section title="Evidence gaps">
        {gaps.length === 0 ? (
          <p className="text-sm text-slate-600">No gaps fact recorded.</p>
        ) : (
          gaps.map((g, i) => (
            <div
              key={i}
              className="rounded-xl border border-orange-100 bg-orange-50/50 p-3 text-sm text-orange-950"
            >
              {formatFactValue(g.fact_value)}
            </div>
          ))
        )}
      </Section>

      <footer className="sticky bottom-0 mt-6 flex flex-wrap gap-2 border-t border-slate-100 bg-white pt-4">
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
          disabled={busy}
          onClick={onRejectOpen}
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-800 hover:bg-red-100 disabled:opacity-60"
        >
          Reject
        </button>
        {onRerun ? (
          <button
            type="button"
            disabled={busy}
            onClick={onRerun}
            className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-900 hover:bg-violet-100 disabled:opacity-60"
          >
            Re-run Agent 1
          </button>
        ) : null}
      </footer>

      {showRejectNotes ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50/50 p-4">
          <label className="block text-xs font-semibold text-red-900">Rejection notes</label>
          <textarea
            value={rejectNotes}
            onChange={(e) => onRejectNotesChange(e.target.value)}
            rows={4}
            placeholder="Why is this evidence packet being rejected?"
            className="mt-2 w-full rounded-xl border border-red-200 bg-white px-3 py-2 text-sm"
          />
          <div className="mt-3 flex gap-2">
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
    </article>
  )
}

function RunTabPanel({
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
  onRunSingle: (productId: string, productName: string) => void
}) {
  if (batchProgress) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-card">
        <p className="text-sm font-semibold text-ink-900">Running Agent 1</p>
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
          <StatusPill status={selectedProduct.agent_status} />
        </div>
        <p className="mt-4 text-sm text-slate-700">
          Agent 1 will research this product and submit an evidence packet. After a successful run,
          open <strong>Awaiting review</strong> to approve or reject.
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            onRunSingle(selectedProduct.product_id, selectedProduct.product_name)
          }
          className="mt-4 rounded-xl bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-700 disabled:opacity-60"
        >
          {busy
            ? 'Running Agent 1…'
            : isAgent1Rerun(selectedProduct.agent_status)
              ? 'Re-run Agent 1 on this product'
              : 'Run Agent 1 on this product'}
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
          Use <strong>Run Agent 1 on selected</strong> in the left panel to start the batch.
        </p>
      </div>
    )
  }

  return (
    <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center shadow-card">
      <div className="max-w-sm space-y-2">
        <p className="text-sm font-semibold text-ink-900">Run Agent 1 on new products</p>
        <p className="text-sm text-slate-600">
          Check products on the left, then use <strong>Run Agent 1 on selected</strong> in the left
          panel. No per-product detail here — batch only.
        </p>
      </div>
    </div>
  )
}

function StructuredEvidenceSection({
  structured,
}: {
  structured: NonNullable<ReturnType<typeof getStructuredEvidence>>
}) {
  const pcm = structured.primary_contact_material
  const certs = structured.certifications
  const sc = structured.safety_claims

  return (
    <Section title="Structured evidence (schema v1)">
      <div className="space-y-4 text-sm">
        {pcm ? (
          <div className="rounded-xl border border-violet-100 bg-violet-50/50 px-3 py-2">
            <p className="text-xs font-semibold uppercase text-violet-800">Primary contact</p>
            <p className="mt-1 text-ink-900">
              {pcm.undisclosed_code ?? pcm.material_identity ?? '—'}
            </p>
            {pcm.source_url ? (
              <a href={pcm.source_url} className="mt-1 block break-all text-xs text-violet-900 underline">
                {pcm.source_url}
              </a>
            ) : null}
          </div>
        ) : null}

        <div>
          <p className="text-xs font-semibold uppercase text-slate-600">Verified certifications</p>
          {(certs?.verified_certifications ?? []).length === 0 ? (
            <p className="mt-1 text-slate-600">None verified in certifying-body registries.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {certs?.verified_certifications?.map((v) => (
                <li key={v.cert_name} className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1.5">
                  <span className="font-medium text-emerald-900">{v.cert_name}</span>
                  {(v.source_url ?? v.registry_url ?? v.page_source_url) ? (
                    <a
                      href={v.source_url ?? v.registry_url ?? v.page_source_url ?? '#'}
                      className="mt-0.5 block break-all text-[10px] text-emerald-800 underline"
                    >
                      {v.source_url ?? v.registry_url ?? v.page_source_url}
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <p className="text-xs font-semibold uppercase text-slate-600">Claimed but not verified</p>
          {(certs?.claimed_but_not_verified ?? []).length === 0 ? (
            <p className="mt-1 text-slate-600">None.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {certs?.claimed_but_not_verified?.map((r) => (
                <li key={r.cert_name} className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5">
                  <span className="font-medium text-amber-950">{r.cert_name}</span>
                  <p className="text-[10px] text-amber-900">{r.registry_check_result}</p>
                  {r.claim_source_url ? (
                    <a
                      href={r.claim_source_url}
                      className="block break-all text-[10px] underline"
                    >
                      {r.claim_source_url}
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        {sc ? (
          <div>
            <p className="text-xs font-semibold uppercase text-slate-600">Safety claims</p>
            <ul className="mt-2 space-y-1 text-slate-800">
              {sc.pfas_free_claim?.claimed ? (
                <li>
                  PFAS-Free
                  {sc.pfas_free_claim.structural_guarantee ? ' (structural)' : ''}
                  {sc.pfas_free_claim.source_url ? (
                    <span className="block break-all text-[10px] text-slate-500">
                      {sc.pfas_free_claim.source_url}
                    </span>
                  ) : null}
                </li>
              ) : null}
              {sc.non_toxic_claim?.claimed ? (
                <li>
                  Non-toxic
                  {sc.non_toxic_claim.structural_guarantee ? ' (structural)' : ''}
                  {sc.non_toxic_claim.source_url ? (
                    <span className="block break-all text-[10px] text-slate-500">
                      {sc.non_toxic_claim.source_url}
                    </span>
                  ) : null}
                </li>
              ) : null}
              {sc.bpa_free_claim?.claimed ? (
                <li>
                  BPA-free
                  {sc.bpa_free_claim.source_url ? (
                    <span className="block break-all text-[10px] text-slate-500">
                      {sc.bpa_free_claim.source_url}
                    </span>
                  ) : null}
                </li>
              ) : null}
            </ul>
          </div>
        ) : null}
      </div>
    </Section>
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

function StatusPill({ status }: { status: string }) {
  const tone =
    status === 'evidence_awaiting_review'
      ? 'bg-violet-100 text-violet-900'
      : status === 'evidence_approved'
        ? 'bg-emerald-100 text-emerald-900'
        : status === 'evidence_rejected'
          ? 'bg-red-100 text-red-900'
          : status === 'evidence_in_progress'
            ? 'bg-blue-100 text-blue-900'
            : 'bg-slate-100 text-slate-700'

  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${tone}`}>
      {humanizeAgentStatus(status)}
    </span>
  )
}
