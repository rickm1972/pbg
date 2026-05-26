/** Read structured facts from an approved evidence packet. */

export function getFacts(evidence) {
  return Array.isArray(evidence?.facts) ? evidence.facts : []
}

export function factByKey(evidence, key) {
  return getFacts(evidence).find((f) => f.fact_key === key) ?? null
}

export function factValue(evidence, key) {
  const row = factByKey(evidence, key)
  if (!row) return ''
  const v = row.fact_value
  if (v == null) return ''
  if (typeof v === 'boolean') return v ? 'true' : ''
  return String(v)
}

export function factConfidence(evidence, key) {
  return String(factByKey(evidence, key)?.confidence ?? '').trim()
}

export function factSource(evidence, key) {
  const row = factByKey(evidence, key)
  if (!row) return null
  return {
    fact_key: key,
    excerpt: row.excerpt ?? '',
    source_index: row.source_index ?? null,
    confidence: row.confidence ?? '',
  }
}

export function parseCertificationList(evidence) {
  const raw = factValue(evidence, 'certifications_found')
  if (!raw.trim()) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.map(String)
  } catch {
    /* fall through */
  }
  return raw
    .replace(/^\[|\]$/g, '')
    .split(/[;,]/)
    .map((s) => s.trim())
    .filter(Boolean)
}
