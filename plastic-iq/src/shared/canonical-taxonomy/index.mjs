export { TAXONOMY_EXPANSION_REQUIRED, isExpansionRequired } from './constants.mjs'
export { PRIMARY_CONTACT_MATERIAL_TAXONOMY } from './primary-contact-material-taxonomy.mjs'
export { SUBSTRATE_MATERIAL_TAXONOMY } from './substrate-material-taxonomy.mjs'
export { COATING_MODIFIER_TAXONOMY } from './coating-modifier-taxonomy.mjs'
export { SAFETY_CLAIM_TAXONOMY } from './safety-claim-taxonomy.mjs'
export { PFAS_STATUS_TAXONOMY } from './pfas-status-taxonomy.mjs'
export { REGULATORY_FLAG_TAXONOMY } from './regulatory-flag-taxonomy.mjs'
export { COMPONENT_TYPE_TAXONOMY } from './component-type-taxonomy.mjs'
export { CERTIFICATION_CANONICAL_TAXONOMY, CERTIFICATION_TAXONOMY, resolveCertEntry } from './certification-canonical-taxonomy.mjs'
export {
  COOKWARE_SCORE_DRIVING_FIELDS,
  SAFETY_CLAIM_FIELD_KEYS,
  getCanonicalApprovalBlockers,
} from './score-driving-fields.mjs'
export { applyCanonicalMappings } from './map-structured-evidence.mjs'
export {
  reconcileCanonicalMappingsConfidence,
  inferConfidenceForSafetyClaim,
} from './confidence-label-consistency.mjs'

export {
  isInertFoodContactPrimary,
  isStructurallyPfasFreePrimary,
  isPtfeFamilyPrimary,
  requiresCoatingModifier,
  shouldApplyMinnesotaPfasRegulatoryFlag,
  PTFE_FAMILY_PRIMARY_IDS,
  STRUCTURALLY_PFAS_FREE_PRIMARY_IDS,
} from './inert-cookware-structural.mjs'

export const CANONICAL_TAXONOMY_COUNTS = {
  primary_contact_material: 14,
  substrate_material: 3,
  coating_modifier: 4,
  safety_claim: 7,
  pfas_status: 5,
  regulatory_flag: 1,
  component_type: 4,
}
