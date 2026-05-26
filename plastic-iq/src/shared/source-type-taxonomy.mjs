// Source type display labels and group order for product-page Sources section.
// Add new known types here when they become common; unknown types still render via humanizeSourceType.

/** @typedef {{ groupLabel: string, badgeLabel: string }} SourceTypeLabels */

/** Known types in display order (other is always last). */
export const SOURCE_TYPE_GROUP_ORDER = [
  'manufacturer',
  'retailer',
  'certification_registry',
  'third_party_review',
  'news_press',
  'scientific_publication',
  'pdf_document',
  'other',
]

/** @type {Record<string, SourceTypeLabels>} */
export const SOURCE_TYPE_LABELS = {
  manufacturer: { groupLabel: 'Manufacturer', badgeLabel: 'Manufacturer' },
  retailer: { groupLabel: 'Retailers', badgeLabel: 'Retailer' },
  certification_registry: {
    groupLabel: 'Certification registries',
    badgeLabel: 'Certification registry',
  },
  third_party_review: { groupLabel: 'Third-party reviews', badgeLabel: 'Third-party review' },
  news_press: { groupLabel: 'News & press', badgeLabel: 'News & press' },
  scientific_publication: {
    groupLabel: 'Scientific publications',
    badgeLabel: 'Scientific publication',
  },
  pdf_document: { groupLabel: 'PDF documents', badgeLabel: 'PDF document' },
  other: { groupLabel: 'Other', badgeLabel: 'Other' },
}

/**
 * @param {string} sourceType
 * @returns {string}
 */
export function normalizeSourceType(sourceType) {
  return String(sourceType ?? '')
    .trim()
    .toLowerCase()
}

/**
 * @param {string} sourceType
 * @returns {string}
 */
export function humanizeSourceType(sourceType) {
  const t = normalizeSourceType(sourceType)
  if (!t) return 'Other'
  return t
    .split(/[_-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * @param {string} sourceType
 * @returns {SourceTypeLabels}
 */
export function resolveSourceTypeLabels(sourceType) {
  const t = normalizeSourceType(sourceType)
  if (SOURCE_TYPE_LABELS[t]) return SOURCE_TYPE_LABELS[t]
  const humanized = humanizeSourceType(t)
  return { groupLabel: humanized, badgeLabel: humanized }
}

/**
 * Sort key for grouping: known types first (SOURCE_TYPE_GROUP_ORDER), then unknown types
 * alphabetically by group label, then "other" last.
 *
 * @param {string} sourceType
 * @returns {number}
 */
export function sourceTypeGroupSortKey(sourceType) {
  const t = normalizeSourceType(sourceType) || 'other'
  if (t === 'other') return 1_000_000
  const idx = SOURCE_TYPE_GROUP_ORDER.indexOf(t)
  if (idx >= 0) return idx
  return 10_000
}

/**
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function compareSourceGroupTypes(a, b) {
  const keyA = sourceTypeGroupSortKey(a)
  const keyB = sourceTypeGroupSortKey(b)
  if (keyA !== keyB) return keyA - keyB
  return resolveSourceTypeLabels(a).groupLabel.localeCompare(
    resolveSourceTypeLabels(b).groupLabel,
  )
}

/**
 * @param {Array<{ source_type?: string }>} sources
 * @returns {Array<{ sourceType: string, sources: typeof sources }>}
 */
export function groupSourcesByType(sources) {
  /** @type {Map<string, typeof sources>} */
  const byType = new Map()
  for (const source of sources ?? []) {
    const sourceType = normalizeSourceType(source.source_type) || 'other'
    const bucket = byType.get(sourceType) ?? []
    bucket.push(source)
    byType.set(sourceType, bucket)
  }

  const types = [...byType.keys()].sort(compareSourceGroupTypes)
  return types.map((sourceType) => ({
    sourceType,
    sources: byType.get(sourceType) ?? [],
  }))
}
