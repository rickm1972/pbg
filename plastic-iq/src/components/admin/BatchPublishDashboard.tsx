import { useCallback, useEffect, useState } from 'react'
import { formatSupabaseUnknownError } from '../../lib/supabaseClient'
import {
  batchPublishProducts,
  fetchPublishStatusCounts,
  fetchReadyToPublishProducts,
  type BatchPublishResult,
  type PublishProductRow,
} from '../../lib/publishApi'
import { PipelineStatusBar } from './PipelineStatusBar'
import { Gate4PublishControls } from './Gate4PublishControls'

type Props = {
  onNotice: (message: string | null) => void
  onError: (message: string | null) => void
}

export function BatchPublishDashboard({ onNotice, onError }: Props) {
  const [products, setProducts] = useState<PublishProductRow[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState<BatchPublishResult[] | null>(null)
  const [focusId, setFocusId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    onError(null)
    try {
      const [ready, statusCounts] = await Promise.all([
        fetchReadyToPublishProducts(),
        fetchPublishStatusCounts(),
      ])
      setProducts(ready)
      setCounts(statusCounts)
    } catch (e: unknown) {
      onError(formatSupabaseUnknownError(e, 'Failed to load publish queue'))
    } finally {
      setLoading(false)
    }
  }, [onError])

  useEffect(() => {
    void load()
  }, [load])

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAll() {
    setSelected(new Set(products.map((p) => p.product_id)))
  }

  function clearAll() {
    setSelected(new Set())
  }

  async function handleBatchPublish() {
    const picked = products.filter((p) => selected.has(p.product_id))
    if (picked.length === 0) {
      onError('Select at least one product to publish.')
      return
    }
    setBusy(true)
    setResults(null)
    onError(null)
    try {
      const batchResults = await batchPublishProducts(
        picked.map((p) => ({ product_id: p.product_id, product_name: p.product_name })),
      )
      setResults(batchResults)
      const ok = batchResults.filter((r) => r.ok).length
      const fail = batchResults.length - ok
      onNotice(`Batch publish: ${ok} succeeded, ${fail} failed.`)
      setSelected(new Set())
      await load()
    } catch (e: unknown) {
      onError(formatSupabaseUnknownError(e, 'Batch publish failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-xl font-semibold text-ink-900">Gate 4 · Batch publish</h2>
        <p className="mt-2 text-sm text-slate-600">
          Products with <strong>ready_to_publish</strong> have passed Gates 1–3. Publishing is
          explicit — nothing goes live without your action.
        </p>
        <dl className="mt-4 flex flex-wrap gap-3 text-xs text-slate-600">
          {Object.entries(counts).map(([status, n]) => (
            <div key={status} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5">
              <span className="font-semibold text-ink-900">{status.replace(/_/g, ' ')}</span>: {n}
            </div>
          ))}
        </dl>
      </header>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-card">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <p className="text-sm font-semibold text-ink-900">
                Ready to publish ({products.length})
              </p>
              <div className="flex gap-2">
                <button type="button" onClick={selectAll} className="text-xs font-semibold text-violet-800">
                  All
                </button>
                <button type="button" onClick={clearAll} className="text-xs text-slate-600">
                  Clear
                </button>
              </div>
            </div>
            {loading ? (
              <p className="p-4 text-sm text-slate-600">Loading…</p>
            ) : products.length === 0 ? (
              <p className="p-4 text-sm text-slate-600">
                No products in ready_to_publish. Complete Gates 1–3 approvals first.
              </p>
            ) : (
              <ul className="max-h-[50dvh] divide-y divide-slate-100 overflow-auto">
                {products.map((p) => (
                  <li key={p.product_id}>
                    <label className="flex cursor-pointer items-start gap-3 px-4 py-3 hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={selected.has(p.product_id)}
                        onChange={() => toggle(p.product_id)}
                        className="mt-1 h-4 w-4"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault()
                          setFocusId(p.product_id)
                        }}
                        className="min-w-0 flex-1 text-left"
                      >
                        <span className="text-sm font-medium text-ink-900">{p.product_name}</span>
                        <span className="mt-0.5 block text-xs text-slate-500">{p.brand ?? '—'}</span>
                      </button>
                    </label>
                  </li>
                ))}
              </ul>
            )}
            <div className="border-t border-slate-100 p-4">
              <button
                type="button"
                disabled={busy || selected.size === 0}
                onClick={() => void handleBatchPublish()}
                className="w-full rounded-xl bg-violet-800 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-900 disabled:opacity-60"
              >
                {busy ? 'Publishing…' : `Publish ${selected.size} selected`}
              </button>
            </div>
          </div>

          {results ? (
            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-semibold text-ink-900">Batch results</p>
              <ul className="mt-2 max-h-48 space-y-1 overflow-auto text-xs">
                {results.map((r) => (
                  <li key={r.productId} className={r.ok ? 'text-emerald-800' : 'text-red-800'}>
                    {r.ok ? '✓' : '✗'} {r.productName}
                    {r.error ? ` — ${r.error}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="lg:col-span-7">
          {focusId ? (
            <div className="space-y-4">
              <PipelineStatusBar productId={focusId} refreshKey={results?.length} />
              <Gate4PublishControls
                productId={focusId}
                refreshKey={results?.length}
                onPublished={() => void load()}
                onNotice={onNotice}
                onError={onError}
              />
            </div>
          ) : (
            <div className="flex min-h-[280px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-600">
              Select a product to preview publish controls and pipeline status.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
