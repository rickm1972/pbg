/** Closed vocabularies for Agent 1 Human Review Gate (Phase 3). */

export const REVIEWED_PAYLOAD_SCHEMA_VERSION = '3.0.0'

export const COMPONENT_ROLE_OPTIONS = [
  'primary_food_contact',
  'coating',
  'substrate',
  'handle',
  'lid',
  'gasket',
  'packaging',
  'non_contact',
  'formulation',
] as const

export const COMPONENT_STRUCTURE_OPTIONS = [
  'single_material',
  'coating_over_substrate',
  'hybrid_surface',
  'multilayer',
  'formulation',
  'unknown',
] as const

export const CONTACT_PATHWAY_OPTIONS = [
  'food',
  'liquid',
  'skin',
  'oral',
  'indirect',
  'none',
  'unknown',
] as const

export const LAB_EVIDENCE_STATUS_OPTIONS = [
  'none',
  'claim_only',
  'third_party_non_detect',
  'composition_confirmed',
  'certification_only',
  'unclear',
] as const

export const LAB_APPLIES_TO_OPTIONS = [
  'exact_product',
  'product_line',
  'brand_general',
  'context',
  'unknown',
] as const

export const PROPRIETARY_STATUS_OPTIONS = [
  'disclosed',
  'known_category_proprietary',
  'unknown_proprietary',
  'not_applicable',
  'unknown',
] as const

export const PFAS_PTFE_STATUS_OPTIONS = [
  'confirmed_present',
  'non_detect_tested',
  'brand_claim_only',
  'not_detected_by_qualifying_lab',
  'unknown',
  'not_applicable',
] as const

export const TRANSPARENCY_BADGE_OPTIONS = [
  'Fully Disclosed',
  'Documentation Incomplete',
  'Material Uncertain',
  'Opaque',
] as const

/** Common cookware primary-contact canonical IDs for reviewer dropdown. */
export const CANONICAL_MATERIAL_ID_OPTIONS = [
  'cast_iron',
  'cast_iron_seasoned',
  'stainless_steel_304',
  'stainless_steel_316',
  'stainless_steel_18_10',
  'stainless_steel_18_8',
  'stainless_steel_unspecified',
  'stainless_steel_cooking_surface',
  'ceramic_nonstick_sol_gel_coating',
  'ceramic_nonstick_verified',
  'ptfe_nonstick_coating',
  'ptfe_nonstick_titanium_reinforced',
  'hybrid_stainless_nonstick_food_contact',
  'enameled_cast_iron_food_contact',
  'hard_anodized_aluminum',
  'graphite_structural_core',
  'TAXONOMY_EXPANSION_REQUIRED',
] as const
