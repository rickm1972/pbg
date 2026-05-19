import { MAX_SOURCES } from './types.mjs'

const SOURCE_TYPE_PRIORITY = {
  amazon: 0,
  target: 1,
  walmart: 2,
  other_retailer: 3,
  retailer: 4,
  manufacturer: 5,
  spec_sheet: 6,
  sds: 7,
  ingredient_page: 8,
  faq: 9,
  certification: 10,
  smartlabel: 11,
  search_result: 12,
  other: 13,
}

export function normalizeUrlKey(url) {
  try {
    const u = new URL(url)
    u.hash = ''
    const path = u.pathname.replace(/\/+$/, '') || '/'
    return `${u.protocol}//${u.host.toLowerCase()}${path}${u.search}`
  } catch {
    return String(url ?? '').trim().toLowerCase()
  }
}

function sourcePriority(source) {
  const type = (source.source_type ?? '').toLowerCase()
  return SOURCE_TYPE_PRIORITY[type] ?? 50
}

/**
 * Dedupe by URL, keep highest-priority sources, remap fact source_index values.
 */
export function capSourcesAndRemapFacts(sources, facts) {
  const list = Array.isArray(sources) ? [...sources] : []
  const seen = new Set()
  const unique = []

  for (const source of list) {
    const key = normalizeUrlKey(source.url)
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(source)
  }

  unique.sort((a, b) => {
    const pa = sourcePriority(a)
    const pb = sourcePriority(b)
    if (pa !== pb) return pa - pb
    return String(a.url).localeCompare(String(b.url))
  })

  const beforeCount = unique.length
  const capped = unique.slice(0, MAX_SOURCES)
  const dropped = beforeCount - capped.length

  const indexMap = new Map()
  for (let i = 0; i < unique.length; i++) {
    const newIdx = capped.findIndex((s) => normalizeUrlKey(s.url) === normalizeUrlKey(unique[i].url))
    indexMap.set(i, newIdx >= 0 ? newIdx : null)
  }

  const remappedFacts = (Array.isArray(facts) ? facts : []).map((fact) => {
    if (fact.source_index == null) return fact
    const oldIdx = Number(fact.source_index)
    if (!Number.isInteger(oldIdx) || oldIdx < 0) return { ...fact, source_index: null }
    const mapped = indexMap.get(oldIdx)
    return { ...fact, source_index: mapped == null ? null : mapped }
  })

  return { sources: capped, facts: remappedFacts, dropped, beforeCount }
}
