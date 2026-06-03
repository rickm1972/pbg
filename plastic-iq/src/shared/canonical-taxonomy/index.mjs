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

export const CANONICAL_TAXONOMY_COUNTS = {
  primary_contact_material: 5,
  substrate_material: 3,
  coating_modifier: 2,
  safety_claim: 6,
  pfas_status: 4,
  regulatory_flag: 1,
  component_type: 4,
}
