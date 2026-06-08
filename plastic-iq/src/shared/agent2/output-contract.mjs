/**
 * Agent 2 normalization output contract — single source of truth for
 * score-blocking vs cosmetic fields, product-description limits, and user-facing copy.
 */

/** @typedef {'generated' | 'warning' | 'fallback_generated'} ProductDescriptionStatus */

export const AGENT2_OUTPUT_CONTRACT = {
  /** Normalization statuses that prevent score-driving output from being produced. */
  score_blocking_normalization_statuses: ['taxonomy_expansion_required'],

  /** Input fields required for scoring; absence blocks normalization. */
  score_blocking_fields: [
    'components',
    'layer_4a',
    'layer_4b',
    'formulation_pathway',
  ],

  product_description: {
    min_words: 50,
    max_words: 100,
    score_blocking: false,
    max_retries: 2,
    retry_strategies: ['default', 'expand_inert_use', 'expand_inert_clause', 'compact'],
    fallback_on_failure: true,
    statuses: {
      ok: 'generated',
      validation_warning: 'warning',
      fallback: 'fallback_generated',
    },
  },
}

const PD = AGENT2_OUTPUT_CONTRACT.product_description

/**
 * @returns {{ min_words: number, max_words: number }}
 */
export function getProductDescriptionWordLimits() {
  return { min_words: PD.min_words, max_words: PD.max_words }
}

export function isProductDescriptionScoreBlocking() {
  return PD.score_blocking === true
}

/**
 * @param {string | null | undefined} status
 */
export function isScoreBlockingNormalizationStatus(status) {
  return AGENT2_OUTPUT_CONTRACT.score_blocking_normalization_statuses.includes(
    String(status ?? ''),
  )
}

/**
 * @param {number} wordCount
 */
export function validateProductDescriptionWordCount(wordCount) {
  const { min_words, max_words } = getProductDescriptionWordLimits()
  const count = Number(wordCount)
  return {
    wordCount: count,
    min_words,
    max_words,
    withinRange: Number.isFinite(count) && count >= min_words && count <= max_words,
    tooShort: Number.isFinite(count) && count < min_words,
    tooLong: Number.isFinite(count) && count > max_words,
  }
}

/**
 * @param {string[]} [flaggedFields]
 */
export function isCosmeticProductDescriptionFailure(flaggedFields) {
  const fields = flaggedFields ?? []
  return fields.some(
    (f) =>
      String(f).startsWith('word_count_out_of_range:') ||
      String(f).startsWith('product_description:'),
  )
}

/**
 * User-facing message when cosmetic copy fails validation (non-score metadata).
 * @param {string[]} [flaggedFields]
 */
export function cosmeticProductDescriptionWarningMessage(flaggedFields) {
  const fields = (flaggedFields ?? []).map((f) => String(f))
  const wordCountIssue = fields.find((f) => f.startsWith('word_count_out_of_range:'))
  if (wordCountIssue) {
    return (
      'Agent 2 generated product-description copy outside the configured word-count range. ' +
      'This is non-score metadata; scoring inputs were still produced. ' +
      'Regenerate description copy if needed.'
    )
  }
  const detail = fields.length ? fields.join(', ') : 'incomplete copy inputs'
  return (
    `Agent 2 product-description generation incomplete (${detail}). ` +
    'This is non-score metadata; scoring inputs were still produced. ' +
    'Regenerate description copy if needed.'
  )
}

/**
 * Score-blocking normalization failure — names the blocking issue explicitly.
 * @param {string} status
 * @param {string[]} [flaggedFields]
 */
export function scoreBlockingNormalizationFailureMessage(status, flaggedFields) {
  if (status === 'taxonomy_expansion_required') {
    const materials =
      (flaggedFields ?? []).join(', ') || 'see scoring_inputs draft'
    return (
      `Missing material taxonomy (${materials}). ` +
      'Add taxonomy for the score-driving material field and re-run Agent 2.'
    )
  }
  const fields = (flaggedFields ?? []).join(', ') || status || 'unknown blocker'
  return `Agent 2 cannot produce score-driving normalized inputs: ${fields}.`
}

/**
 * @param {string} text
 */
export function countProductDescriptionWords(text) {
  return String(text ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length
}
