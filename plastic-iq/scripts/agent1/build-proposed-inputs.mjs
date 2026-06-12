/**
 * Agent 1 Phase 2 — build non-authoritative proposed closed-field payload from evidence packet.
 * Does not mutate structured_evidence or canonical_mappings. Never writes locked_* fields.
 */

import { isExpansionRequired } from '../../src/shared/canonical-taxonomy/constants.mjs'
import { PRIMARY_CONTACT_MATERIAL_TAXONOMY } from '../../src/shared/canonical-taxonomy/primary-contact-material-taxonomy.mjs'
import { SUBSTRATE_MATERIAL_TAXONOMY } from '../../src/shared/canonical-taxonomy/substrate-material-taxonomy.mjs'
import { COATING_MODIFIER_TAXONOMY } from '../../src/shared/canonical-taxonomy/coating-modifier-taxonomy.mjs'
import {
  COATED_RISK_PRIMARY_IDS,
  isInertFoodContactPrimary,
  isPtfeFamilyPrimary,
  PTFE_FAMILY_PRIMARY_IDS,
} from '../../src/shared/canonical-taxonomy/inert-cookware-structural.mjs'
import { extractManufacturerPublishedLabTesting } from '../../src/shared/agent2/manufacturer-lab-testing-evidence.mjs'
import { hasActualLabReportEvidence } from '../../src/shared/agent1/lab-report-evidence.mjs'

/** @typedef {import('../../src/types/lockedInput.ts').ProposedInputPayload} ProposedInputPayload */

export const PROPOSED_PAYLOAD_SCHEMA_VERSION = '2.0.0'

const SCORE_DRIVING_ROLES = new Set([
  'primary_food_contact',
  'coating',
  'substrate',
  'formulation',
  'gasket',
])

const SECONDARY_ROLE_MAP = {
  handle: 'handle',
  lid: 'lid',
  gasket: 'gasket',
  rivet: 'rivet',
  knob: 'handle',
  strap: 'handle',
  base: 'substrate',
  refill_bottle: 'packaging',
  cap: 'packaging',
  straw: 'non_contact',
  brush_bristle: 'non_contact',
  magnetic_base: 'non_contact',
  structural: 'non_contact',
  body: 'substrate',
  other: 'non_contact',
}

function taxonomyLabel(taxonomy, canonicalId) {
  if (!canonicalId || isExpansionRequired(canonicalId)) return null
  const entry = taxonomy.find((e) => e.canonical_id === canonicalId)
  return entry?.display_label ?? canonicalId.replace(/_/g, ' ')
}

function sourceIndexForUrl(sources, url) {
  if (!url) return null
  const idx = (sources ?? []).findIndex((s) => s.url === url)
  return idx >= 0 ? idx : null
}

function supportRefFromMapping(row, sources) {
  if (!row) return []
  const refs = []
  const idx = sourceIndexForUrl(sources, row.source_url)
  if (idx != null || row.source_url) {
    refs.push({
      source_index: idx,
      source_url: row.source_url ?? null,
      excerpt: row.source_quote ?? null,
      field_path: row.field_key ?? null,
    })
  }
  return refs
}

function inferComponentStructure(primaryId, substrateId, coatingModifierId) {
  if (primaryId === 'hybrid_stainless_nonstick_food_contact') return 'hybrid_surface'
  if (
    primaryId &&
    substrateId &&
    substrateId !== primaryId &&
    coatingModifierId &&
    !['no_coating_modifier', 'not_applicable'].includes(coatingModifierId)
  ) {
    return 'coating_over_substrate'
  }
  if (COATED_RISK_PRIMARY_IDS.has(primaryId) && substrateId) return 'coating_over_substrate'
  if (primaryId && isInertFoodContactPrimary(primaryId)) return 'single_material'
  if (substrateId && primaryId && substrateId !== primaryId) return 'multilayer'
  return 'unknown'
}

function inferContactPathway(role) {
  if (role === 'primary_food_contact' || role === 'coating' || role === 'substrate') return 'food'
  if (role === 'handle') return 'skin'
  if (role === 'lid' || role === 'gasket') return 'indirect'
  if (role === 'packaging') return 'indirect'
  if (role === 'formulation') return 'skin'
  if (role === 'non_contact') return 'none'
  return 'unknown'
}

function mapSecondaryRole(rawRole) {
  const key = String(rawRole ?? 'other').toLowerCase()
  return SECONDARY_ROLE_MAP[key] ?? 'non_contact'
}

