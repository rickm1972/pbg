import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { formatSupabaseUnknownError } from '../../lib/supabaseClient'
import {
  approveNormalization,
  canRerunAgent2FromReviewCard,
  showOnAgent2ReviewTab,
  showOnAgent2RunTab,
  isAgent2FailedDraftStuck,
  fetchAgent2Dashboard,
  hasNormalizationRun,
  humanizeAgentStatus,
  NORMALIZATION_PIPELINE_STATUSES,
  rejectNormalization,
  runAgent2Batch,
  runAgent2Remote,
  checkAgent2ServerHealth,
  EXPECTED_AGENT2_DESCRIPTION_GENERATOR_VERSION,
  isAgent2DescriptionGeneratorCurrent,
  isCookwarePipelineProduct,
} from '../../lib/agent2Review'
import { AGENT_STATUSES } from '../../types/agent'
import type { Agent2DashboardData, ProductPipelineRow, ScoringInputRow } from '../../types/agent'
import { Gate2NormalizationReviewPanel } from './Gate2NormalizationReviewPanel'
import { WhyThisScoreAdmin } from '../WhyThisScoreAdmin'
import {
  Gate2Section,
  NormalizationComponentBlock,
  ProductDescriptionSection,
  Layer4aSection,
  whyFieldsFromScoringInput,
} from './gate2NormalizationDisplay'

type Props = {
  authUserEmail: string | null
  initialProductId?: string | null
  onNavigateToGate?: (tab: 'agent1' | 'agent2' | 'agent3', productId: string) => void
  onNotice: (message: string | null) => void
  onError: (message: string | null) => void
}

