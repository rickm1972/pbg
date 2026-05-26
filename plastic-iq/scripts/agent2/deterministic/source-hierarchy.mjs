/**
 * Deterministic confidence labels from evidence source tier (highest tier wins).
 */

const SOURCE_TIER = {
  manufacturer: 5,
  amazon: 4,
  target: 4,
  walmart: 4,
  other_retailer: 4,
  certification: 6,
  other: 1,
}

const CONFIDENCE_BY_TIER = {
  manufacturer: 'manufacturer confirmed',
  certification: 'certification verified',
  amazon: 'retailer confirmed',
  target: 'retailer confirmed',
  walmart: 'retailer confirmed',
  other_retailer: 'retailer confirmed',
  other: 'inferred from description',
}

const FULL_DISCLOSURE_MARKERS = /fully disclosed|full ingredient|all ingredients named|complete ingredient/i

/** @param {object} evidence */
export function sourceTypeForIndex(evidence, sourceIndex) {
  const sources = evidence?.sources ?? []
  if (sourceIndex == null || sourceIndex < 0 || sourceIndex >= sources.length) return 'other'
  return String(sources[sourceIndex]?.source_type ?? 'other').toLowerCase()
}

/**
 * Resolve confidence for a fact row (Agent 1 label may be upgraded, never downgraded without rule).
 * @param {object} evidence
 * @param {object|null} factRow
 * @param {{ fullIngredientList?: boolean }} [opts]
 */
export function resolveConfidenceLabel(evidence, factRow, opts = {}) {
  if (!factRow) return 'unknown'

  const agent1 = String(factRow.confidence ?? '').trim().toLowerCase()
  const tier = sourceTypeForIndex(evidence, factRow.source_index)
  const tierLabel = CONFIDENCE_BY_TIER[tier] ?? 'inferred from description'

  if (/proprietary|undisclosed|composition not|not publicly disclosed/i.test(String(factRow.fact_value ?? ''))) {
    return 'proprietary or undisclosed'
  }

  if (opts.fullIngredientList && FULL_DISCLOSURE_MARKERS.test(agent1)) {
    return 'fully disclosed by manufacturer'
  }
  if (opts.fullIngredientList && tier === 'manufacturer' && factRow.fact_key === 'ingredient_list') {
    return 'fully disclosed by manufacturer'
  }

  if (agent1 === 'fully disclosed by manufacturer') return agent1
  if (agent1 === 'certification verified') return agent1
  if (agent1 === 'manufacturer confirmed' || agent1 === 'retailer confirmed') {
    return agent1
  }

  if (tier === 'manufacturer') return 'manufacturer confirmed'
  if (['amazon', 'target', 'walmart', 'other_retailer'].includes(tier)) return 'retailer confirmed'

  if (/inferred from category pattern/i.test(agent1)) return 'inferred from category pattern'
  if (/inferred from description/i.test(agent1)) return 'inferred from description'
  if (/unknown/i.test(agent1)) return 'unknown'

  return tierLabel
}

export function pickHighestConfidence(existing, candidate) {
  const rank = {
    'fully disclosed by manufacturer': 7,
    'manufacturer confirmed': 6,
    'certification verified': 6,
    'retailer confirmed': 5,
    'inferred from category pattern': 3,
    'inferred from description': 2,
    'proprietary or undisclosed': 2,
    unknown: 0,
  }
  const a = rank[String(existing ?? '').toLowerCase()] ?? 0
  const b = rank[String(candidate ?? '').toLowerCase()] ?? 0
  return b > a ? candidate : existing
}
