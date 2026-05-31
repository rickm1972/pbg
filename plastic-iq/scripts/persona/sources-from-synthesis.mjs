import { PERSONA_CONTENT_FIELD_KEYS } from './schema.mjs'
import { buildPersonaSourcesFromCitations } from './source-catalog.mjs'

const CITATION_META_KEYS = new Set(['citations_used', 'persona', 'sources_used'])

/**
 * @param {object} parsed - Claude synthesis JSON
 */
export function extractSynthesisPayload(parsed) {
  const persona =
    parsed?.persona && typeof parsed.persona === 'object'
      ? parsed.persona
      : Object.fromEntries(
          PERSONA_CONTENT_FIELD_KEYS.map((k) => [
            k,
            typeof parsed?.[k] === 'string' ? parsed[k] : '',
          ]),
        )

  let citations_used = []
  if (Array.isArray(parsed?.citations_used)) {
    citations_used = parsed.citations_used
  } else if (Array.isArray(parsed?.sources_used)) {
    citations_used = parsed.sources_used
  }

  return { persona, citations_used }
}

/**
 * If Claude omitted citations_used, match catalog hosts mentioned in persona text (last resort).
 * @param {ReturnType<import('./source-catalog.mjs').buildSourceCatalog>} catalog
 * @param {object} persona_content
 */
export function inferCitationsFromPersonaText(catalog, persona_content) {
  const blob = PERSONA_CONTENT_FIELD_KEYS.map((k) => persona_content[k] ?? '')
    .join('\n')
    .toLowerCase()

  const citations = []
  for (const entry of catalog.list) {
    try {
      const host = new URL(entry.url).hostname.replace(/^www\./, '').toLowerCase()
      if (host.length < 4) continue
      if (blob.includes(host)) {
        citations.push({
          source_id: entry.source_id,
          statement: entry.retrieval_excerpt,
        })
      }
    } catch {
      /* skip */
    }
  }
  return citations
}

/**
 * @param {ReturnType<import('./source-catalog.mjs').buildSourceCatalog>} catalog
 * @param {object} parsed
 * @param {object} persona_content
 * @param {(msg: string) => void} [log]
 */
export function resolvePersonaSources(catalog, parsed, persona_content, log = () => {}) {
  let { citations_used } = extractSynthesisPayload(parsed)

  if (!citations_used.length) {
    log('  Warning: synthesis returned no citations_used — inferring from persona text')
    citations_used = inferCitationsFromPersonaText(catalog, persona_content)
  }

  const sources = buildPersonaSourcesFromCitations(catalog, citations_used)
  const catalogIds = new Set(catalog.list.map((e) => e.source_id))
  const invalid = citations_used.filter(
    (c) => c?.source_id && !catalogIds.has(String(c.source_id)),
  )
  if (invalid.length) {
    log(`  Dropped ${invalid.length} citation(s) with unknown source_id`)
  }

  return sources
}

export { CITATION_META_KEYS }
