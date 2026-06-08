import { getCanonicalApprovalBlockers } from '../canonical-taxonomy/score-driving-fields.mjs'
import { VALIDATION_SCHEMA_VERSION } from './types.mjs'
import { resolveSubcategoryKey, isFormulationSubcategory } from './resolve-subcategory.mjs'
import { getMatrixForSubcategory } from './matrices/index.mjs'
import { detectPatternTriggers } from './pattern-triggers.mjs'
import { evaluateFieldRequirement } from './field-evaluators.mjs'
import { evaluateExternalCheck } from './external-checks.mjs'
import { CATEGORY_CONFIG_REQUIRED } from '../product-type-registry/preflight.mjs'

/**
 * @param {object} structured
 * @param {object[]} [sources]
 * @param {{ facts?: object[] }} [options]
 * @returns {import('./types.mjs').RequiredEvidenceValidationPayload}
 */
export function validateRequiredEvidence(structured, sources = [], options = {}) {
  const subcategory = structured?.product_identity?.subcategory ?? ''
  const category = structured?.product_identity?.category ?? ''
  const subcategoryKey = resolveSubcategoryKey(subcategory, { category })

  if (isFormulationSubcategory(subcategory)) {
    return formulationNotApplicablePayload(subcategoryKey ?? 'formulation')
  }

  if (!subcategoryKey) {
    return unconfiguredCategoryPayload(subcategory, category)
  }

  const matrix = getMatrixForSubcategory(subcategoryKey)
  const mappings = structured?.canonical_mappings
  const triggers = detectPatternTriggers(structured, mappings, sources)

  /** @type {import('./types.mjs').RequiredEvidenceChecklistItem[]} */
  const checklist_items = []

  const allFieldReqs = [
    ...matrix.product_identity_fields,
    ...matrix.material_component_fields,
    ...matrix.safety_claim_fields,
    ...matrix.use_care_fields,
    ...(matrix.optional_fields ?? []),
  ]

  for (const req of allFieldReqs) {
    const isOptional = req.required === false
    const result = evaluateFieldRequirement(structured, req)
    let status = result.status
    if (isOptional && status === 'missing') status = 'not_applicable'

    const severity =
      status === 'missing'
        ? req.score_driving
          ? 'blocker'
          : 'warning'
        : 'info'

    checklist_items.push({
      id: req.id,
      label: req.label,
      category: req.category,
      status,
      severity: isOptional ? 'info' : severity,
      score_driving: Boolean(req.score_driving) && !isOptional,
      field_path: req.field_path,
      source_url: result.source_url ?? null,
      source_quote: result.source_quote ?? null,
      detail: isOptional && result.status === 'missing' ? 'Optional — not provided' : (result.detail ?? null),
    })
  }

  for (const ext of matrix.external_checks) {
    if (ext.pattern_trigger && !triggers.has(ext.pattern_trigger)) {
      checklist_items.push({
        id: ext.id,
        label: ext.label,
        category: ext.category,
        status: 'not_applicable',
        severity: 'info',
        score_driving: Boolean(ext.score_driving),
        pattern_trigger: ext.pattern_trigger,
        source_url: null,
        source_quote: null,
        detail: `Pattern ${ext.pattern_trigger} not detected`,
      })
      continue
    }

    const result = evaluateExternalCheck(structured, sources, mappings, triggers, ext.id)
    const severity =
      result.severity ??
      (result.status === 'missing' && ext.score_driving ? 'blocker' : result.status === 'missing' ? 'warning' : 'info')

    checklist_items.push({
      id: ext.id,
      label: ext.label,
      category: ext.category,
      status: result.status,
      severity,
      score_driving: Boolean(ext.score_driving),
      pattern_trigger: ext.pattern_trigger ?? null,
      source_url: result.source_url ?? null,
      source_quote: result.source_quote ?? null,
      detail: result.detail ?? null,
    })
  }

  const canonicalBlockers = getCanonicalApprovalBlockers(mappings, { subcategory })
  const approval_blockers = []

  for (const item of checklist_items) {
    if (item.status === 'missing' && item.severity === 'blocker') {
      approval_blockers.push(`Required evidence: ${item.label} — ${item.detail ?? 'incomplete'}`)
    }
    if (item.status === 'review_required' && item.score_driving) {
      approval_blockers.push(`Required evidence review: ${item.label} — ${item.detail ?? 'needs reviewer'}`)
    }
  }

  for (const b of canonicalBlockers) {
    if (!approval_blockers.includes(b)) approval_blockers.push(b)
  }

  const requiredFieldItems = checklist_items.filter(
    (i) =>
      i.category !== 'external_check' &&
      i.status !== 'not_applicable' &&
      allFieldReqs.find((r) => r.id === i.id)?.required !== false,
  )
  const externalItems = checklist_items.filter((i) => i.category === 'external_check' && i.status !== 'not_applicable')

  const score_blocking_gaps = checklist_items.filter(
    (i) => i.score_driving && (i.status === 'missing' || (i.status === 'review_required' && i.severity === 'blocker')),
  ).length

  const non_score_gaps = checklist_items.filter(
    (i) => !i.score_driving && i.status === 'missing',
  ).length

  const identityOk = checklist_items
    .filter((i) => i.category === 'product_identity')
    .every((i) => i.status === 'passed' || i.status === 'not_applicable')

  const summary = {
    required_fields_complete: requiredFieldItems.every((i) => i.status === 'passed'),
    required_external_checks_complete: externalItems
      .filter((i) => i.score_driving)
      .every((i) => i.status === 'passed' || i.status === 'not_applicable'),
    missing_fields: checklist_items.filter((i) => i.status === 'missing').map((i) => i.id),
    score_blocking_gaps,
    non_score_gaps,
    product_identity_verified: identityOk,
    approval_blocked: approval_blockers.length > 0,
    active_triggers: [...triggers],
  }

  return {
    schema_version: VALIDATION_SCHEMA_VERSION,
    subcategory_key: subcategoryKey,
    matrix_display_label: matrix.display_label,
    evaluated_at: new Date().toISOString(),
    summary,
    checklist_items,
    approval_blockers,
  }
}

