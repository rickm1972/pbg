/**
 * Lightweight HTML → text for official-page retrieval (Agent 1 required checks).
 */
export async function fetchPageText(url, { maxChars = 12_000, timeoutMs = 20_000 } = {}) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'PlasticIQ-Agent1/3.7 (required-check-retrieval)',
      Accept: 'text/html,application/xhtml+xml',
    },
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching ${url}`)
  }
  const html = await res.text()
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return text.slice(0, maxChars)
}
