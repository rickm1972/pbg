/** @typedef {'passed' | 'missing' | 'not_applicable' | 'review_required'} CheckStatus */
/** @typedef {'blocker' | 'warning' | 'info'} CheckSeverity */
/** @typedef {'product_identity' | 'material_component' | 'safety_claim' | 'use_care' | 'external_check' | 'canonical'} CheckCategory */

/**
 * @typedef {object} MatrixFieldRequirement
 * @property {string} id
 * @property {string} label
 * @property {CheckCategory} category
 * @property {string} field_path
 * @property {boolean} [score_driving]
 * @property {boolean} [required]
 */

/**
 * @typedef {object} MatrixExternalCheckTemplate
 * @property {string} id
 * @property {string} label
 * @property {CheckCategory} category
 * @property {string} [pattern_trigger]
 * @property {boolean} [score_driving]
 */

/**
 * @typedef {object} SubcategoryMatrix
 * @property {string} subcategory_key
 * @property {string} display_label
 * @property {MatrixFieldRequirement[]} product_identity_fields
 * @property {MatrixFieldRequirement[]} material_component_fields
 * @property {MatrixFieldRequirement[]} safety_claim_fields
 * @property {MatrixFieldRequirement[]} use_care_fields
 * @property {MatrixFieldRequirement[]} optional_fields
 * @property {string[]} non_score_fields
 * @property {MatrixExternalCheckTemplate[]} external_checks
 */

/**
 * @typedef {object} RequiredEvidenceChecklistItem
 * @property {string} id
 * @property {string} label
 * @property {CheckCategory} category
 * @property {CheckStatus} status
 * @property {CheckSeverity} severity
 * @property {boolean} score_driving
 * @property {string} [field_path]
 * @property {string} [pattern_trigger]
 * @property {string | null} [source_url]
 * @property {string | null} [source_quote]
 * @property {string | null} [detail]
 */

/**
 * @typedef {object} RequiredEvidenceValidationPayload
 * @property {string} schema_version
 * @property {string} subcategory_key
 * @property {string} evaluated_at
 * @property {object} summary
 * @property {RequiredEvidenceChecklistItem[]} checklist_items
 * @property {string[]} approval_blockers
 */

export const VALIDATION_SCHEMA_VERSION = '3.6'