/**
 * @param {string} subcategoryKey
 */
function formulationNotApplicablePayload(subcategoryKey) {
  return {
    schema_version: VALIDATION_SCHEMA_VERSION,
    subcategory_key: subcategoryKey,
    matrix_display_label: 'Formulation (archived)',
    evaluated_at: new Date().toISOString(),
    summary: {
      required_fields_complete: true,
      required_external_checks_complete: true,
      missing_fields: [],
      score_blocking_gaps: 0,
      non_score_gaps: 0,
      product_identity_verified: true,
      approval_blocked: false,
      formulation_pipeline_disabled: true,
      active_triggers: [],
    },
    checklist_items: [],
    approval_blockers: [],
  }
}

function unconfiguredCategoryPayload(subcategory, category) {
  const detail = `${CATEGORY_CONFIG_REQUIRED}: no registry config for category="${category || '(unknown)'}", subcategory="${subcategory || '(unknown)'}".`
  return {
    schema_version: VALIDATION_SCHEMA_VERSION,
    subcategory_key: null,
    matrix_display_label: 'Unconfigured product type',
    evaluated_at: new Date().toISOString(),
    summary: {
      required_fields_complete: false,
      required_external_checks_complete: false,
      missing_fields: [],
      score_blocking_gaps: 1,
      non_score_gaps: 0,
      product_identity_verified: false,
      approval_blocked: true,
      category_config_required: true,
      active_triggers: [],
    },
    checklist_items: [],
    approval_blockers: [detail],
  }
}

/**
 * Mutates structured.required_evidence_validation
 * @param {object} structured
 * @param {object[]} [sources]
 * @param {{ facts?: object[] }} [options]
 */
export function applyRequiredEvidenceValidation(structured, sources = [], options = {}) {
  if (!structured || typeof structured !== 'object') {
    return validateRequiredEvidence({}, sources, options)
  }
  const validation = validateRequiredEvidence(structured, sources, options)
  structured.required_evidence_validation = validation
  return validation
}
