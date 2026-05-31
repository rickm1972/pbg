import { personaApiBase, personaSecret } from './personaReview'

export async function downloadPersonaPdf(personaId: string, filename: string): Promise<void> {
  const secret = personaSecret()
  if (!secret) {
    throw new Error('VITE_ADMIN_PASSWORD is required to export personas from the admin UI')
  }

  const res = await fetch(`${personaApiBase()}/export-pdf`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Agent-Secret': secret,
    },
    body: JSON.stringify({ persona_id: personaId }),
  })

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error || `PDF export failed (${res.status})`)
  }

  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
