/**
 * Phase 3.5: Agent 2 refuses normalization without approved canonical mappings.
 */
import { getStructuredEvidence } from './schema-input.mjs'
import { getCanonicalApprovalBlockers, isExpansionRequired } from '../../../src/shared/canonical-taxonomy/index.mjs'

/**
 * @param {object} evidence
 * @param {object} [product]
 */
export function assertCanonicalMappingsReady(evidence, product = {}) {
  const structured = getStructuredEvidence(evidence)
  if (!structured) {
    throw new Error('Agent 2 requires structured_evidence with Phase 3.5 canonical_mappings.')
  }

  const mappings = structured.canonical_mappings
  if (!mappings?.schema_version) {
    throw new Error(
      'Agent 2 requires canonical_mappings on structured_evidence (Gate 1 Phase 3.5). Re-open Gate 1 to apply mappings or backfill.',
    )
  }

  const blockers = getCanonicalApprovalBlockers(mappings, {
    subcategory: structured?.product_identity?.subcategory ?? product?.subcategory,
  })
  if (blockers.length > 0) {
    throw new Error(`Canonical taxonomy not ready for Agent 2: ${blockers.join(' ')}`)
  }

  const primary = mappings.primary_contact_material_id
  if (!primary?.canonical_id || isExpansionRequired(primary.canonical_id)) {
    throw new Error('primary_contact_material_id canonical mapping is required before Agent 2.')
  }
}
