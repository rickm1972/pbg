/**
 * Known proprietary ceramic nonstick vs truly unknown proprietary coating (V2.3.4).
 * Category-known ceramic uses ceramic sol-gel base bands; mystery coatings use extreme patch.
 */

/** Caraway-equivalent ceramic nonstick sol-gel base band. */
export const CERAMIC_NONSTICK_BASE_HAZARD = 0.35
export const CERAMIC_NONSTICK_BASE_MIGRATION = 0.38

/** Modest migration mitigation for manufacturer-published Non-Detect lab testing (~42% below base 0.38). */
export const CERAMIC_LAB_NON_DETECT_MIGRATION = 0.22

export const LAYER_4A_PROPRIETARY_CHEMISTRY_UNDISCLOSED = {
  reason: 'Proprietary food-contact coating chemistry undisclosed',
  value: -3,
}

export const LAYER_4A_UNKNOWN_PROPRIETARY_COATING = {
  reason: 'Unknown proprietary food-contact coating',
  value: -3,
}

/** Component-level ceramic nonstick material IDs — not product-level primary-contact taxonomy IDs. */
const KNOWN_CERAMIC_NONSTICK_MATERIAL_IDS = new Set([
  'ceramic_nonstick_sol_gel',
  'ceramic_nonstick_sol_gel_coating',
  'thermolon_ceramic',
  'terrabond_proprietary',
])

/** Structural/inert components must keep their own material identity — never ceramic bands. */
const NON_CERAMIC_COMPONENT_MATERIAL_IDS = new Set([
  'laser_etched_stainless_surface',
  'stainless_steel_304',
  'stainless_steel_316',
  'stainless_steel_unspecified',
  'stainless_steel_handle',
  'stainless_steel_rivets',
  'stainless_steel_body',
  'aluminum_core',
  'hard_anodized_aluminum',
  'cast_iron',
  'cast_iron_preseasoned',
  'carbon_steel',
  'glass_lid',
  'borosilicate_glass',
  'stay_cool_handle_undisclosed',
])

const KNOWN_CERAMIC_COATING_MODIFIER_IDS = new Set([
  'ceramic_sol_gel_nonstick_coating',
  'proprietary_nonstick_coating_undisclosed',
])

const CERAMIC_COATING_COMPONENT_RE =
  /valley|terrabond|terra\s*bond|ceramic.*nonstick|nonstick.*ceramic|sol[-\s]?gel.*nonstick|proprietary.*ceramic.*nonstick|nonstick.*coating/i

const STAINLESS_PEAK_COMPONENT_RE =
  /laser.etched|hexagonal peak|stainless.*peak|peak.*stainless|raised.*stainless/i

const TRULY_UNKNOWN_RE =
  /unknown proprietary food-contact|proprietary_named_food_contact|material family unknown|coating composition not identified/i

