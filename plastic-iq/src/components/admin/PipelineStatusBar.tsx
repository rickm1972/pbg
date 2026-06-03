import { useEffect, useState } from 'react'
import {
  fetchProductPipelineSnapshot,
  gateStatusLabel,
  publishStatusLabel,
  type ProductPipelineGateSnapshot,
} from '../../lib/pipelineStatusApi'

type Props = {
  productId: string
  refreshKey?: string | number
}

function gateTone(status: string): string {
  if (status === 'approved' || status === 'ready_to_publish' || status === 'published') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-900'
  }
  if (status === 'pending_review') return 'border-amber-200 bg-amber-50 text-amber-900'
  if (status === 'rejected') return 'border-red-200 bg-red-50 text-red-900'
  if (status === 'unpublished') return 'border-slate-300 bg-slate-100 text-slate-800'
  return 'border-slate-200 bg-slate-50 text-slate-600'
}

export function PipelineStatusBar({ productId, refreshKey }: Props) {
  const [snapshot, setSnapshot] = useState<ProductPipelineGateSnapshot | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchProductPipelineSnapshot(productId)
      .then((s) => {
        if (!cancelled) setSnapshot(s)
      })
      .catch(() => {
        if (!cancelled) setSnapshot(null)
      })
    return () => {
      cancelled = true
    }
  }, [productId, refreshKey])

  if (!snapshot) return null

  const gates = [
    { label: 'Gate 1 Evidence', value: snapshot.gate1 },
    { label: 'Gate 2 Normalization', value: snapshot.gate2 },
    { label: 'Gate 3 Score', value: snapshot.gate3 },
    { label: 'Gate 4 Publish', value: snapshot.gate4 },
  ]

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        Pipeline status
      </p>
      <div className="mt-2 grid gap-2 sm:grid-cols-4">
        {gates.map((g) => (
          <div
            key={g.label}
            className={`rounded-lg border px-2 py-1.5 text-center ${gateTone(g.value)}`}
          >
            <p className="text-[10px] font-semibold">{g.label}</p>
            <p className="mt-0.5 text-xs font-medium capitalize">
              {g.label.startsWith('Gate 4')
                ? publishStatusLabel(String(g.value))
                : gateStatusLabel(String(g.value))}
            </p>
          </div>
        ))}
      </div>
      {!snapshot.canPublish && snapshot.publishBlockers.length > 0 ? (
        <p className="mt-2 text-[11px] text-slate-600">
          Publish blocked: {snapshot.publishBlockers.join(' · ')}
        </p>
      ) : null}
    </div>
  )
}
