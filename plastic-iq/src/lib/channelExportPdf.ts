import { channelApiBase, channelSecret } from './channelReview'

export async function downloadChannelMapPdf(
  channelMapId: string,
  filename: string,
): Promise<void> {
  const secret = channelSecret()
  if (!secret) {
    throw new Error('VITE_ADMIN_PASSWORD is required to export channel maps from the admin UI')
  }

  const res = await fetch(`${channelApiBase()}/export-pdf`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Agent-Secret': secret,
    },
    body: JSON.stringify({ channel_map_id: channelMapId }),
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
