import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { PersonaProfileBody } from '../components/admin/PersonaProfileBody'
import type { PersonaRow } from '../types/persona'

export function PersonaExportPage() {
  const { personaId } = useParams<{ personaId: string }>()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const [row, setRow] = useState<PersonaRow | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pdfReady, setPdfReady] = useState(false)

  useEffect(() => {
    if (!personaId || !token) {
      setError('Missing persona or export token')
      return
    }
    let cancelled = false
    setPdfReady(false)
    fetch(
      `/api/persona/export-data?persona_id=${encodeURIComponent(personaId)}&token=${encodeURIComponent(token)}`,
    )
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as PersonaRow & { error?: string }
        if (!res.ok) throw new Error(body.error || `Failed to load persona (${res.status})`)
        return body as PersonaRow
      })
      .then((data) => {
        if (!cancelled) setRow(data)
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load persona')
        }
      })
    return () => {
      cancelled = true
    }
  }, [personaId, token])

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
      <div className="bg-white p-8 text-sm text-red-800" data-persona-pdf-error>
        {error}
      </div>
    )
  }

  if (!row) {
    return (
      <div className="bg-white p-8 text-sm text-slate-600" data-persona-pdf-loading>
        Loading persona…
      </div>
    )
  }

  return (
    <div
      className="min-h-screen bg-white"
      data-persona-pdf-ready={pdfReady ? 'true' : undefined}
    >
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-10">
        <PersonaProfileBody row={row} content={row.persona_content ?? {}} showMeta />
      </div>
    </div>
  )
}
