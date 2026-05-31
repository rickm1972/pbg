import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { ChannelMapProfileBody } from '../components/admin/ChannelMapProfileBody'
import type { ChannelMapRow } from '../types/channelMap'

export function ChannelMapExportPage() {
  const { channelMapId } = useParams<{ channelMapId: string }>()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const [row, setRow] = useState<ChannelMapRow | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pdfReady, setPdfReady] = useState(false)

  useEffect(() => {
    if (!channelMapId || !token) {
      setError('Missing channel map or export token')
      return
    }
    let cancelled = false
    setPdfReady(false)
    fetch(
      `/api/channel/export-data?channel_map_id=${encodeURIComponent(channelMapId)}&token=${encodeURIComponent(token)}`,
    )
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as ChannelMapRow & { error?: string }
        if (!res.ok) throw new Error(body.error || `Failed to load channel map (${res.status})`)
        return body as ChannelMapRow
      })
      .then((data) => {
        if (!cancelled) setRow(data)
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load channel map')
        }
      })
    return () => {
      cancelled = true
    }
  }, [channelMapId, token])

  useEffect(() => {
    if (!row) {
      setPdfReady(false)
      return
    }
    let cancelled = false
    void document.fonts.ready.then(() => {
      if (!cancelled) {
        requestAnimationFrame(() => {
          if (!cancelled) setPdfReady(true)
        })
      }
    })
    return () => {
      cancelled = true
    }
  }, [row])

  if (error) {
    return (
      <div className="bg-white p-8 text-sm text-red-800" data-channel-map-pdf-error>
        {error}
      </div>
    )
  }

  if (!row) {
    return (
      <div className="bg-white p-8 text-sm text-slate-600" data-channel-map-pdf-loading>
        Loading channel map…
      </div>
    )
  }

  return (
    <div
      className="min-h-screen bg-white"
      data-channel-map-pdf-ready={pdfReady ? 'true' : undefined}
    >
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-10">
        <ChannelMapProfileBody row={row} showMeta />
      </div>
    </div>
  )
}
