import type { ProductPipelineRow } from '../../types/agent'

type Props = {
  selectedRunnable: ProductPipelineRow[]
  runnableCount: number
  batchProgress: { current: number; total: number; name: string } | null
  busyId: string | null
}

/** Run Agent 1 tab — status/progress only (no per-product detail card). */
export function Agent1RunRightPanel({
  selectedRunnable,
  runnableCount,
  batchProgress,
  busyId,
}: Props) {
  const runningName =
    batchProgress?.name ??
    selectedRunnable.find((p) => p.product_id === busyId)?.product_name ??
    ''

  if (batchProgress || busyId) {
    return (
      <div
        data-agent1-run-panel="progress"
        className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-card"
      >
        <p className="text-sm font-semibold text-ink-900">Running Agent 1</p>
        <p className="mt-2 text-sm text-slate-600">
          {batchProgress
            ? `${batchProgress.current} of ${batchProgress.total}${runningName ? `: ${runningName}` : ''}`
            : runningName || 'Starting…'}
        </p>
        <p className="mt-4 max-w-md text-xs text-slate-500">
          Each product takes about 1–2 minutes. Leave this tab open until the batch finishes.
        </p>
      </div>
    )
  }

  if (selectedRunnable.length > 0) {
    return (
      <div
        data-agent1-run-panel="ready"
        className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-card"
      >
        <p className="text-sm font-semibold text-ink-900">Ready to run</p>
        <p className="mt-2 text-sm text-slate-600">
          {selectedRunnable.length} product{selectedRunnable.length === 1 ? '' : 's'} selected —
          click <strong>Run Agent 1</strong> in the left column
          {runnableCount > selectedRunnable.length
            ? ` (or select all ${runnableCount}).`
            : '.'}
        </p>
      </div>
    )
  }

  return (
    <div
      data-agent1-run-panel="idle"
      className="flex min-h-[320px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center shadow-card"
    >
      <p className="max-w-sm text-sm text-slate-600">
        Check products on the left, then <strong>Run Agent 1</strong> in the left column. Progress
        shows here while Agent 1 runs.
      </p>
    </div>
  )
}
