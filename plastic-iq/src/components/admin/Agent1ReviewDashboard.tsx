import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatSupabaseUnknownError } from '../../lib/supabaseClient'
import {
  approveEvidence,
  AGENT1_TFAL_PRODUCT_ID,
  canRerunAgent1FromReviewCard,
  agent1RunTabDisplayStatus,
  canShowOnAgent1RunTab,
  requiresFullPipelineResetBeforeAgent1Run,
  showAgent1RetestResetButton,
  resetAgent1ForRetestRemote,
  isAgent1ValidationRerunProduct,
  fetchAgent1Dashboard,
  fetchLatestPendingEvidenceForProduct,
  humanizeAgentStatus,
  rejectEvidence,
  runAgent1Batch,
  runAgent1Remote,
} from '../../lib/agent1Review'
import { NORMALIZATION_PIPELINE_STATUSES } from '../../lib/agent2Review'
import { Gate1EvidenceReviewPanel } from './Gate1EvidenceReviewPanel'
import { Agent1RunRightPanel } from './Agent1RunRightPanel'
import { fetchActiveApprovedEvidence } from '../../lib/evidenceVersionApi'
import type {
  Agent1DashboardData,
  ProductEvidence,
  ProductPipelineRow,
} from '../../types/agent'
import { AGENT_STATUSES } from '../../types/agent'

type PendingReviewEntry = Agent1DashboardData['pendingReview'][number]

type Props = {
  authUserEmail: string | null
  initialProductId?: string | null
  onNotice: (message: string | null) => void
  onError: (message: string | null) => void
}

