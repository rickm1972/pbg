import { buildChannelSourcesFromCitations } from './source-catalog.mjs'

/**
 * @param {object} parsed - Claude synthesis JSON
 */
export function extractSynthesisPayload(parsed) {
  let communities = Array.isArray(parsed?.communities) ? parsed.communities : []
  let media_outlets = Array.isArray(parsed?.media_outlets) ? parsed.media_outlets : []
  let industry_channels = Array.isArray(parsed?.industry_channels) ? parsed.industry_channels : []
  if (!communities.length && Array.isArray(parsed?.channels)) {
    communities = parsed.channels
  }

  let citations_used = []
  if (Array.isArray(parsed?.citations_used)) {
    citations_used = parsed.citations_used
  } else if (Array.isArray(parsed?.sources_used)) {
    citations_used = parsed.sources_used
  }

  const type_coverage_notes =
    parsed?.type_coverage_notes && typeof parsed.type_coverage_notes === 'object'
      ? parsed.type_coverage_notes
      : {}

  return {
    topic_description: String(parsed?.topic_description ?? '').trim(),
    facebook_coverage_note: String(parsed?.facebook_coverage_note ?? '').trim(),
    type_coverage_notes,
    communities,
    media_outlets,
    industry_channels,
    channels: communities,
    citations_used,
  }
}

/**
 * @param {ReturnType<import('./source-catalog.mjs').buildSourceCatalog>} catalog
 * @param {object} parsed
 * @param {(msg: string) => void} [log]
 */
export function resolveChannelSources(catalog, parsed, log = () => {}) {
  const { citations_used } = extractSynthesisPayload(parsed)
  const sources = buildChannelSourcesFromCitations(catalog, citations_used)
  const catalogIds = new Set(catalog.list.map((e) => e.source_id))
  const invalid = citations_used.filter(
    (c) => c?.source_id && !catalogIds.has(String(c.source_id)),
  )
  if (invalid.length) {
    log(`  Dropped ${invalid.length} citation(s) with unknown source_id`)
  }
  if (!citations_used.length) {
    log('  Warning: synthesis returned no citations_used — sources list may be empty')
  }
  return sources
}