export function Agent2ReviewDashboard({
  authUserEmail,
  initialProductId,
  onNavigateToGate,
  onNotice,
  onError,
}: Props) {
  const [data, setData] = useState<Agent2DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState(false)
  const [rejectNotes, setRejectNotes] = useState('')
  const [listFilter, setListFilter] = useState<'review' | 'run' | 'testing' | 'all'>('run')
  const [selectedRunIds, setSelectedRunIds] = useState<Set<string>>(() => new Set())
  const [batchProgress, setBatchProgress] = useState<{
    current: number
    total: number
    name: string
  } | null>(null)
  /** Validation products moved to Awaiting review after a successful run this session. */
  const [readyForReviewAfterRunIds, setReadyForReviewAfterRunIds] = useState<Set<string>>(
    () => new Set(),
  )
  const initialTabSet = useRef(false)
  const [apiHealth, setApiHealth] = useState<{
    ok: boolean
    description_generator_version?: string | null
  } | null>(null)
  /** Visible on Run tab when batch/single run needs a clearer nudge than top-of-page error. */
  const [runTabHint, setRunTabHint] = useState<string | null>(null)
  const [runTabBusy, setRunTabBusy] = useState(false)

  const loadApiHealth = useCallback(async () => {
    const health = await checkAgent2ServerHealth()
    setApiHealth(health)
  }, [])

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
    void loadApiHealth()
  }, [load, loadApiHealth])

  const scoringInputByProductId = useMemo(() => {
    const map = new Map<string, ScoringInputRow>()
    if (!data) return map
    for (const [productId, row] of Object.entries(data.latestScoringByProductId ?? {})) {
      map.set(productId, row)
    }
    return map
  }, [data])

  const latestScoringFor = useCallback(
    (productId: string) => scoringInputByProductId.get(productId),
    [scoringInputByProductId],
  )

  const reviewQueue = useMemo(() => {
    if (!data) return []
    return data.products
      .filter((p) =>
        showOnAgent2ReviewTab(
          p,
          readyForReviewAfterRunIds,
          data.latestScoringByProductId[p.product_id],
        ),
      )
      .sort((a, b) => a.product_name.localeCompare(b.product_name))
  }, [data, readyForReviewAfterRunIds])

  const testingQueueProducts = useMemo(() => {
    if (!data) return []
    return data.testingQueue.map((x) => x.product)
  }, [data])

  const runnableProducts = useMemo(() => {
    if (!data) return []
    return data.products
      .filter((p) => showOnAgent2RunTab(p, readyForReviewAfterRunIds, latestScoringFor(p.product_id)))
      .sort((a, b) => a.product_name.localeCompare(b.product_name))
  }, [data, readyForReviewAfterRunIds])

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
  }, [data, runnableProducts, selectedRunIds, readyForReviewAfterRunIds])

  const batchBusy = batchProgress !== null

  const selectedProduct = useMemo(() => {
    if (!data || !selectedId) return null
    return data.products.find((p) => p.product_id === selectedId) ?? null
  }, [data, selectedId])

  const selectedItem = useMemo(() => {
    if (!data || !selectedId) return null
    const fromPending = data.pendingReview.find((x) => x.product.product_id === selectedId)
    if (fromPending) return fromPending
    const product = data.products.find((p) => p.product_id === selectedId)
    const scoringInput = data.latestScoringByProductId[selectedId]
    if (
      product &&
      showOnAgent2ReviewTab(product, readyForReviewAfterRunIds, scoringInput)
    ) {
      return { product, scoringInput }
    }
    return null
  }, [data, selectedId, readyForReviewAfterRunIds])

  const selectedTestingItem = useMemo(() => {
    if (!data || !selectedId) return null
    return data.testingQueue.find((x) => x.product.product_id === selectedId) ?? null
  }, [data, selectedId])

  const selectedScoringInput = selectedId ? scoringInputByProductId.get(selectedId) : undefined

  useEffect(() => {
    if (initialProductId) setSelectedId(initialProductId)
  }, [initialProductId])

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

  /** Don’t stay on Awaiting review when the queue is empty (e.g. after a pipeline DB reset). */
  useEffect(() => {
    if (!data) return
    if (listFilter === 'review' && reviewQueue.length === 0 && runnableProducts.length > 0) {
      setListFilter('run')
      setSelectedId(null)
    }
  }, [data, listFilter, reviewQueue.length, runnableProducts.length])

  useEffect(() => {
    if (!data) return
    setReadyForReviewAfterRunIds((prev) => {
      if (prev.size === 0) return prev
      const next = new Set<string>()
      for (const id of prev) {
        const product = data.products.find((p) => p.product_id === id)
        const scoring = data.latestScoringByProductId[id]
        if (product && showOnAgent2ReviewTab(product, prev, scoring)) next.add(id)
      }
      return next.size === prev.size ? prev : next
    })
  }, [data])

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
      setReadyForReviewAfterRunIds((prev) => {
        const next = new Set(prev)
        next.delete(productId)
        return next
      })
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
    setRunTabBusy(true)
    onError(null)
    onNotice(null)
    setRunTabHint('Agent 2 running… leave this tab open (about 1–2 minutes).')
    try {
      onNotice('Agent 2 running… this may take 1–2 minutes.')
      const outcome = await runAgent2Remote(productId)
      onNotice(
        outcome.ok
          ? outcome.message ?? 'Agent 2 finished. Refreshing…'
          : outcome.message ?? 'Agent 2 finished with issues.',
      )
      await load()
      void loadApiHealth()
      if (outcome.ok) {
        setReadyForReviewAfterRunIds((prev) => new Set(prev).add(productId))
        setRunTabHint('Done — open Awaiting review to approve normalization.')
        setListFilter('review')
        setSelectedId(productId)
      } else {
        setRunTabHint(outcome.message ?? 'Agent 2 finished with issues.')
        setListFilter('run')
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Agent 2 run failed'
      onError(msg)
      setRunTabHint(msg)
      setListFilter('run')
    } finally {
      setBusyId(null)
      setRunTabBusy(false)
    }
  }

  function toggleRunSelection(productId: string) {
    setRunTabHint(null)
    setSelectedRunIds((prev) => {
      const next = new Set(prev)
      if (next.has(productId)) next.delete(productId)
      else next.add(productId)
      return next
    })
    setSelectedId(productId)
  }

  function selectAllRunnable() {
    setSelectedRunIds(new Set(runnableProducts.map((p) => p.product_id)))
  }

  function selectCookwareBatch() {
    const ids = runnableProducts
      .filter((p) => isCookwarePipelineProduct(p))
      .map((p) => p.product_id)
    setSelectedRunIds(new Set(ids))
    if (listFilter !== 'run') switchListFilter('run')
  }

  const cookwareRunnableCount = useMemo(
    () => runnableProducts.filter((p) => isCookwarePipelineProduct(p)).length,
    [runnableProducts],
  )

  function clearRunSelection() {
    setSelectedRunIds(new Set())
  }

  function switchListFilter(filter: 'review' | 'run' | 'testing' | 'all') {
    setListFilter(filter)
    setRejecting(false)
    setRejectNotes('')
    setRunTabHint(null)
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

  const runPanelProduct = useMemo(() => {
    if (!data || listFilter !== 'run') return null
    if (selectedRunnable.length === 1) return selectedRunnable[0]
    if (selectedRunnable.length > 1) return null
    if (!selectedId) return null
    const p = data.products.find((row) => row.product_id === selectedId)
    if (!p) return null
    if (!showOnAgent2RunTab(p, readyForReviewAfterRunIds, latestScoringFor(p.product_id))) {
      return null
    }
    return p
  }, [data, listFilter, selectedRunnable, selectedId, readyForReviewAfterRunIds, latestScoringFor])

  async function handleRunBatch() {
    let targets = selectedRunnable
    if (targets.length === 0 && runPanelProduct) {
      targets = [runPanelProduct]
    }
    if (targets.length === 0) {
      const msg = 'Check a product row on the left (checkbox), then click Run.'
      onError(msg)
      setRunTabHint(msg)
      return
    }
    onError(null)
    onNotice(null)
    setRunTabBusy(true)
    setRunTabHint(`Starting Agent 2 on ${targets.length} product(s)…`)
    setBatchProgress({ current: 0, total: targets.length, name: targets[0]?.product_name ?? '' })

    try {
      const results = await runAgent2Batch(targets, (current, total, name) => {
        setBatchProgress({ current, total, name })
        setRunTabHint(`Running ${current}/${total}: ${name}`)
      })

      const succeeded = results.filter((r) => r.ok).length
      const failed = results.filter((r) => !r.ok)
      onNotice(
        `Batch complete: ${succeeded} submitted for review, ${failed.length} failed or skipped.`,
      )
      if (failed.length > 0) {
        const detail = failed
          .slice(0, 3)
          .map((r) => `${r.productName}: ${r.message ?? 'failed'}`)
          .join(' · ')
        const errMsg =
          failed.length === results.length
            ? `Agent 2 did not run. ${detail} — is npm run dev running on port 5173?`
            : `Some failed: ${detail}${failed.length > 3 ? ` (+${failed.length - 3} more)` : ''}`
        onError(errMsg)
        setRunTabHint(errMsg)
      } else {
        setRunTabHint('Batch complete — open Awaiting review.')
      }
      setSelectedRunIds(new Set())
      await load()
      const okIds = results.filter((r) => r.ok).map((r) => r.productId)
      if (okIds.length > 0) {
        setReadyForReviewAfterRunIds((prev) => {
          const next = new Set(prev)
          for (const id of okIds) next.add(id)
          return next
        })
        setListFilter('review')
        setSelectedId(okIds[0])
      } else {
        setListFilter('run')
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Batch run failed'
      onError(msg)
      setRunTabHint(msg)
    } finally {
      setBatchProgress(null)
      setRunTabBusy(false)
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

      {apiHealth && !apiHealth.ok ? (
        <div
          role="alert"
          className="rounded-2xl border-2 border-red-400 bg-red-50 p-4 text-sm text-red-950"
        >
          <p className="font-semibold">Agent 2 API health check failed</p>
          <p className="mt-1">
            Run may still work — try Run Agent 2. If it fails, the error will show below the Run
            button.
          </p>
        </div>
      ) : null}

      {apiHealth && !isAgent2DescriptionGeneratorCurrent(apiHealth.description_generator_version) ? (
        <div className="rounded-2xl border border-red-300 bg-red-50 p-4 text-sm text-red-950">
          <p className="font-semibold">Agent 2 API is not running the current description generator</p>
          <p className="mt-1">
            Health check reports{' '}
            <code className="rounded bg-red-100 px-1">
              {apiHealth.description_generator_version ?? 'missing'}
            </code>
            ; required{' '}
            <code className="rounded bg-red-100 px-1">
              {EXPECTED_AGENT2_DESCRIPTION_GENERATOR_VERSION}
            </code>
            . You are likely on an old <code className="rounded bg-red-100 px-1">localhost:5173</code>{' '}
            tab while a newer dev server is on another port. Use only{' '}
            <a className="font-semibold underline" href="http://localhost:5173/">
              http://localhost:5173/
            </a>{' '}
            after Cursor restarts dev, then re-run Agent 2.
          </p>
        </div>
      ) : null}

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
                    Only <strong>evidence approved</strong> (or <strong>normalization rejected</strong>)
                    . Check the box or click the row to select, then run. After success, products move to{' '}
                    <strong>Awaiting review</strong>.
                  </p>
                  {runTabHint ? (
                    <p className="rounded-lg border border-amber-300 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-950" role="alert">
                      {runTabHint}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={batchBusy || runnableProducts.length === 0}
                      onClick={selectAllRunnable}
                      className="rounded-lg border border-violet-200 bg-violet-50 px-2 py-1 text-[11px] font-semibold text-violet-900 hover:bg-violet-100 disabled:opacity-50"
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      disabled={batchBusy || cookwareRunnableCount === 0}
                      onClick={selectCookwareBatch}
                      className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-900 hover:bg-emerald-100 disabled:opacity-50"
                    >
                      Select Cookware ({cookwareRunnableCount})
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
                    disabled={
                      batchBusy ||
                      (selectedRunnable.length === 0 && !runPanelProduct)
                    }
                    onClick={() => void handleRunBatch()}
                    className="w-full rounded-xl bg-ink-900 px-3 py-2 text-xs font-semibold text-white hover:bg-ink-700 disabled:opacity-60"
                  >
                    {batchBusy
                      ? batchProgress
                        ? `Running ${batchProgress.current}/${batchProgress.total}: ${batchProgress.name}`
                        : 'Running…'
                      : selectedRunnable.length > 0
                        ? `Run Agent 2 on selected (${selectedRunnable.length})`
                        : runPanelProduct
                          ? `Run Agent 2 on ${runPanelProduct.product_name.split(' ').slice(0, 3).join(' ')}…`
                          : 'Run Agent 2 on selected (0)'}
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
                  const scoringInput = scoringInputByProductId.get(p.product_id)
                  const latestScoring = latestScoringFor(p.product_id)
                  const failedDraft = isAgent2FailedDraftStuck(p.agent_status, latestScoring)
                  const runnable = showOnAgent2RunTab(p, readyForReviewAfterRunIds, latestScoring)
                  const checked = selectedRunIds.has(p.product_id)
                  const isSelected =
                    listFilter === 'run' && runnable ? checked : p.product_id === selectedId
                  const rowBody = (
                    <>
                      <div className="font-semibold text-ink-900">{p.product_name}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <NormalizationStatusPill status={p.agent_status} />
                        {p.agent_status === 'in_testing_queue' ? (
                          <span className="text-[10px] font-semibold text-amber-800">
                            Testing queue
                          </span>
                        ) : failedDraft ? (
                          <span className="text-[10px] font-semibold text-red-800">
                            Agent 2 failed — re-run
                          </span>
                        ) : scoringInput &&
                          p.agent_status === 'normalization_awaiting_review' &&
                          scoringInput.review_status === 'pending_review' ? (
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
                    </>
                  )
                  return (
                    <li key={p.product_id}>
                      <div
                        className={`flex w-full transition ${
                          isSelected ? 'bg-violet-50' : 'hover:bg-slate-50'
                        }`}
                      >
                        {listFilter === 'run' && runnable ? (
                          <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2 px-3 py-3">
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
            <Agent2RunTabPanel
              selectedProduct={runPanelProduct}
              selectedRunnable={selectedRunnable}
              batchProgress={batchProgress}
              busyId={busyId}
              runTabHint={runTabHint}
              runTabBusy={runTabBusy || batchBusy}
              onRunSingle={(productId) => void handleRunAgent2(productId)}
            />
          ) : !selectedProduct ? (
            <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-600">
              Select a product from the list to review normalization inputs.
            </div>
          ) : selectedTestingItem ? (
            <TestingQueueDetailPanel item={selectedTestingItem} />
          ) : selectedItem ? (
            <Gate2NormalizationReviewPanel
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
              onRerun={
                canRerunAgent2FromReviewCard(
                  selectedItem.product.agent_status,
                  selectedItem.product.product_id,
                  readyForReviewAfterRunIds,
                )
                  ? () => handleRunAgent2(selectedItem.product.product_id)
                  : undefined
              }
              onNavigateToGate1={
                onNavigateToGate
                  ? (productId) => onNavigateToGate('agent1', productId)
                  : undefined
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
                  : isAgent2FailedDraftStuck(
                        selectedProduct.agent_status,
                        latestScoringFor(selectedProduct.product_id),
                      )
                    ? 'Agent 2 failed (description or taxonomy). Re-run from the Run tab.'
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
              {showOnAgent2RunTab(
                selectedProduct,
                readyForReviewAfterRunIds,
                latestScoringFor(selectedProduct.product_id),
              ) ? (
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
        Run tab keeps products at <strong>evidence_approved</strong> until you submit for review.
        Awaiting review: submitted <strong>pending_review</strong> packets only. Tier-change holds:{' '}
        <strong>Testing queue</strong>.
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

          {inputs ? <ProductDescriptionSection inputs={inputs} /> : null}

          {inputs?.components?.length ? (
            <Gate2Section title={`Components (${inputs.components.length})`}>
              <div className="space-y-4">
                {inputs.components.map((component, i) => (
                  <NormalizationComponentBlock
                    key={`${component.component_name}-${i}`}
                    component={component}
                  />
                ))}
              </div>
            </Gate2Section>
          ) : null}

          {inputs?.layer_4b ? (
            <Gate2Section title="Transparency (Layer 4B)">
              <p className="text-sm font-semibold text-ink-900">
                {inputs.layer_4b.transparency_badge ?? '—'}
                {inputs.layer_4b.confidence_interval != null
                  ? ` · ±${inputs.layer_4b.confidence_interval}`
                  : ''}
              </p>
              {inputs.layer_4b.badge_justification ? (
                <p className="mt-2 text-sm text-slate-700">{inputs.layer_4b.badge_justification}</p>
              ) : null}
            </Gate2Section>
          ) : null}

          {scoringInput && whyFieldsFromScoringInput(scoringInput, inputs?.components) ? (
            <WhyThisScoreAdmin
              fields={whyFieldsFromScoringInput(scoringInput, inputs?.components)!}
              className="border-0 p-0 shadow-none"
            />
          ) : null}

          {inputs?.layer_4a ? <Layer4aSection layer4a={inputs.layer_4a} /> : null}

          {inputs?.normalization_notes ? (
            <Gate2Section title="Normalization notes">
              <p className="text-sm text-slate-700 whitespace-pre-wrap">
                {inputs.normalization_notes}
              </p>
            </Gate2Section>
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
  runTabHint,
  runTabBusy,
  onRunSingle,
}: {
  selectedProduct: ProductPipelineRow | null
  selectedRunnable: ProductPipelineRow[]
  batchProgress: { current: number; total: number; name: string } | null
  busyId: string | null
  runTabHint: string | null
  runTabBusy: boolean
  onRunSingle: (productId: string) => void
}) {
  if (runTabBusy && !batchProgress && runTabHint) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-indigo-200 bg-indigo-50/50 p-8 text-center shadow-card">
        <p className="text-sm font-semibold text-ink-900">Agent 2 running</p>
        <p className="mt-2 text-sm text-slate-700">{runTabHint}</p>
      </div>
    )
  }

  if (runTabBusy && batchProgress) {
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
        {runTabHint ? (
          <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950" role="alert">
            {runTabHint}
          </p>
        ) : null}
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
        {runTabHint ? (
          <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950" role="alert">
            {runTabHint}
          </p>
        ) : null}
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
