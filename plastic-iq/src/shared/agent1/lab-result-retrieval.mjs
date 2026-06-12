/**
 * Lab-result / third-party testing retrieval requirements for coated products.
 */

import { classifyLabResultSource } from './source-authority.mjs'

const LAB_LINK_RE =
  /lab\s*result|test\s*result|third[-\s]?party\s*test|see\s*(the\s*)?lab|testing\s*report|certificate of analysis|coa\b|pfas\s*test|ptfe\s*test|non[-\s]?detect/i

const PFAS_PTFE_CLAIM_RE = /\bpfas[-\s]?free\b|\bptfe[-\s]?free\b|\bpfoa[-\s]?free\b/i

/**
 * @param {import('../canonical-taxonomy/types.mjs').CanonicalMappingsPayload | null | undefined} mappings
 * @param {object} structured
 */
export function requiresLabResultRetrieval(mappings, structured) {
  const primaryId = mappings?.primary_contact_material_id?.canonical_id ?? ''
  const coatingId = mappings?.coating_modifier_id?.canonical_id ?? ''
  const coated =
    /hybrid_stainless|ceramic_nonstick|ptfe_nonstick|proprietary/.test(`${primaryId} ${coatingId}`) ||
    coatingId === 'proprietary_nonstick_coating_undisclosed' ||
    coatingId === 'ceramic_sol_gel_nonstick_coating'

  if (!coated) return false

  const blob = [
    structured?.primary_contact_material?.material_identity,
    ...(structured?.coatings_and_finishes ?? []).map((c) => `${c.coating_name} ${c.coating_type}`),
    structured?.safety_claims?.pfas_free_claim?.source_quote,
    structured?.safety_claims?.pfoa_free_claim?.source_quote,
  ]
    .filter(Boolean)
    .join(' ')

  return PFAS_PTFE_CLAIM_RE.test(blob) || coated
}

/**
 * @param {object[]} sources
 */
export function findLabResultSources(sources) {
  return (sources ?? []).filter((s) => classifyLabResultSource(s) != null)
}

/**
 * @param {object[]} sources
 */
export function findLabResultLinkMentions(sources) {
  return (sources ?? []).filter((s) =>
    LAB_LINK_RE.test(`${s.page_excerpt ?? ''} ${s.title ?? ''} ${s.url ?? ''}`),
  )
}

/**
 * @param {object[]} sources
 * @param {object} structured
 */
export function analyzeLabResultRetrieval(sources, structured) {
  const labSources = findLabResultSources(sources)
  const linkMentions = findLabResultLinkMentions(sources)
  const retrievedLab = labSources.length > 0
  const linkNotRetrieved = linkMentions.length > 0 && !retrievedLab

  /** @type {string[]} */
  const codes = []
  if (linkNotRetrieved) codes.push('LAB_RESULTS_LINK_NOT_RETRIEVED')
  if (!retrievedLab && requiresLabResultRetrieval(structured?.canonical_mappings, structured)) {
    codes.push('NO_THIRD_PARTY_TESTING_FOUND')
  }

  return {
    lab_sources: labSources.map((s) => ({
      url: s.url,
      classification: classifyLabResultSource(s, s.url),
      title: s.title,
    })),
    link_mentions: linkMentions.map((s) => s.url),
    retrieved_lab_result: retrievedLab,
    link_not_retrieved: linkNotRetrieved,
    codes,
  }
}
