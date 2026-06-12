/**
 * Gate 1 approval eligibility — live required-evidence validation + reviewer acknowledgments.
 */

import { validateRequiredEvidence } from '../required-evidence-matrix/validate-required-evidence.mjs'
import { getCanonicalApprovalBlockers } from '../canonical-taxonomy/score-driving-fields.mjs'
import { getGate1ContradictionBlockers } from './gate1-contradiction-blockers.mjs'
import { collectGate1AcknowledgmentWarnings } from './approval-gating-contract.mjs'

/**
 * @param {import('../required-evidence-matrix/types.mjs').RequiredEvidenceValidationPayload | null | undefined} validation
 */
export function listScoreDrivingReviewAcknowledgments(validation) {
  return (validation?.checklist_items ?? []).filter(
    (i) =>
      i.score_driving &&
      i.status === 'review_required' &&
      (i.severity === 'warning' || i.severity === 'info'),
  )
}

/**
 * @param {import('../required-evidence-matrix/types.mjs').RequiredEvidenceValidationPayload | null | undefined} validation
 */
export function listIncompleteScoreDrivingExternalChecks(validation) {
  return (validation?.checklist_items ?? []).filter(
    (i) =>
      i.category === 'external_check' &&
      i.score_driving &&
      i.status !== 'not_applicable' &&
      i.status !== 'passed' &&
      !(
        i.status === 'review_required' &&
        (i.severity === 'warning' || i.severity === 'info')
      ),
  )
}

/**
 * @param {object | null | undefined} structured
 * @param {object[]} [sources]
 * @param {object[]} [facts]
 */
export function resolveLiveRequiredEvidenceValidation(structured, sources = [], facts = []) {
  if (!structured) return null
  return validateRequiredEvidence(structured, sources, { facts })
}

/**
 * @param {object} params
 */
export function computeGate1ApprovalBlockers(params) {
  const {
    structured,
    sources = [],
    facts = [],
    warnings = [],
    warningsAcknowledged = true,
    requiredEvidenceReviewsAcknowledged = false,
    allFieldsConfirmed = true,
    canonicalReviewConfirmed = true,
    legacy = false,
    editable = true,
    usesRequiredEvidenceMatrix = true,
  } = params

  /** @type {string[]} */
  const reasons = []

  if (legacy) {
    reasons.push('Legacy bundle — re-run Agent 1 for structured provenance before approval.')
  }
  if (!editable) {
    reasons.push('This evidence version is not editable.')
  }
  const acknowledgmentWarnings = collectGate1AcknowledgmentWarnings({
    warnings,
    structured_evidence: structured,
  })
  if (acknowledgmentWarnings.length > 0 && !warningsAcknowledged) {
    reasons.push('Acknowledge validation warnings before approving.')
  }
  if (!allFieldsConfirmed && !legacy && !usesRequiredEvidenceMatrix) {
    reasons.push('Confirm each extracted field (or edit and confirm) before approving.')
  }

  if (usesRequiredEvidenceMatrix && structured) {
    const liveValidation = resolveLiveRequiredEvidenceValidation(structured, sources, facts)
    for (const b of liveValidation?.approval_blockers ?? []) {
      if (!reasons.includes(b)) reasons.push(b)
    }
    const reviewAckItems = listScoreDrivingReviewAcknowledgments(liveValidation)
    if (reviewAckItems.length > 0 && !requiredEvidenceReviewsAcknowledged) {
      const first = reviewAckItems[0]
      reasons.push(
        `Acknowledge required evidence review: ${first.label} — ${first.detail ?? 'human acknowledgment required'}`,
      )
    }
    if (canonicalReviewConfirmed === false) {
      reasons.push('Confirm each canonical score-driving field in the taxonomy table before approving.')
    }
  }

  if (structured && !structured.primary_contact_material?.material_identity?.trim()) {
    reasons.push('Primary contact material is required.')
  }

  if (structured) {
    for (const b of getGate1ContradictionBlockers(structured)) {
      if (!reasons.includes(b)) reasons.push(b)
    }
  }

  if (structured && !legacy && !usesRequiredEvidenceMatrix) {
    for (const b of getCanonicalApprovalBlockers(structured.canonical_mappings, {
      subcategory: structured.product_identity?.subcategory,
    })) {
      if (!reasons.includes(b)) reasons.push(b)
    }
  }

  return { canApprove: reasons.length === 0, reasons, liveValidation: resolveLiveRequiredEvidenceValidation(structured, sources, facts) }
}
