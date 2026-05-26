/**
 * Check 5 — Why This Score vocabulary options present and valid.
 */

import { allowedOptionsForField } from '../../agent2/why-this-score-vocabulary.mjs'

const FIELD_KEYS = [
  'primary_material_options',
  'secondary_materials_options',
  'coatings_finishes_options',
  'use_conditions_options',
  'disclosure_quality_options',
  'certifications_options',
]

/**
 * @param {object} score — product_scores row
 * @param {object} inputs — scoring_inputs.inputs jsonb
 * @param {object} [scoringInputRow] — full scoring_inputs row
 */
export function runExplanationAccuracy(score, inputs, scoringInputRow = null) {
  const flags = []
  const issues = []
  const row = scoringInputRow ?? {}

  for (const key of FIELD_KEYS) {
    const value = row[key]
    if (!Array.isArray(value) || value.length === 0) {
      flags.push({ code: 'WHY_FIELD_MISSING', message: `${key} is empty` })
      issues.push(`missing ${key}`)
      continue
    }

    const allowed = new Set(allowedOptionsForField(key))
    for (const item of value) {
      if (!allowed.has(item)) {
        flags.push({
          code: 'WHY_OPTION_NOT_IN_VOCABULARY',
          message: `${key} contains non-vocabulary option: ${item}`,
        })
        issues.push(`invalid option ${item}`)
      }
    }
  }

  const disclosure = Array.isArray(row.disclosure_quality_options)
    ? row.disclosure_quality_options[0]
    : null
  const badge = String(inputs?.layer_4b?.transparency_badge ?? '').trim()
  if (disclosure && badge && disclosure !== badge) {
    flags.push({
      code: 'DISCLOSURE_BADGE_MISMATCH',
      message: `disclosure_quality_options (${disclosure}) does not match layer_4b badge (${badge})`,
    })
    issues.push('disclosure badge mismatch')
  }

  if (flags.length) {
    return { status: 'flag', flags, issues }
  }

  return { status: 'pass', flags: [], issues: [] }
}
