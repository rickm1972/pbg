import { isGenericSalesSource } from './source-filter.mjs'
import { isMalformedOrSpamUrl, isPlaceholderClaim, normalizeSourceUrl } from './url-guard.mjs'

/**
 * Build numbered source catalog from retrieval excerpts (real claims only).
 * @param {object[]} retrievalAngles
 */
export function buildSourceCatalog(retrievalAngles) {
  /** @type {Map<string, object>} */
  const byUrl = new Map()
  let n = 0

  for (const angle of retrievalAngles ?? []) {
    for (const ex of angle.excerpts ?? []) {
      if (!ex?.url || isMalformedOrSpamUrl(ex.url)) continue
      if (isPlaceholderClaim(ex.claim)) continue
      if (angle.angle_id === 'objections_trust' && isGenericSalesSource(ex)) continue

      const key = normalizeSourceUrl(ex.url)
      if (byUrl.has(key)) continue

      n += 1
      const source_id = `src_${String(n).padStart(3, '0')}`
      byUrl.set(key, {
        source_id,
        url: ex.url,
        title: ex.source_title ?? ex.url,
        retrieval_excerpt: ex.claim,
        claim: ex.claim,
        angle_id: angle.angle_id,
        source_type: ex.source_type ?? 'unknown',
      })
    }
  }

  const list = [...byUrl.values()]
  const byId = new Map(list.map((e) => [e.source_id, e]))
  return { byId, list }
}

/**
 * @param {ReturnType<typeof buildSourceCatalog>} catalog
 * @param {Array<{ source_id: string, statement?: string }>} citationsUsed
 */
export function buildPersonaSourcesFromCitations(catalog, citationsUsed) {
  const out = []
  const seen = new Set()

  for (const cite of citationsUsed ?? []) {
    const id = String(cite?.source_id ?? '').trim()
    const statement = String(cite?.statement ?? '').trim()
    if (!id || !statement) continue
    if (isPlaceholderClaim(statement)) continue

    const entry = catalog.byId.get(id)
    if (!entry || seen.has(id)) continue
    if (isMalformedOrSpamUrl(entry.url)) continue

    seen.add(id)
    out.push({
      source_id: entry.source_id,
      url: entry.url,
      title: entry.title,
      excerpt: statement,
      angle_id: entry.angle_id,
      source_type: entry.source_type,
    })
  }

  return out
}
