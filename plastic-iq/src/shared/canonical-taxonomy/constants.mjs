/** Canonical ID when no deterministic rule matches — blocks Gate 1 approval. */
export const TAXONOMY_EXPANSION_REQUIRED = 'TAXONOMY_EXPANSION_REQUIRED'

/** Phase 3.7: canonical mapping confidence when source is government/regulatory (PCA, statute). */
export const GOVERNMENT_SOURCE_CONFIRMED = 'government_source_confirmed'

export function isExpansionRequired(canonicalId) {
  return canonicalId === TAXONOMY_EXPANSION_REQUIRED || !canonicalId?.trim()
}