function componentIdentityBlob(component) {
  return [
    component?.component_name,
    component?.material,
    component?.material_hazard_table_entry,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function isExcludedNonCeramicComponent(materialId, component = {}) {
  const id = String(materialId ?? component?.material_id ?? '').toLowerCase().trim()
  if (NON_CERAMIC_COMPONENT_MATERIAL_IDS.has(id)) return true

  const role = component?.role ?? component?.component_role
  if (role === 'handle' || role === 'structural' || role === 'packaging' || role === 'refill_bottle') {
    return true
  }

  const blob = componentIdentityBlob(component)
  if (STAINLESS_PEAK_COMPONENT_RE.test(blob)) return true

  return false
}

function isCeramicCoatingShapedComponent(component, evidence = null) {
  const blob = componentIdentityBlob(component)
  if (STAINLESS_PEAK_COMPONENT_RE.test(blob)) return false
  if (CERAMIC_COATING_COMPONENT_RE.test(blob)) return true

  const modifier = canonicalCoatingModifier(evidence)
  if (modifier && KNOWN_CERAMIC_COATING_MODIFIER_IDS.has(modifier) && CERAMIC_COATING_COMPONENT_RE.test(blob)) {
    return true
  }

  const role = component?.role ?? component?.component_role
  return role === 'coating'
}

function canonicalCoatingModifier(evidence) {
  return (
    evidence?.agent_metadata?.structured_evidence?.canonical_mappings?.coating_modifier_id
      ?.canonical_id ?? null
  )
}

function canonicalPrimaryContact(evidence) {
  return (
    evidence?.agent_metadata?.structured_evidence?.canonical_mappings
      ?.primary_contact_material_id?.canonical_id ?? null
  )
}

function coatingTypeBlob(evidence) {
  const coatings = evidence?.agent_metadata?.structured_evidence?.coatings_and_finishes ?? []
  return coatings
    .map((c) => `${c.coating_name ?? ''} ${c.coating_type ?? ''}`)
    .join(' ')
    .toLowerCase()
}

/**
 * Category-known proprietary ceramic nonstick — formula may be undisclosed but family is identified.
 * @param {string | null | undefined} materialId
 * @param {object} [component]
 * @param {object | null} [evidence]
 */
export function isKnownProprietaryCeramicNonstickMaterial(materialId, component = {}, evidence = null) {
  if (isExcludedNonCeramicComponent(materialId, component)) return false

  const id = String(materialId ?? component?.material_id ?? '').toLowerCase().trim()
  if (!id) return false

  if (KNOWN_CERAMIC_NONSTICK_MATERIAL_IDS.has(id)) return true

  const compBlob = componentIdentityBlob(component)
  const modifier = canonicalCoatingModifier(evidence)
  const primary = canonicalPrimaryContact(evidence)

  if (
    modifier &&
    KNOWN_CERAMIC_COATING_MODIFIER_IDS.has(modifier) &&
    isCeramicCoatingShapedComponent(component, evidence)
  ) {
    return true
  }

  if (
    (primary === 'hybrid_stainless_nonstick_food_contact' ||
      primary === 'ceramic_nonstick_sol_gel_coating') &&
    isCeramicCoatingShapedComponent(component, evidence)
  ) {
    return true
  }

  if (id === 'proprietary_named_food_contact' && CERAMIC_COATING_COMPONENT_RE.test(compBlob)) {
    return true
  }

  return (
    CERAMIC_COATING_COMPONENT_RE.test(compBlob) &&
    /proprietary|undisclosed|nonstick/i.test(compBlob)
  )
}

/**
 * Truly unknown proprietary coating — family not reliably identified.
 */
export function isTrulyUnknownProprietaryCoatingMaterial(materialId, component = {}, evidence = null) {
  const id = String(materialId ?? component?.material_id ?? '').toLowerCase().trim()
  if (!id) return false
  if (isKnownProprietaryCeramicNonstickMaterial(id, component, evidence)) return false

  if (id === 'proprietary_named_food_contact') return true
  if (TRULY_UNKNOWN_RE.test(`${component?.material ?? ''} ${component?.component_name ?? ''}`)) {
    return true
  }

  const modifier = canonicalCoatingModifier(evidence)
  if (
    modifier === 'proprietary_nonstick_coating_undisclosed' &&
    !CERAMIC_COATING_COMPONENT_RE.test(coatingTypeBlob(evidence))
  ) {
    return true
  }

  return false
}

/** @deprecated Use isTrulyUnknownProprietaryCoatingMaterial — kept for Layer 4A cap gating. */
export function isUnknownFoodContactCoatingForLayer4a(materialId, component = {}, evidence = null) {
  return isTrulyUnknownProprietaryCoatingMaterial(materialId, component, evidence)
}

export function ceramicNonstickScoringBands() {
  return {
    material_hazard: CERAMIC_NONSTICK_BASE_HAZARD,
    material_hazard_table_entry: 'Ceramic nonstick sol-gel — 0.35 (category-known proprietary ceramic)',
    base_migration_potential: CERAMIC_NONSTICK_BASE_MIGRATION,
    adjusted_migration_potential: CERAMIC_NONSTICK_BASE_MIGRATION,
    migration_table_entry: 'Ceramic nonstick sol-gel — 0.38 (category-known proprietary ceramic)',
    inert_protection_applies: false,
  }
}

/**
 * @param {object | null | undefined} testingEvidence — inputs.testing_evidence or extract output
 */
export function qualifiesCeramicLabNonDetectMitigation(testingEvidence) {
  const te = testingEvidence
  if (!te?.testing_evidence_present) return false
  if (te.testing_evidence_type !== 'manufacturer_published_third_party_lab_result') return false
  if (String(te.testing_result ?? '').trim().toLowerCase() !== 'non-detect') return false
  const analytes = te.tested_analytes ?? []
  return analytes.some((a) => /pfas|ptfe|pfoa|pfos|pfbs/i.test(String(a)))
}

/**
 * Migration mitigation only — does not change hazard or inert status.
 * @param {number} baseMigration
 * @param {object | null | undefined} testingEvidence
 */
export function mitigatedCeramicNonstickMigration(baseMigration, testingEvidence) {
  if (!qualifiesCeramicLabNonDetectMitigation(testingEvidence)) {
    return {
      migration: baseMigration,
      mitigated: false,
      migration_table_note: null,
    }
  }
  return {
    migration: CERAMIC_LAB_NON_DETECT_MIGRATION,
    mitigated: true,
    migration_table_note:
      'Ceramic nonstick sol-gel — 0.22 (modest Non-Detect lab mitigation from base 0.38; hazard unchanged)',
  }
}

/**
 * Apply ceramic base bands + optional lab migration to a food-contact coating component.
 * @param {object} component
 * @param {object | null} [evidence]
 * @param {object | null} [testingEvidence]
 */
export function applyKnownCeramicNonstickScoringBands(component, evidence = null, testingEvidence = null) {
  const role = component.role ?? component.component_role
  if (role !== 'primary_food_contact' && role !== 'coating') return component

  if (!isKnownProprietaryCeramicNonstickMaterial(component.material_id, component, evidence)) {
    return component
  }

  const bands = ceramicNonstickScoringBands()
  const { migration, mitigated, migration_table_note } = mitigatedCeramicNonstickMigration(
    bands.base_migration_potential,
    testingEvidence,
  )

  return {
    ...component,
    ...bands,
    adjusted_migration_potential: migration,
    base_migration_potential: migration,
    migration_table_entry: migration_table_note ?? bands.migration_table_entry,
    ceramic_lab_migration_mitigated: mitigated,
  }
}
