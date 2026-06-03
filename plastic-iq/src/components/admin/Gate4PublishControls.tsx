import { useCallback, useEffect, useState } from 'react'
import {
  checkPublishChain,
  fetchProductPublishRow,
  publishProduct,
  unpublishProduct,
  type PublishProductRow,
} from '../../lib/publishApi'
import { publishStatusLabel } from '../../lib/pipelineStatusApi'

type Props = {
  productId: string
  refreshKey?: string | number
  onPublished?: () => void
  onError?: (message: string) => void
  onNotice?: (message: string) => void
}

export function Gate4PublishControls({
  productId,
  refreshKey,
  onPublished,
  onError,
  onNotice,
}: Props) {
  const [row, setRow] = useState<PublishProductRow | null>(null)
  const [missingGates, setMissingGates] = useState<string[]>([])
  const [canPublish, setCanPublish] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const [product, chain] = await Promise.all([
      fetchProductPublishRow(productId),
      checkPublishChain(productId),
    ])
    setRow(product)
    setMissingGates(chain.missingGates)
    setCanPublish(chain.canPublish)
  }, [productId])

  useEffect(() => {
    void load().catch((e: unknown) => {
      onError?.(e instanceof Error ? e.message : 'Failed to load publish status')
    })
  }, [load, refreshKey, onError])

  const status = row?.publish_status ?? 'draft'
  const isPublished = status === 'published'

  async function handlePublish() {
    setBusy(true)
    try {
      await publishProduct(productId)
      onNotice?.('Product published to the public site.')
      await load()
      onPublished?.()
    } catch (e: unknown) {
      onError?.(e instanceof Error ? e.message : 'Publish failed')
    } finally {
      setBusy(false)
    }
  }

  async function handleUnpublish() {
    setBusy(true)
    try {
      await unpublishProduct(productId)
      onNotice?.('Product unpublished — hidden from public site.')
      await load()
      onPublished?.()
    } catch (e: unknown) {
      onError?.(e instanceof Error ? e.message : 'Unpublish failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-xl border border-violet-200 bg-violet-50/50 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-800">
        Gate 4 · Publish
      </p>
      <p className="mt-1 text-sm text-slate-800">
        Status: <strong>{publishStatusLabel(status)}</strong>
        {row?.published_at && isPublished
          ? ` · ${new Date(row.published_at).toLocaleString()}`
          : ''}
      </p>

      {isPublished ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleUnpublish()}
          className="mt-3 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
        >
          {busy ? 'Working…' : 'Unpublish'}
        </button>
      ) : (
        <>
          <button
            type="button"
            disabled={busy || !canPublish}
            title={
              !canPublish
                ? `Cannot publish until all approval gates are passed. Missing: ${missingGates.join('; ')}`
                : undefined
            }
            onClick={() => void handlePublish()}
            className="mt-3 rounded-xl bg-violet-800 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-900 disabled:opacity-60"
          >
            {busy ? 'Publishing…' : 'Publish to public site'}
          </button>
          {!canPublish ? (
            <p className="mt-2 text-xs text-slate-700">
              Cannot publish until all approval gates are passed. Missing:{' '}
              {missingGates.length > 0 ? missingGates.join(' · ') : 'unknown'}
            </p>
          ) : status === 'ready_to_publish' ? (
            <p className="mt-2 text-xs text-emerald-800">
              Full approved chain — ready for explicit publish (not visible on public site until you
              click Publish).
            </p>
          ) : null}
        </>
      )}
    </section>
  )
}