function proposalConfidence(label) {
  const normalized = String(label ?? 'unknown').toLowerCase()
  if (normalized.includes('manufacturer') || normalized.includes('fully_disclosed')) return 'high'
  if (normalized.includes('retailer') || normalized.includes('third_party')) return 'medium'
  if (normalized.includes('inferred') || normalized.includes('unknown')) return 'low'
  return 'medium'
}

function mapLabEvidenceStatus(lab, structured, sources) {
  if (lab.testing_evidence_present && lab.testing_result === 'Non-Detect') {
    return 'third_party_non_detect'
  }
  if (lab.testing_evidence_present) return 'composition_confirmed'
  const claimOnly =
    structured?.safety_claims?.pfas_free_claim?.claimed ||
    structured?.required_check_results?.some((r) => /lab|test/i.test(String(r.detail ?? '')))
  if (claimOnly) return 'claim_only'
  const certOnly = (structured?.certifications?.claimed_certifications ?? []).some((c) =>
    /certif/i.test(String(c)),
  )
  if (certOnly) return 'certification_only'
  const anyLabText = (sources ?? []).some((s) =>
    hasActualLabReportEvidence(`${s.page_excerpt ?? ''} ${s.title ?? ''}`, { url: s.url }),
  )
  if (anyLabText) return 'unclear'
  return 'none'
}

function mapLabAppliesTo(structured, sources) {
  const blob = JSON.stringify(structured ?? {}).toLowerCase()
  if (/product line|collection|all products/i.test(blob)) return 'product_line'
  if (/brand-wide|our products/i.test(blob)) return 'brand_general'
  if ((sources ?? []).some((s) => /collection|category/i.test(String(s.url ?? '')))) {
    return 'context'
  }
  return 'exact_product'
}

function mapProprietaryStatus(primaryId, coatingModifierId, pcm) {
  const undisclosed = pcm?.undisclosed_code
  if (undisclosed === 'PROPRIETARY_NAMED') return 'known_category_proprietary'
  if (coatingModifierId === 'proprietary_nonstick_coating_undisclosed') {
    return 'unknown_proprietary'
  }
  if (primaryId && isInertFoodContactPrimary(primaryId)) return 'not_applicable'
  if (undisclosed === 'UNKNOWN') return 'unknown_proprietary'
  if (undisclosed === 'CONFLICTING') return 'unknown'
  return 'disclosed'
}

function mapPfasPtfeStatus(pfasId, primaryId, lab, safetyClaims) {
  if (lab.testing_evidence_present && lab.testing_result === 'Non-Detect') {
    return 'non_detect_tested'
  }
  if (pfasId === 'pfas_free_claimed' || safetyClaims?.pfas_free_claim?.claimed) {
    return 'brand_claim_only'
  }
  if (pfasId === 'pfas_not_present_inert_material' || isInertFoodContactPrimary(primaryId)) {
    return 'not_applicable'
  }
  if (isPtfeFamilyPrimary(primaryId) || PTFE_FAMILY_PRIMARY_IDS.has(primaryId)) {
    return 'confirmed_present'
  }
  if (pfasId === 'pfas_present_disclosed' || pfasId === 'pfas_intentionally_added_disclosed') {
    return 'confirmed_present'
  }
  return 'unknown'
}

function buildComponent({
  id,
  name,
  role,
  structure,
  canonicalId,
  canonicalLabel,
  isPrimary,
  confidenceLabel,
  mappingRow,
  sources,
  notes,
  isScoreDriving,
}) {
  const defaultScoreDriving = SCORE_DRIVING_ROLES.has(role)
  return {
    proposed_component_id: id,
    proposed_component_name: name,
    proposed_component_role: role,
    proposed_component_structure: structure,
    proposed_contact_pathway: inferContactPathway(role),
    proposed_is_primary_contact: isPrimary,
    proposed_is_score_driving: isScoreDriving ?? defaultScoreDriving,
    proposed_canonical_material_id: isExpansionRequired(canonicalId) ? null : canonicalId,
    proposed_canonical_material_label: canonicalLabel,
    material_mapping_evidence_claim_ids: supportRefFromMapping(mappingRow, sources).map(
      (_, i) => `${id}-ref-${i}`,
    ),
    evidence_support_refs: supportRefFromMapping(mappingRow, sources),
    proposal_confidence: proposalConfidence(confidenceLabel),
    proposal_notes: notes ?? null,
  }
}

