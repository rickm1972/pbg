import { normalizeUrlKey } from '../source-utils.mjs'
import { applyCanonicalMappings } from '../../../src/shared/canonical-taxonomy/map-structured-evidence.mjs'
import { applyRequiredEvidenceValidation } from '../../../src/shared/required-evidence-matrix/validate-required-evidence.mjs'

/**
 * @param {object[]} sources
 * @param {{ url: string, title: string, excerpt: string, source_type: string }[]} additions
 */
export function mergeRetrievalSources(sources, additions) {
  const list = Array.isArray(sources) ? [...sources] : []
  const seen = new Set(list.map((s) => normalizeUrlKey(s.url)))

  for (const add of additions) {
    if (!add?.url) continue
    const key = normalizeUrlKey(add.url)
    if (seen.has(key)) {
      const existing = list.find((s) => normalizeUrlKey(s.url) === key)
      if (existing && add.excerpt && !existing.page_excerpt) {
        existing.page_excerpt = add.excerpt
      }
      continue
    }
    seen.add(key)
    list.push({
      source_type: add.source_type ?? 'regulatory',
      url: add.url,
      title: add.title ?? add.url,
      fetched_at: new Date().toISOString(),
      page_excerpt: add.excerpt ?? '',
    })
  }
  return list
}

/**
 * @param {object} structured
 * @param {import('./execute-required-retrieval.mjs').RequiredCheckResultRecord[]} results
 */
export function storeRequiredCheckResults(structured, results) {
  structured.required_check_results = results
}

/**
 * Re-run canonical mapping + matrix validation after retrieval.
 * @param {object} structured
 * @param {object[]} sources
 * @param {{ facts?: object[] }} [options]
 */
export function refreshEvidenceAfterRetrieval(structured, sources, options = {}) {
  applyCanonicalMappings(structured, sources, options)
  applyRequiredEvidenceValidation(structured, sources, options)
}