export function Agent1ReviewDashboard({
  authUserEmail,
  initialProductId,
  onNotice,
  onError,
}: Props) {
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
  const [viewApprovedEvidence, setViewApprovedEvidence] = useState<ProductEvidence | null>(null)
  const [loadingApprovedEvidence, setLoadingApprovedEvidence] = useState(false)
  const [resolvedPendingEvidence, setResolvedPendingEvidence] = useState<ProductEvidence | null>(
    null,
  )
  const [loadingPendingEvidence, setLoadingPendingEvidence] = useState(false)
  /** Keeps just-finished runs visible on Awaiting review before dashboard reload catches up. */
  const [postRunReviewEntries, setPostRunReviewEntries] = useState<PendingReviewEntry[]>([])
  /** Avoid re-applying pipeline focus selection on every dashboard reload. */
  const [appliedInitialProductId, setAppliedInitialProductId] = useState<string | null>(null)

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

  const mergedPendingReview = useMemo(() => {
    if (!data) return postRunReviewEntries
    const ids = new Set(data.pendingReview.map((x) => x.product.product_id))
    const extra = postRunReviewEntries.filter((x) => !ids.has(x.product.product_id))
    return [...data.pendingReview, ...extra].sort((a, b) =>
      a.product.product_name.localeCompare(b.product.product_name),
    )
  }, [data, postRunReviewEntries])

  const evidenceByProductId = useMemo(() => {
    const map = new Map<string, ProductEvidence>()
    for (const item of mergedPendingReview) {
      if (item.evidence) map.set(item.product.product_id, item.evidence)
    }
    return map
  }, [mergedPendingReview])

  const reviewQueue = useMemo(() => {
    return mergedPendingReview.map((x) => x.product)
  }, [mergedPendingReview])

  const reviewQueueWithEvidence = useMemo(() => {
    return mergedPendingReview.filter((x) => x.evidence != null)
  }, [mergedPendingReview])

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

  useEffect(() => {
    if (!data) return
    const tfal = data.products.find((p) => p.product_id === AGENT1_TFAL_PRODUCT_ID)
    if (tfal?.agent_status === 'unscored') {
      setPostRunReviewEntries((prev) =>
        prev.filter((x) => x.product.product_id !== AGENT1_TFAL_PRODUCT_ID),
      )
    }
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

  const batchBusy = batchProgress !== null || busyId !== null

  const selectedProduct = useMemo(() => {
    if (!data || !selectedId) return null
    return data.products.find((p) => p.product_id === selectedId) ?? null
  }, [data, selectedId])

  const selectedPendingEvidence = selectedId ? evidenceByProductId.get(selectedId) : undefined

  const selectedPendingEntry = useMemo(() => {
    if (!selectedId) return null
    return mergedPendingReview.find((x) => x.product.product_id === selectedId) ?? null
  }, [mergedPendingReview, selectedId])

  useEffect(() => {
    setResolvedPendingEvidence(null)
    if (!selectedProduct || selectedPendingEvidence) {
      setLoadingPendingEvidence(false)
      return
    }
    if (selectedProduct.agent_status !== 'evidence_awaiting_review') {
      setLoadingPendingEvidence(false)
      return
    }

    let cancelled = false
    setLoadingPendingEvidence(true)
    fetchLatestPendingEvidenceForProduct(selectedProduct.product_id)
      .then((row) => {
        if (!cancelled) setResolvedPendingEvidence(row)
      })
      .catch(() => {
        if (!cancelled) setResolvedPendingEvidence(null)
      })
      .finally(() => {
        if (!cancelled) setLoadingPendingEvidence(false)
      })

    return () => {
      cancelled = true
    }
  }, [selectedProduct, selectedPendingEvidence])

  useEffect(() => {
    if (!selectedProduct || selectedPendingEvidence || resolvedPendingEvidence) {
      setViewApprovedEvidence(null)
      return
    }
    const shouldLoad =
      selectedProduct.agent_status === 'evidence_approved' ||
      listFilter === 'all' ||
      listFilter === 'review'
    if (!shouldLoad) {
      setViewApprovedEvidence(null)
      return
    }
    let cancelled = false
    setLoadingApprovedEvidence(true)
    fetchActiveApprovedEvidence(selectedProduct.product_id)
      .then((row) => {
        if (!cancelled) setViewApprovedEvidence(row)
      })
      .catch(() => {
        if (!cancelled) setViewApprovedEvidence(null)
      })
      .finally(() => {
        if (!cancelled) setLoadingApprovedEvidence(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectedProduct, selectedPendingEvidence, resolvedPendingEvidence, listFilter])

  const selectedEvidence =
    selectedPendingEvidence ?? resolvedPendingEvidence ?? viewApprovedEvidence ?? undefined

  useEffect(() => {
    if (!initialProductId || !data || appliedInitialProductId === initialProductId) return
    const row = data.products.find((p) => p.product_id === initialProductId)
    if (row && canShowOnAgent1RunTab(row)) {
      setListFilter('run')
      setSelectedRunIds(new Set([initialProductId]))
      setSelectedId(null)
      setAppliedInitialProductId(initialProductId)
      return
    }
    setSelectedId(initialProductId)
    setListFilter('review')
    setAppliedInitialProductId(initialProductId)
  }, [initialProductId, data, appliedInitialProductId])

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

    if (requiresFullPipelineResetBeforeAgent1Run(product.agent_status)) {
      onError(
        `${product.product_name} is past Gate 1 (${humanizeAgentStatus(product.agent_status)}). Wipe agents 1–4 before re-running Agent 1 from scratch.`,
      )
      return
    }

    const needsFreshReset = showAgent1RetestResetButton(product.agent_status, productId)

    setBusyId(productId)
    setBatchProgress({ current: 0, total: 1, name: product.product_name })
    onError(null)
    onNotice(`Starting Agent 1 for ${product.product_name}…`)
    try {
      if (needsFreshReset) {
        const outcome = await resetAgent1ForRetestRemote(productId)
        onNotice(outcome.message ?? 'Reset complete. Starting Agent 1…')
        setPostRunReviewEntries((prev) => prev.filter((x) => x.product.product_id !== productId))
        setSelectedId(null)
        await load()
      }
      onNotice('Agent 1 running… this may take 1–2 minutes. Watch your Anthropic usage dashboard.')
      const outcome = await runAgent1Remote(productId)
      onNotice(
        outcome.ok
          ? outcome.message ?? 'Agent 1 finished. Refreshing…'
          : outcome.message ?? 'Agent 1 finished with issues.',
      )
      await load()
      setSelectedId(productId)
      if (outcome.ok) {
        const product =
          data?.products.find((p) => p.product_id === productId) ??
          ({ product_id: productId, product_name: productName ?? 'Product' } as ProductPipelineRow)
        const evidence = await fetchLatestPendingEvidenceForProduct(productId)
        if (evidence) {
          setPostRunReviewEntries((prev) => {
            const rest = prev.filter((x) => x.product.product_id !== productId)
            return [...rest, { product, evidence }]
          })
        }
        setListFilter('review')
      } else setListFilter('run')
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
      setBatchProgress(null)
    }
  }

  function toggleRunSelection(productId: string) {
    setSelectedId(null)
    setSelectedRunIds((prev) => {
      const next = new Set(prev)
      if (next.has(productId)) next.delete(productId)
      else next.add(productId)
      return next
    })
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
      setViewApprovedEvidence(null)
      setResolvedPendingEvidence(null)
    } else if (filter === 'review' && reviewQueue.length > 0) {
      setSelectedId((id) => id ?? reviewQueue[0].product_id)
    }
  }

  useEffect(() => {
    if (listFilter === 'run' && selectedId) setSelectedId(null)
  }, [listFilter, selectedId])

  async function handleRunBatch() {
    if (selectedRunnable.length === 0) {
      if (selectedRunIds.size > 0) {
        onError(
          'Checked product(s) are not runnable here — only unscored or failed Agent 1 rows appear on Run Agent 1. Open All products for other statuses, or use Retest from Awaiting review.',
        )
      } else {
        onError('No product selected. Check one or more products below, then click Run Agent 1.')
      }
      onNotice(null)
      return
    }
    const pipelineBlocked = selectedRunnable.find((p) =>
      requiresFullPipelineResetBeforeAgent1Run(p.agent_status),
    )
    if (pipelineBlocked) {
      onError(
        `${pipelineBlocked.product_name} is past Gate 1 (${humanizeAgentStatus(pipelineBlocked.agent_status)}). Wipe agents 1–4 before re-running Agent 1.`,
      )
      return
    }
    const freshResets = selectedRunnable.filter((p) =>
      showAgent1RetestResetButton(p.agent_status, p.product_id),
    )

    const firstName = selectedRunnable[0]?.product_name ?? ''
    onError(null)
    setBatchProgress({ current: 0, total: selectedRunnable.length, name: firstName })
    onNotice(
      `Starting Agent 1 for ${selectedRunnable.map((p) => p.product_name).join(', ')}…`,
    )

    try {
      for (const p of freshResets) {
        await resetAgent1ForRetestRemote(p.product_id)
        setPostRunReviewEntries((prev) => prev.filter((x) => x.product.product_id !== p.product_id))
      }
      if (freshResets.length) await load()

      const results = await runAgent1Batch(selectedRunnable, (current, total, name) => {
        setBatchProgress({ current, total, name })
      })

      const succeeded = results.filter((r) => r.ok).length
      const failures = results.filter((r) => !r.ok)
      if (failures.length > 0) {
        const reasons = failures
          .map((r) => `${r.productName}: ${r.message ?? 'run failed'}`)
          .join(' · ')
        onError(
          `Batch complete: ${succeeded} submitted for review, ${failures.length} did not submit. ${reasons}`,
        )
      } else {
        onNotice(`Batch complete: ${succeeded} submitted for review.`)
      }
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
              {data.products.length} products · {reviewQueueWithEvidence.length} awaiting review
              {reviewQueue.length > reviewQueueWithEvidence.length
                ? ` (${reviewQueue.length - reviewQueueWithEvidence.length} need evidence load)`
                : ''}
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
                  Awaiting review ({reviewQueueWithEvidence.length})
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
                    Check one or more products, then click <strong>Run Agent 1</strong>. To re-run
                    after a finished pass, use <strong>Re-run Agent 1</strong> on the Awaiting
                    review card (clears the bundle and returns here as unscored).
                  </p>
                  {selectedRunIds.size > 0 ? (
                    <p className="text-[11px] font-semibold text-violet-800">
                      {selectedRunnable.length} selected
                      {selectedRunnable.length !== selectedRunIds.size
                        ? ` (${selectedRunIds.size - selectedRunnable.length} not runnable on this tab)`
                        : ''}
                    </p>
                  ) : null}
                  {selectedRunIds.size > 0 ? (
                    <button
                      type="button"
                      disabled={batchBusy}
                      onClick={clearRunSelection}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Clear selection
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={batchBusy || selectedRunnable.length === 0}
                    onClick={() => void handleRunBatch()}
                    className="w-full rounded-xl bg-ink-900 px-3 py-2 text-xs font-semibold text-white hover:bg-ink-700 disabled:opacity-60"
                  >
                    {batchBusy
                      ? batchProgress
                        ? batchProgress.current === 0
                          ? `Starting Agent 1 (${batchProgress.total})…`
                          : `Running ${batchProgress.current}/${batchProgress.total}: ${batchProgress.name}`
                        : 'Running…'
                      : selectedRunnable.length === 1
                        ? 'Run Agent 1'
                        : `Run Agent 1 (${selectedRunnable.length})`}
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
                      ? 'Nothing to run. Unscored, failed, or awaiting-review products appear here.'
                      : 'No products found.'}
                </li>
              ) : (
                listProducts.map((p) => {
                  const checked = selectedRunIds.has(p.product_id)
                  const isSelected =
                    listFilter === 'run' ? checked : p.product_id === selectedId
                  const hasEvidence = evidenceByProductId.has(p.product_id)
                  const runnable = canShowOnAgent1RunTab(p)
                  const rowBody = (
                    <>
                      <div className="font-semibold text-ink-900">{p.product_name}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <StatusPill
                          status={
                            listFilter === 'run'
                              ? agent1RunTabDisplayStatus(p.agent_status)
                              : p.agent_status
                          }
                        />
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
                          isSelected ? 'bg-violet-50'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        {listFilter === 'run' && runnable ? (
                          <label className="flex w-full cursor-pointer items-start gap-2 px-3 py-3">
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={batchBusy}
                              onChange={() => toggleRunSelection(p.product_id)}
                              className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300"
                            />
                            <span className="min-w-0 flex-1 text-left">{rowBody}</span>
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
            <Agent1RunRightPanel
              selectedRunnable={selectedRunnable}
              runnableCount={runnableProducts.length}
              batchProgress={batchProgress}
              busyId={busyId}
            />
          ) : !selectedProduct ? (
            <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-600">
              Select a product from the list to view evidence and approve or reject.
            </div>
          ) : selectedEvidence ? (
            <Gate1EvidenceReviewPanel
              product={selectedProduct}
              evidence={selectedEvidence}
              authUserEmail={authUserEmail}
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
              onEvidenceSaved={(saved) => {
                setViewApprovedEvidence(null)
                setData((prev) => {
                  if (!prev) return prev
                  const pendingReview = prev.pendingReview.map((item) =>
                    item.product.product_id === saved.product_id
                      ? { ...item, evidence: saved }
                      : item,
                  )
                  return { ...prev, pendingReview }
                })
              }}
            />
          ) : loadingApprovedEvidence || loadingPendingEvidence ? (
            <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-600">
              {loadingPendingEvidence ? 'Loading pending evidence…' : 'Loading evidence version…'}
            </div>
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
                    ? selectedPendingEntry?.evidenceMismatch === 'draft_not_pending_review'
                      ? 'Product status is awaiting review, but the latest evidence row is draft (threshold queue), not pending_review. Status/evidence mismatch.'
                      : 'Product status is awaiting review, but no pending_review evidence row exists. Status/evidence mismatch.'
                    : 'No submitted evidence packet for this product yet.'}
              </p>
              {selectedProduct.agent_status === 'evidence_in_progress' ? (
                <p className="mt-4 text-xs text-amber-800">Agent 1 is already running for this product.</p>
              ) : null}
            </div>
          )}
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Check products on <strong>Run Agent 1</strong>, then run once. After success they move to{' '}
        <strong>Awaiting review</strong>.
      </p>
    </div>
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
