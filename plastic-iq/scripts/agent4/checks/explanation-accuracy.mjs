/**
 * Check 5 — Why This Score vocabulary options present and valid.
 */

import { buildWhyThisScoreOptions } from '../../agent2/why-this-score-map.mjs'
import {
  isAllowedWhyOption,
  NONE,
  normalizeDisclosureBadge,
} from '../../../src/shared/why-this-score-vocabulary.mjs'

const FIELD_KEYS = [
  'primary_material_options',
  'secondary_materials_options',
  'coatings_finishes_options',
  'use_conditions_options',
  'disclosure_quality_options',
  'certifications_options',
]

/** @param {string} fieldKey */
function optionsForValidation(fieldKey, stored, rebuilt) {
  const source = rebuilt?.[fieldKey]?.length ? rebuilt[fieldKey] : stored
  if (!Array.isArray(source)) return []
  return source.filter((item) => {
    const s = String(item ?? '').trim()
    if (!s) return false
    if (fieldKey === 'primary_material_options' && s === NONE) return false
    return true
  })
}

/**
 * @param {object} score — product_scores row
 * @param {object} inputs — scoring_inputs.inputs jsonb
 * @param {object} [scoringInputRow] — full scoring_inputs row
 * @param {object} [evidence] — approved product_evidence (rebuild options when present)
 */
export function runExplanationAccuracy(score, inputs, scoringInputRow = null, evidence = null) {
  const flags = []
  const issues = []
  const row = scoringInputRow ?? {}
  const rebuilt =
    evidence && inputs ? buildWhyThisScoreOptions(evidence, inputs) : null

  for (const key of FIELD_KEYS) {
    const value = optionsForValidation(key, row[key], rebuilt)
    if (value.length === 0) {
      flags.push({ code: 'WHY_FIELD_MISSING', message: `${key} is empty` })
      issues.push(`missing ${key}`)
      continue
    }

    for (const item of value) {
      if (!isAllowedWhyOption(key, item)) {
        flags.push({
          code: 'WHY_OPTION_NOT_IN_VOCABULARY',
          message: `${key} contains non-vocabulary option: ${item}`,
        })
        issues.push(`invalid option ${item}`)
      }
    }
  }

  const disclosure = Array.isArray(
    optionsForValidation('disclosure_quality_options', row.disclosure_quality_options, rebuilt),
  )
    ? normalizeDisclosureBadge(
        optionsForValidation('disclosure_quality_options', row.disclosure_quality_options, rebuilt)[0],
      )
    : null
  const badge = normalizeDisclosureBadge(inputs?.layer_4b?.transparency_badge ?? '')
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