/**
 * @param {object} params
 * @param {object} params.product
 * @param {object} params.evidence — saved product_evidence row or equivalent
 * @param {object[]} [params.sources]
 * @param {object} [params.structured] — structured_evidence; defaults from evidence
 * @returns {ProposedInputPayload}
 */
export function buildProposedInputPayload({ product, evidence, sources, structured }) {
  const structuredEvidence =
    structured ?? evidence?.agent_metadata?.structured_evidence ?? evidence?.structured_evidence ?? null
  if (!structuredEvidence) {
    throw new Error('buildProposedInputPayload requires structured_evidence on evidence packet')
  }

  const sourceList = sources ?? evidence?.sources ?? []
  const mappings = structuredEvidence.canonical_mappings ?? {}
  const identity = structuredEvidence.product_identity ?? {}
  const pcm = structuredEvidence.primary_contact_material ?? {}

  const primaryRow = mappings.primary_contact_material_id ?? null
  const substrateRow = mappings.substrate_material_id ?? null
  const coatingModRow = mappings.coating_modifier_id ?? null

  const primaryId = primaryRow?.canonical_id ?? null
  const substrateId = substrateRow?.canonical_id ?? null
  const coatingModId = coatingModRow?.canonical_id ?? null

  const primaryStructure = inferComponentStructure(primaryId, substrateId, coatingModId)
  const isHybridPrimaryFoodContact = primaryId === 'hybrid_stainless_nonstick_food_contact'
  /** @type {import('../../src/types/lockedInput.ts').ProposedComponentInput[]} */
  const proposed_components = []

  if (primaryId) {
    proposed_components.push(
      buildComponent({
        id: 'proposed-primary-food-contact',
        name: identity.product_name
          ? `${identity.product_name} cooking surface`
          : 'Primary food-contact surface',
        role: 'primary_food_contact',
        structure: primaryStructure,
        canonicalId: primaryId,
        canonicalLabel: taxonomyLabel(PRIMARY_CONTACT_MATERIAL_TAXONOMY, primaryId),
        isPrimary: true,
        confidenceLabel: primaryRow?.confidence_label ?? pcm.confidence_label,
        mappingRow: primaryRow,
        sources: sourceList,
        notes: 'Suggested from canonical_mappings.primary_contact_material_id (non-authoritative).',
      }),
    )
  }

  if (
    substrateId &&
    substrateId !== primaryId &&
    substrateId !== 'cast_iron_body' &&
    !proposed_components.some((c) => c.proposed_canonical_material_id === substrateId)
  ) {
    proposed_components.push(
      buildComponent({
        id: 'proposed-substrate',
        name: isHybridPrimaryFoodContact
          ? 'Pan Body — Stainless steel (grade unspecified)'
          : 'Cookware body / substrate',
        role: isHybridPrimaryFoodContact ? 'structural' : 'substrate',
        structure: primaryStructure,
        canonicalId: substrateId,
        canonicalLabel: taxonomyLabel(SUBSTRATE_MATERIAL_TAXONOMY, substrateId),
        isPrimary: false,
        confidenceLabel: substrateRow?.confidence_label,
        mappingRow: substrateRow,
        sources: sourceList,
        isScoreDriving: isHybridPrimaryFoodContact ? true : undefined,
        notes: isHybridPrimaryFoodContact
          ? 'Pan body structural component — low contact intimacy (CI 0.1) for v2.3.5 CI-weighted NPR dilution alongside hybrid food-contact rows.'
          : null,
      }),
    )
  } else if (substrateId && substrateId !== primaryId) {
    proposed_components.push(
      buildComponent({
        id: 'proposed-substrate-body',
        name: isHybridPrimaryFoodContact
          ? 'Pan Body — Stainless steel (grade unspecified)'
          : 'Cookware body',
        role: isHybridPrimaryFoodContact ? 'structural' : 'substrate',
        structure: primaryStructure,
        canonicalId: substrateId,
        canonicalLabel: taxonomyLabel(SUBSTRATE_MATERIAL_TAXONOMY, substrateId),
        isPrimary: false,
        confidenceLabel: substrateRow?.confidence_label,
        mappingRow: substrateRow,
        sources: sourceList,
        isScoreDriving: isHybridPrimaryFoodContact ? true : undefined,
        notes: isHybridPrimaryFoodContact
          ? 'Pan body structural component — low contact intimacy (CI 0.1) for v2.3.5 CI-weighted NPR dilution alongside hybrid food-contact rows.'
          : null,
      }),
    )
  }

  if (
    coatingModId &&
    !['no_coating_modifier', 'not_applicable'].includes(coatingModId) &&
    !proposed_components.some((c) => c.proposed_canonical_material_id === coatingModId)
  ) {
    proposed_components.push(
      buildComponent({
        id: 'proposed-coating-modifier',
        name: structuredEvidence.coatings_and_finishes?.[0]?.coating_name ?? 'Coating modifier',
        role: 'coating',
        structure: primaryStructure,
        canonicalId: coatingModId,
        canonicalLabel: taxonomyLabel(COATING_MODIFIER_TAXONOMY, coatingModId),
        isPrimary: false,
        confidenceLabel: coatingModRow?.confidence_label,
        mappingRow: coatingModRow,
        sources: sourceList,
        isScoreDriving: isHybridPrimaryFoodContact ? false : undefined,
        notes: isHybridPrimaryFoodContact
          ? 'Hybrid primary food-contact row carries score-driving exposure; coating modifier retained for proprietary/badge context only.'
          : null,
      }),
    )
  }

  for (const [idx, sec] of (structuredEvidence.secondary_components ?? []).entries()) {
    const role = mapSecondaryRole(sec.component_role)
    proposed_components.push(
      buildComponent({
        id: `proposed-secondary-${idx}`,
        name: sec.material_identity ?? sec.component_role ?? `Secondary ${idx + 1}`,
        role,
        structure: role === 'substrate' || role === 'structural' ? 'single_material' : 'unknown',
        canonicalId: null,
        canonicalLabel: sec.material_identity ?? null,
        isPrimary: false,
        confidenceLabel: sec.confidence_label,
        mappingRow: { source_url: sec.source_url, field_key: `secondary_components[${idx}]` },
        sources: sourceList,
        isScoreDriving: isHybridPrimaryFoodContact && role === 'handle' ? true : undefined,
        notes:
          isHybridPrimaryFoodContact && role === 'handle'
            ? 'Handle included for CI-weighted NPR dilution (CI 0.5) per v2.3.5 hybrid dual-surface model.'
            : sec.material_identity
              ? 'Secondary component material_identity is freeform until human review maps canonical ID.'
              : null,
      }),
    )
  }

  const labEvidencePacket = {
    sources: sourceList,
    agent_metadata: { structured_evidence: structuredEvidence },
  }
  const lab = extractManufacturerPublishedLabTesting(labEvidencePacket)
  const labStatus = mapLabEvidenceStatus(lab, structuredEvidence, sourceList)
  const proprietaryStatus = mapProprietaryStatus(primaryId, coatingModId, pcm)
  const pfasPtfeStatus = mapPfasPtfeStatus(
    mappings.pfas_status_id?.canonical_id,
    primaryId,
    lab,
    structuredEvidence.safety_claims,
  )

  const transparency = structuredEvidence.transparency_assessment ?? null
  const unknownCoatingCapCandidate =
    proprietaryStatus !== 'known_category_proprietary' &&
    (coatingModId === 'proprietary_nonstick_coating_undisclosed' ||
      pcm.undisclosed_code === 'UNKNOWN' ||
      primaryStructure === 'hybrid_surface')

  const knownCategoryProprietaryCandidate =
    proprietaryStatus === 'known_category_proprietary' ||
    coatingModId === 'proprietary_nonstick_coating_undisclosed'

  const layer4aCreditCandidates = []
  const layer4aDeductionCandidates = []
  if (lab.testing_evidence_present && lab.testing_result === 'Non-Detect') {
    layer4aCreditCandidates.push('manufacturer_published_non_detect_lab_testing')
  }
  if (knownCategoryProprietaryCandidate) {
    layer4aDeductionCandidates.push('proprietary_ceramic_or_nonstick_formula_undisclosed')
  }
  if (unknownCoatingCapCandidate) {
    layer4aDeductionCandidates.push('unknown_proprietary_food_contact_coating_cap_candidate')
  }

  const sourceSupportIds = sourceList.map((s, i) => `source-${i}`)

  return {
    schema_version: PROPOSED_PAYLOAD_SCHEMA_VERSION,
    non_authoritative: true,
    product_context: {
      product_id: product?.product_id ?? evidence?.product_id ?? null,
      evidence_id: evidence?.evidence_id ?? null,
      category: product?.category ?? identity.category ?? null,
      subcategory: product?.subcategory ?? identity.subcategory ?? null,
      product_type: identity.product_type ?? null,
      brand: identity.brand ?? product?.brand ?? null,
      product_name: identity.product_name ?? product?.product_name ?? null,
      variant_or_sku: identity.sku_or_model ?? null,
      source_support_ids: sourceSupportIds,
    },
    proposed_components,
    proposed_lab_evidence_status: labStatus,
    proposed_lab_applies_to: mapLabAppliesTo(structuredEvidence, sourceList),
    proposed_non_detect_mitigation_candidate:
      lab.testing_evidence_present && lab.testing_result === 'Non-Detect',
    proposed_lab_source_ids: lab.testing_source_url ? [lab.testing_source_url] : [],
    proposed_analytes_tested: lab.tested_analytes ?? [],
    proposed_result_language: lab.testing_result ?? null,
    proposed_lab_notes: lab.testing_evidence_present
      ? 'Lab/testing fields are proposal candidates only — not validated in Phase 2.'
      : null,
    proposed_proprietary_status: proprietaryStatus,
    proposed_pfas_ptfe_status: pfasPtfeStatus,
    proposed_coating_family_status: coatingModId ?? primaryId ?? 'unknown',
    proposed_unknown_coating_cap_candidate: unknownCoatingCapCandidate,
    proposed_known_category_proprietary_candidate: knownCategoryProprietaryCandidate,
    proposed_use_condition_override: false,
    proposed_contact_intimacy_override: null,
    proposed_severity_override: null,
    proposed_duration_override: null,
    proposed_use_condition_override_reason:
      'No evidence-backed override proposed; category defaults should apply.',
    proposed_use_condition_source_ids: [],
    proposed_layer_4a_flags: {
      candidate_only: true,
      credit_candidates: layer4aCreditCandidates,
      deduction_candidates: layer4aDeductionCandidates,
    },
    proposed_layer_4a_credit_candidates: layer4aCreditCandidates,
    proposed_layer_4a_deduction_candidates: layer4aDeductionCandidates,
    proposed_layer_4a_notes:
      'Layer 4A fields are unvalidated candidates for Phase 3 review and Phase 4 system validation.',
    proposed_layer_4a_source_ids: sourceSupportIds.filter(Boolean).slice(0, 3),
    proposed_cap_flag: unknownCoatingCapCandidate,
    proposed_cap_reason: unknownCoatingCapCandidate
      ? 'Unknown or undisclosed proprietary food-contact coating may trigger cap during validation.'
      : null,
    proposed_escalator_candidate: isPtfeFamilyPrimary(primaryId) ? 'escalator_1_candidate' : null,
    proposed_escalator_reason: isPtfeFamilyPrimary(primaryId)
      ? 'PTFE-family primary contact may trigger escalator during validation.'
      : null,
    proposed_cap_escalator_source_ids: sourceSupportIds.slice(0, 2),
    proposed_transparency_badge: transparency?.transparency_badge ?? null,
    proposed_badge_basis: transparency?.badge_justification ?? null,
    proposed_badge_notes: transparency
      ? 'Badge proposal copied from Gate 1 transparency_assessment suggestion — not score-authoritative.'
      : null,
    proposed_badge_source_ids: sourceSupportIds.slice(0, 2),
    evidence_support_refs: supportRefFromMapping(primaryRow, sourceList),
    // Legacy Phase 1 flat aliases retained for compatibility
    proposed_lab_applies_to_scope: mapLabAppliesTo(structuredEvidence, sourceList),
    proposed_pfas_status: pfasPtfeStatus,
    proposed_ptfe_status: isPtfeFamilyPrimary(primaryId) ? 'confirmed_present' : 'not_applicable',
    proposed_layer_4a_flags_legacy: {
      positive_adjustments: layer4aCreditCandidates,
      negative_adjustments: layer4aDeductionCandidates,
      unknown_coating_cap_applies: unknownCoatingCapCandidate,
      proprietary_ceramic_formula_undisclosed: knownCategoryProprietaryCandidate,
    },
    proposed_cap_flag_legacy: unknownCoatingCapCandidate,
    proposed_escalator_candidate_legacy: isPtfeFamilyPrimary(primaryId),
  }
}

/**
 * @param {object} payload
 */
export function assertProposedPayloadHasNoLockedFields(payload) {
  const walk = (value, path = '') => {
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) walk(value[i], `${path}[${i}]`)
      return
    }
    if (value && typeof value === 'object') {
      for (const [key, child] of Object.entries(value)) {
        if (key.startsWith('locked_')) {
          throw new Error(`Proposed payload must not contain locked_* field at ${path}.${key}`)
        }
        walk(child, path ? `${path}.${key}` : key)
      }
    }
  }
  walk(payload)
}
