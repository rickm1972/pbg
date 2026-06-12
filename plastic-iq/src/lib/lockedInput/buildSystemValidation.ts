/* eslint-disable @typescript-eslint/ban-ts-comment -- imports Agent 2 .mjs modules without TS declarations */
// @ts-nocheck
/**
 * Phase 4 — Agent 1 System Validation builder.
 * Reads reviewed_payload; derives validation artifact (not locked package, not score).
 */
import {
  getMaterial,
  resolveMaterialId,
  resolveMaterialLookupMeta,
  isUnknownFoodContactCoatingMaterial,
  MATERIAL_TAXONOMY,
} from '../../../scripts/agent2/deterministic/material-taxonomy.mjs'
import {
  MATERIAL_LOOKUP_SOURCE,
  MATERIAL_LOOKUP_VERSION,
  METHODOLOGY_VERSION,
} from '../../../scripts/agent2/deterministic/material-lookup-versions.mjs'
import {
  getExposureDefaultsForScoringCategory,
  resolveExposureDefaultsForRole,
  UNIVERSAL_ROLE_DEFAULTS,
} from '../../shared/product-type-registry/scoring-assumptions.mjs'
import {
  isKnownProprietaryCeramicNonstickMaterial,
  isTrulyUnknownProprietaryCoatingMaterial,
} from '../../shared/agent2/proprietary-ceramic-nonstick.mjs'
import { LAYER_4A_POSITIVE_MAX } from '../../../scripts/agent2/layer4a-positive.mjs'
import type {
  ReviewedComponentInput,
  ReviewedInputPayload,
  SystemValidationPayload,
  ValidationBlocker,
  ValidationWarning,
} from '../../types/lockedInput'

export const VALIDATION_PAYLOAD_SCHEMA_VERSION = '4.0.0'
export const NON_DETECT_MITIGATION_FACTOR = 0.58
export { MATERIAL_LOOKUP_SOURCE, MATERIAL_LOOKUP_VERSION, METHODOLOGY_VERSION }

const LAYER_4A_CREDIT_POINTS = {
  manufacturer_published_non_detect_lab_testing: 2,
  made_safe_certified: 2,
  nsf_certified_food_safe: 2,
  pfas_free_independently_verified: 2,
}

const LAYER_4A_DEDUCTION_POINTS = {
  proprietary_ceramic_or_nonstick_formula_undisclosed: -3,
  unknown_proprietary_food_contact_coating: -3,
  marketing_language_only: -2,
  bpa_free_claim_only: -1,
}

const ESCALATOR_1_MIGRATION_MIN = 0.35
const ESCALATOR_1_SEVERITY_MIN = 0.85

function num(v, fallback = 0) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function round4(n) {
  return Math.round(n * 10000) / 10000
}

export type BuildSystemValidationParams = {
  reviewed_payload: ReviewedInputPayload
  product?: Record<string, unknown> & {
    product_id?: string | null
    category?: string | null
    subcategory?: string | null
    product_name?: string | null
  }
  proposed_input_id?: string
  evidence_id?: string
}

export type BuildSystemValidationResult = {
  validation_payload: SystemValidationPayload
  blockers: ValidationBlocker[]
  warnings: ValidationWarning[]
  validation_status: string
  validated_at: string
  unresolved_canonical_material_ids: string[]
  material_lookup_sync_notes: string[]
}

function canonicalIdForComponent(component: ReviewedComponentInput): string | null {
  return (
    component.confirmed_canonical_material_id ??
    component.reviewed_canonical_material_id ??
    null
  )
}

function resolveScoringCategory(category, subcategory, productType = null) {
  const sub = String(subcategory ?? '').toLowerCase()
  const cat = String(category ?? '').toLowerCase()
  const pt = String(productType ?? '').toLowerCase()
  if (/cookware|skillet|pan|pot|wok/.test(sub)) return 'cookware'
  if (/water.?bottle/.test(sub) || /water.?bottle/.test(pt)) return 'water-bottles'
  if (/drinkware|tumbler|travel.?mug|cup|mug/.test(sub) || /tumbler|travel.?mug|cup|mug/.test(pt)) {
    return 'drinkware'
  }
  if (/storage|container|food.?storage/.test(sub) || /storage|container/.test(pt)) return 'food-storage'
  if (/utensil|spatula|spoon/.test(sub)) return 'utensils'
  if (/textile|fabric|bedding/.test(sub)) return 'textiles'
  if (/infant|oral|teether|pacifier/.test(sub)) return 'childrens'
  if (/rinse|soap|shampoo/.test(sub)) return 'rinse-off'
  if (/kitchen/.test(cat)) return 'cookware'
  return 'cookware'
}

function roleDefaults(role, scoringCategory) {
  const exposure = getExposureDefaultsForScoringCategory(scoringCategory)
  const fromCategory = exposure?.roles?.[role]
  if (fromCategory) return fromCategory
  return UNIVERSAL_ROLE_DEFAULTS[role] ?? UNIVERSAL_ROLE_DEFAULTS.default
}

function categoryDefaultsForRole(role, scoringCategory, materialId = null) {
  const resolved = resolveExposureDefaultsForRole(role, scoringCategory, materialId)
  return {
    contactIntimacy: resolved.contactIntimacy ?? 0.5,
    severity: resolved.severity,
    duration: resolved.duration,
    utensilsPath: resolved.utensilsPath ?? null,
  }
}

function assertNoLockedKeysDeep(value, path = '', errors = []) {
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) assertNoLockedKeysDeep(value[i], `${path}[${i}]`, errors)
    return errors
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (key.startsWith('locked_')) {
        errors.push(`${path}.${key}`)
      }
      assertNoLockedKeysDeep(child, path ? `${path}.${key}` : key, errors)
    }
  }
  return errors
}

function labEvidenceQualifies(reviewed) {
  const status = String(reviewed.reviewed_lab_evidence_status ?? '')
  if (!['third_party_non_detect', 'non_detect_tested', 'manufacturer_non_detect'].includes(status)) {
    return false
  }
  const analytes = reviewed.reviewed_analytes_tested ?? []
  if (
    analytes.some((a) => /pfas|ptfe|pfoa|pfos|pfbs/i.test(String(a))) ||
    /non.?detect/i.test(String(reviewed.reviewed_result_language ?? ''))
  ) {
    return true
  }
  return status === 'third_party_non_detect' || status === 'non_detect_tested'
}

function materialEligibleForNonDetectMitigation(materialId, component, reviewed) {
  if (isUnknownFoodContactCoatingMaterial(materialId)) return false
  const pseudoComponent = {
    material_id: materialId,
    component_role: component.reviewed_component_role,
    component_name: component.reviewed_component_name,
  }
  if (isKnownProprietaryCeramicNonstickMaterial(materialId, pseudoComponent, null)) return true
  if (materialId === 'hybrid_stainless_nonstick_food_contact') return true
  const mat = getMaterial(materialId)
  if (mat?.inertProtection) return false
  if (reviewed.reviewed_known_category_proprietary_candidate) return true
  return /nonstick|ceramic|hybrid|proprietary/i.test(materialId)
}

function validateLayer4a(reviewed) {
  const credits = reviewed.reviewed_layer_4a_credit_candidates ?? []
  const deductions = reviewed.reviewed_layer_4a_deduction_candidates ?? []
  let creditTotal = 0
  const validatedCredits = []
  const validatedDeductions = []
  const notes = []

  for (const key of credits) {
    const pts = LAYER_4A_CREDIT_POINTS[key]
    if (pts == null) {
      notes.push(`Unrecognized Layer 4A credit candidate: ${key}`)
      continue
    }
    if (key === 'manufacturer_published_non_detect_lab_testing' && !labEvidenceQualifies(reviewed)) {
      notes.push('Non-Detect lab credit candidate lacks qualifying lab evidence')
      continue
    }
    validatedCredits.push({ key, points: pts })
    creditTotal += pts
  }

  if (creditTotal > LAYER_4A_POSITIVE_MAX) {
    notes.push(`Layer 4A credits capped from ${creditTotal} to ${LAYER_4A_POSITIVE_MAX}`)
    creditTotal = LAYER_4A_POSITIVE_MAX
  }

  let deductionTotal = 0
  for (const key of deductions) {
    const pts = LAYER_4A_DEDUCTION_POINTS[key]
    if (pts == null) {
      notes.push(`Unrecognized Layer 4A deduction candidate: ${key}`)
      continue
    }
    validatedDeductions.push({ key, points: pts })
    deductionTotal += pts
  }

  const layer_4a_total_validated = creditTotal + deductionTotal
  let layer_4a_validation_status = 'passed'
  if (notes.some((n) => n.includes('Unrecognized'))) layer_4a_validation_status = 'review_required'
  if (layer_4a_total_validated < -6) layer_4a_validation_status = 'failed'

  return {
    reviewed_layer_4a_flags: reviewed.reviewed_layer_4a_flags ?? { candidate_only: true },
    validated_layer_4a_flags: { candidate_only: false, validated: true },
    layer_4a_credit_candidates: validatedCredits,
    layer_4a_deduction_candidates: validatedDeductions,
    layer_4a_total_validated,
    layer_4a_validation_status,
    layer_4a_notes: notes.length ? notes.join('; ') : null,
  }
}

function validateCap(reviewed, primaryMaterialId) {
  const pseudo = { material_id: primaryMaterialId, component_role: 'primary_food_contact' }
  const trulyUnknown = isTrulyUnknownProprietaryCoatingMaterial(primaryMaterialId, pseudo, null)
  const knownCategory =
    reviewed.reviewed_known_category_proprietary_candidate ||
    isKnownProprietaryCeramicNonstickMaterial(primaryMaterialId, pseudo, null) ||
    reviewed.reviewed_proprietary_status === 'known_category_proprietary'

  const unknownCoatingCap =
    Boolean(reviewed.reviewed_cap_flag || reviewed.reviewed_unknown_coating_cap_candidate) &&
    trulyUnknown &&
    !knownCategory

  const knownCategoryProprietary = knownCategory && !trulyUnknown

  let cap_validation_status = 'passed'
  const capNotes = []
  if (reviewed.reviewed_cap_flag && knownCategoryProprietary) {
    cap_validation_status = 'failed'
    capNotes.push('Cap flag conflicts with known-category proprietary status (72 cap does not apply)')
  }
  if (reviewed.reviewed_unknown_coating_cap_candidate && knownCategoryProprietary) {
    cap_validation_status = 'failed'
    capNotes.push('Unknown coating cap candidate conflicts with known-category proprietary coating')
  }

  return {
    reviewed_cap_flag: Boolean(reviewed.reviewed_cap_flag),
    unknown_coating_cap_validation: unknownCoatingCap,
    known_category_proprietary_validation: knownCategoryProprietary,
    unknown_proprietary_validation: trulyUnknown,
    cap_validation_status,
    cap_notes: capNotes.length ? capNotes.join('; ') : null,
  }
}

function computeEscalatorValidation(reviewed, primaryComponent, useConditions, ctx) {
  const migration = num(primaryComponent.adjusted_migration_value)
  const severity = num(useConditions.final_exposure_severity)
  const ci = num(useConditions.final_contact_intimacy)
  const hazard = num(primaryComponent.material_hazard_value)
  const childrens = /children|infant|toy|kids/.test(String(ctx.subcategory ?? '').toLowerCase())

  const adult_high =
    !childrens && migration >= ESCALATOR_1_MIGRATION_MIN && severity >= ESCALATOR_1_SEVERITY_MIN
  const children_high =
    childrens && migration >= ESCALATOR_1_MIGRATION_MIN && severity >= ESCALATOR_1_SEVERITY_MIN
  const oral_extreme = ci >= 1 - 1e-6 && hazard >= 0.8 && /oral|teether|pacifier/i.test(ctx.productName ?? '')

  let highest = null
  let multiplier = 1
  if (oral_extreme) {
    highest = 'oral_extreme_risk_escalator'
    multiplier = 1.5
  } else if (children_high) {
    highest = 'children_high_migration_high_severity_escalator'
    multiplier = 1.4
  } else if (adult_high) {
    highest = 'adult_high_migration_high_severity_escalator'
    multiplier = 1.25
  }

  const candidate = reviewed.reviewed_escalator_candidate
  let escalator_validation_status = 'passed'
  const notes = []
  if (candidate && !highest) {
    escalator_validation_status = 'review_required'
    notes.push('Escalator candidate proposed but validated conditions do not trigger an escalator')
  }
  if (candidate && highest && String(candidate) !== highest && String(candidate) !== 'true') {
    escalator_validation_status = 'review_required'
    notes.push(`Escalator candidate "${candidate}" differs from highest validated "${highest}"`)
  }

  return {
    reviewed_escalator_candidate: reviewed.reviewed_escalator_candidate ?? null,
    adult_high_migration_high_severity_escalator: adult_high,
    children_high_migration_high_severity_escalator: children_high,
    oral_extreme_risk_escalator: oral_extreme,
    highest_escalator: highest,
    escalator_multiplier: multiplier,
    escalator_validation_status,
    escalator_notes: notes.length ? notes.join('; ') : null,
  }
}

function validateTransparencyBadge(reviewed, primaryMaterialId, mitigationApplied) {
  const proposed = reviewed.reviewed_transparency_badge
  let validated = proposed
  const warnings = []
  let badge_validation_status = 'passed'

  const knownCategory = reviewed.reviewed_known_category_proprietary_candidate
  const trulyUnknown = isTrulyUnknownProprietaryCoatingMaterial(primaryMaterialId, {}, null)

  if (trulyUnknown && proposed === 'Fully Disclosed') {
    validated = 'Material Uncertain'
    warnings.push('Unknown proprietary coating cannot validate Fully Disclosed badge')
    badge_validation_status = 'review_required'
  }
  if (knownCategory && mitigationApplied && proposed === 'Material Uncertain') {
    validated = 'Documentation Incomplete'
    warnings.push('Known-category proprietary with qualifying Non-Detect may use Documentation Incomplete')
  }
  if (
    knownCategory &&
    (mitigationApplied || labEvidenceQualifies(reviewed)) &&
    !proposed
  ) {
    validated = 'Documentation Incomplete'
    warnings.push(
      'Known-category proprietary with qualifying lab evidence defaults to Documentation Incomplete badge',
    )
  }
  if (knownCategory && !mitigationApplied && !labEvidenceQualifies(reviewed) && proposed === 'Fully Disclosed') {
    validated = 'Material Uncertain'
    warnings.push('Known-category proprietary without qualifying lab support may require Material Uncertain')
    badge_validation_status = 'review_required'
  }

  return {
    reviewed_transparency_badge: proposed ?? null,
    validated_transparency_badge: validated ?? null,
    badge_validation_status,
    badge_basis: reviewed.reviewed_badge_basis ?? null,
    badge_notes: reviewed.reviewed_badge_notes ?? null,
    badge_warnings: warnings,
  }
}

/**
 * Build system validation artifact from human-reviewed closed fields.
 */
export function buildSystemValidation(params: BuildSystemValidationParams): BuildSystemValidationResult {
  const reviewed = params.reviewed_payload
  const product = (params.product ?? reviewed.product_context ?? {}) as BuildSystemValidationParams['product']
  const validatedAt = new Date().toISOString()
  const scoringCategory = resolveScoringCategory(
    product.category,
    product.subcategory,
    product.product_type,
  )

  /** @type {ValidationBlocker[]} */
  const blockers: ValidationBlocker[] = []
  /** @type {ValidationWarning[]} */
  const warnings: ValidationWarning[] = []
  const illegal_combo_flags = []
  const unresolvedCanonicalIds = []

  const lockedKeyPaths = assertNoLockedKeysDeep(reviewed)
  if (lockedKeyPaths.length) {
    blockers.push({
      code: 'REVIEWED_PAYLOAD_LOCKED_KEYS',
      message: `reviewed_payload contains locked_* keys: ${lockedKeyPaths.join(', ')}`,
    })
    illegal_combo_flags.push('reviewed_payload_locked_keys')
  }

  /** @type {import('../../src/types/lockedInput.ts').SystemValidationMaterialLookupResult[]} */
  const material_lookups = []
  /** @type {import('../../src/types/lockedInput.ts').SystemValidationMitigationResult[]} */
  const non_detect_mitigation = []
  /** @type {import('../../src/types/lockedInput.ts').SystemValidationUseConditionResult[]} */
  const use_conditions = []

  let primaryMaterialId = null
  let globalMitigationApplied = false

  const hybridPrimary = (reviewed.reviewed_components ?? []).find(
    (c) =>
      c.reviewed_is_score_driving &&
      c.reviewed_component_role === 'primary_food_contact' &&
      canonicalIdForComponent(c) === 'hybrid_stainless_nonstick_food_contact',
  )
  if (hybridPrimary) {
    for (const comp of reviewed.reviewed_components ?? []) {
      if (!comp.reviewed_is_score_driving || comp.reviewed_component_id === hybridPrimary.reviewed_component_id) {
        continue
      }
      const canonical = canonicalIdForComponent(comp)
      const overlapsHybridExposure =
        comp.reviewed_component_role === 'coating' ||
        /ceramic_nonstick|terrabond|proprietary.*nonstick|sol_gel/i.test(String(canonical ?? ''))
      if (overlapsHybridExposure) {
        blockers.push({
          code: 'HYBRID_OVERLAPPING_SCORE_DRIVING_EXPOSURE',
          message: `Score-driving ${comp.reviewed_component_role} ${comp.reviewed_component_id} overlaps hybrid primary food-contact exposure (${canonical})`,
          field_path: `reviewed_components.${comp.reviewed_component_id}.reviewed_is_score_driving`,
        })
      }
    }
  }

  for (const component of reviewed.reviewed_components ?? []) {
    const materialIdRaw = canonicalIdForComponent(component)
    const lookupMeta = materialIdRaw ? resolveMaterialLookupMeta(materialIdRaw) : null
    const resolvedId = lookupMeta?.resolved_material_taxonomy_id ?? null
    const material = lookupMeta?.material ?? null
    const isScoreDriving = Boolean(component.reviewed_is_score_driving)

    let lookupStatus = lookupMeta?.canonical_material_lookup_status ?? 'missing'
    if (!materialIdRaw?.trim()) {
      lookupStatus = 'missing'
      if (isScoreDriving) {
        blockers.push({
          code: 'MISSING_CANONICAL_MATERIAL_ID',
          message: `Score-driving component ${component.reviewed_component_id} lacks confirmed canonical material ID`,
          field_path: `reviewed_components.${component.reviewed_component_id}`,
        })
      }
    } else if (!material) {
      if (lookupStatus !== 'expansion_required') lookupStatus = 'missing'
      unresolvedCanonicalIds.push(materialIdRaw)
      if (isScoreDriving) {
        blockers.push({
          code: 'UNKNOWN_CANONICAL_MATERIAL_ID',
          message: `Canonical material ID not found in MATERIAL_TAXONOMY: ${materialIdRaw}`,
          field_path: `reviewed_components.${component.reviewed_component_id}.confirmed_canonical_material_id`,
        })
      } else {
        warnings.push({
          code: 'NON_SCORE_COMPONENT_LOOKUP_MISSING',
          message: `Non-score-driving component uses unresolved canonical ID: ${materialIdRaw}`,
          field_path: `reviewed_components.${component.reviewed_component_id}`,
        })
      }
    }

    const hazard = material?.hazard ?? null
    const baseMigration = material?.migration ?? null
    let adjustedMigration = baseMigration
    let mitigationFactor = null
    let mitigationStatus = 'not_applicable'
    let mitigationNotes = null

    const candidate = Boolean(reviewed.reviewed_non_detect_mitigation_candidate)
    const materialEligible = materialIdRaw
      ? materialEligibleForNonDetectMitigation(resolvedId ?? materialIdRaw, component, reviewed)
      : false
    const labQualifies = labEvidenceQualifies(reviewed)
    const isNonDetectMitigationTarget =
      component.reviewed_component_role === 'primary_food_contact'

    if (candidate && isScoreDriving) {
      if (isNonDetectMitigationTarget) {
        if (!labQualifies) {
          blockers.push({
            code: 'NON_DETECT_LAB_NOT_QUALIFIED',
            message: 'Non-Detect mitigation candidate lacks qualifying lab evidence',
            field_path: 'reviewed_lab_evidence_status',
          })
          mitigationStatus = 'blocked'
        } else if (!materialEligible) {
          if (material?.inertProtection) {
            adjustedMigration = baseMigration
            mitigationStatus = 'not_applicable'
            mitigationNotes =
              'Inert primary food-contact surface; Non-Detect mitigation applies to coated/hybrid valley row only'
          } else {
            blockers.push({
              code: 'NON_DETECT_INELIGIBLE_MATERIAL',
              message: `Non-Detect mitigation candidate on ineligible material ${materialIdRaw}`,
              field_path: 'reviewed_non_detect_mitigation_candidate',
            })
            mitigationStatus = 'blocked'
          }
        } else if (baseMigration != null) {
          mitigationFactor = NON_DETECT_MITIGATION_FACTOR
          adjustedMigration = round4(baseMigration * NON_DETECT_MITIGATION_FACTOR)
          mitigationStatus = 'applied'
          mitigationNotes = `adjusted_migration = base_migration × ${NON_DETECT_MITIGATION_FACTOR}`
          globalMitigationApplied = true
        }
      } else if (baseMigration != null) {
        adjustedMigration = baseMigration
        mitigationStatus = 'not_applicable'
      }
    } else if (baseMigration != null) {
      adjustedMigration = baseMigration
      mitigationStatus = candidate ? 'not_applied' : 'not_requested'
    }

    if (component.reviewed_component_role === 'primary_food_contact' && isScoreDriving) {
      const id = resolvedId ?? materialIdRaw
      const preferThisPrimary =
        !primaryMaterialId ||
        id === 'hybrid_stainless_nonstick_food_contact' ||
        (material && !material.inertProtection && primaryMaterialId !== 'hybrid_stainless_nonstick_food_contact')
      if (preferThisPrimary) {
        primaryMaterialId = id
      }
    }

    material_lookups.push({
      reviewed_component_id: component.reviewed_component_id,
      reviewed_component_name: component.reviewed_component_name,
      reviewed_component_role: component.reviewed_component_role,
      reviewed_is_score_driving: isScoreDriving,
      confirmed_canonical_material_id: materialIdRaw,
      reviewed_canonical_material_id: materialIdRaw,
      resolved_material_taxonomy_id: resolvedId,
      alias_applied: Boolean(lookupMeta?.alias_applied),
      canonical_material_lookup_status: lookupStatus,
      canonical_material_name: material?.name ?? null,
      material_hazard_value: hazard,
      base_migration_value: baseMigration,
      adjusted_migration_value: adjustedMigration,
      material_lookup_version: MATERIAL_LOOKUP_VERSION,
      material_lookup_notes: lookupMeta?.material_lookup_notes ?? null,
    })

    if (isScoreDriving) {
      non_detect_mitigation.push({
        reviewed_component_id: component.reviewed_component_id,
        reviewed_non_detect_mitigation_candidate: candidate,
        non_detect_mitigation_eligible_by_material: materialEligible,
        non_detect_evidence_qualifies: labQualifies,
        non_detect_validation_status: mitigationStatus,
        mitigation_factor: mitigationFactor,
        adjusted_migration_value: adjustedMigration,
        material_hazard_value: hazard,
        base_migration_value: baseMigration,
        mitigation_notes: mitigationNotes,
      })
    }

    const defaults = categoryDefaultsForRole(
      component.reviewed_component_role,
      scoringCategory,
      resolvedId ?? materialIdRaw,
    )
    if (
      isScoreDriving &&
      scoringCategory === 'utensils' &&
      component.reviewed_component_role === 'primary_food_contact' &&
      defaults.severity == null
    ) {
      blockers.push({
        code: 'UTENSILS_MATERIAL_PATH_UNRESOLVED',
        message: `Utensils primary food-contact material ${materialIdRaw ?? '(missing)'} does not match plastic/nylon or stainless/wood v2.3.5 role-split paths`,
        field_path: `reviewed_components.${component.reviewed_component_id}.confirmed_canonical_material_id`,
      })
    }
    if (
      isScoreDriving &&
      (defaults.contactIntimacy == null || defaults.severity == null || defaults.duration == null)
    ) {
      blockers.push({
        code: 'MISSING_CATEGORY_DEFAULTS',
        message: `Missing category defaults for score-driving role ${component.reviewed_component_role}`,
        field_path: `use_conditions.${component.reviewed_component_id}`,
      })
    }

    const override = Boolean(reviewed.reviewed_use_condition_override)
    let finalCI = defaults.contactIntimacy
    let finalSev = defaults.severity
    let finalDur = defaults.duration
    let useStatus = 'defaults_applied'
    let useNotes = 'Category defaults applied (reviewed_use_condition_override = false)'

    if (override) {
      const reason = String(reviewed.reviewed_use_condition_override_reason ?? '').trim()
      const sources = reviewed.reviewed_use_condition_source_ids ?? []
      if (!reason || sources.length === 0) {
        blockers.push({
          code: 'USE_CONDITION_OVERRIDE_INCOMPLETE',
          message: 'Use-condition override requires reason and source references',
          field_path: 'reviewed_use_condition_override',
        })
        useStatus = 'blocked'
      } else {
        finalCI = reviewed.reviewed_contact_intimacy_override ?? finalCI
        finalSev = reviewed.reviewed_severity_override ?? finalSev
        finalDur = reviewed.reviewed_duration_override ?? finalDur
        useStatus = 'override_applied'
        useNotes = reason
      }
    }

    if (isScoreDriving) {
      use_conditions.push({
        reviewed_component_id: component.reviewed_component_id,
        category_default_contact_intimacy: defaults.contactIntimacy,
        category_default_severity: defaults.severity,
        category_default_duration: defaults.duration,
        reviewed_use_condition_override: override,
        final_contact_intimacy: finalCI,
        final_exposure_severity: finalSev,
        final_exposure_duration: finalDur,
        use_condition_validation_status: useStatus,
        use_condition_notes: useNotes,
      })
    }
  }

  const layer4a = validateLayer4a(reviewed)
  if (layer4a.layer_4a_validation_status === 'review_required') {
    warnings.push({
      code: 'LAYER_4A_REVIEW_REQUIRED',
      message: layer4a.layer_4a_notes ?? 'Layer 4A candidates need review',
    })
  }

  const cap = validateCap(reviewed, primaryMaterialId)
  if (cap.cap_validation_status === 'failed') {
    blockers.push({
      code: 'CAP_PROPRIETARY_CONFLICT',
      message: cap.cap_notes ?? 'Cap validation conflict',
      field_path: 'reviewed_cap_flag',
    })
    illegal_combo_flags.push('cap_known_proprietary_conflict')
  }

  const primaryLookup =
    material_lookups.find(
      (m) =>
        m.reviewed_is_score_driving &&
        m.resolved_material_taxonomy_id === 'hybrid_stainless_nonstick_food_contact',
    ) ??
    material_lookups.find(
      (m) =>
        m.reviewed_is_score_driving &&
        m.reviewed_component_role === 'primary_food_contact' &&
        !getMaterial(m.resolved_material_taxonomy_id ?? '')?.inertProtection,
    ) ??
    material_lookups.find((m) => m.reviewed_component_role === 'primary_food_contact')
  const primaryUse = use_conditions.find((u) =>
    material_lookups.some(
      (m) =>
        m.reviewed_component_id === u.reviewed_component_id &&
        m.reviewed_component_role === 'primary_food_contact',
    ),
  )
  const escalator = computeEscalatorValidation(
    reviewed,
    primaryLookup ?? {},
    primaryUse ?? {},
    { subcategory: product.subcategory, productName: product.product_name },
  )
  if (escalator.escalator_validation_status === 'review_required') {
    warnings.push({
      code: 'ESCALATOR_REVIEW_REQUIRED',
      message: escalator.escalator_notes ?? 'Escalator candidate needs review',
    })
  }

  const badge = validateTransparencyBadge(reviewed, primaryMaterialId, globalMitigationApplied)
  for (const w of badge.badge_warnings) {
    warnings.push({ code: 'BADGE_VALIDATION', message: w })
  }

  const lookupSyncNotes = []
  if (unresolvedCanonicalIds.length) {
    lookupSyncNotes.push(
      `Unresolved canonical IDs in MATERIAL_TAXONOMY: ${[...new Set(unresolvedCanonicalIds)].join(', ')}`,
    )
  }
  lookupSyncNotes.push(
    `Phase 4.5 lookup version: ${MATERIAL_LOOKUP_VERSION} (${METHODOLOGY_VERSION}); source ${MATERIAL_LOOKUP_SOURCE}.`,
  )
  lookupSyncNotes.push(
    'Agent 1 canonical IDs may differ from MATERIAL_TAXONOMY keys; alias layer resolves documented equivalences only.',
  )

  let validation_status = 'passed'
  if (blockers.length) validation_status = 'failed'
  else if (warnings.some((w) => /REVIEW_REQUIRED|NEEDS_REVIEW/i.test(w.code))) {
    validation_status = 'passed'
  }

  const validation_summary =
    blockers.length === 0
      ? warnings.length
        ? `Validation passed with ${warnings.length} warning(s)`
        : 'Validation passed'
      : `Validation blocked: ${blockers.length} blocker(s)`

  /** @type {import('../../src/types/lockedInput.ts').SystemValidationPayload} */
  const validation_payload = {
    schema_version: VALIDATION_PAYLOAD_SCHEMA_VERSION,
    not_locked: true,
    not_score_authoritative: true,
    product_id: product.product_id ?? params.proposed_input_id ?? null,
    proposed_input_id: params.proposed_input_id ?? null,
    reviewed_at: reviewed.reviewed_at ?? null,
    validated_at: validatedAt,
    validation_summary,
    methodology_version: METHODOLOGY_VERSION,
    material_lookup_source: MATERIAL_LOOKUP_SOURCE,
    material_lookup_version: MATERIAL_LOOKUP_VERSION,
    material_lookups,
    non_detect_mitigation,
    use_conditions,
    ...layer4a,
    cap_validation: cap,
    escalator_validation_detail: escalator,
    transparency_badge_validation_detail: badge,
    illegal_combo_flags,
    unresolved_canonical_material_ids: [...new Set(unresolvedCanonicalIds)],
    material_lookup_sync_notes: lookupSyncNotes,
    components: material_lookups.map((m) => ({
      proposed_component_id: m.reviewed_component_id,
      canonical_material_lookup_status: m.canonical_material_lookup_status,
      material_hazard_lookup_result: m.material_hazard_value,
      base_migration_lookup_result: m.base_migration_value,
      adjusted_migration_result: m.adjusted_migration_value,
      non_detect_mitigation_eligible: non_detect_mitigation.find(
        (n) => n.reviewed_component_id === m.reviewed_component_id,
      )?.non_detect_mitigation_eligible_by_material,
      non_detect_evidence_qualified: non_detect_mitigation.find(
        (n) => n.reviewed_component_id === m.reviewed_component_id,
      )?.non_detect_evidence_qualifies,
      category_default_contact_intimacy: use_conditions.find(
        (u) => u.reviewed_component_id === m.reviewed_component_id,
      )?.category_default_contact_intimacy,
      category_default_severity: use_conditions.find(
        (u) => u.reviewed_component_id === m.reviewed_component_id,
      )?.category_default_severity,
      category_default_duration: use_conditions.find(
        (u) => u.reviewed_component_id === m.reviewed_component_id,
      )?.category_default_duration,
      final_contact_intimacy: use_conditions.find(
        (u) => u.reviewed_component_id === m.reviewed_component_id,
      )?.final_contact_intimacy,
      final_exposure_severity: use_conditions.find(
        (u) => u.reviewed_component_id === m.reviewed_component_id,
      )?.final_exposure_severity,
      final_exposure_duration: use_conditions.find(
        (u) => u.reviewed_component_id === m.reviewed_component_id,
      )?.final_exposure_duration,
    })),
    layer_4a_validation_status: layer4a.layer_4a_validation_status,
    layer_4a_total_validated: layer4a.layer_4a_total_validated,
    unknown_coating_cap_validation: cap.unknown_coating_cap_validation,
    known_category_proprietary_validation: cap.known_category_proprietary_validation,
    escalator_validation_passed: escalator.escalator_validation_status !== 'failed',
    transparency_badge_validation_passed: badge.badge_validation_status === 'passed',
  }

  const payloadLockedPaths = assertNoLockedKeysDeep(validation_payload)
  if (payloadLockedPaths.length) {
    throw new Error(`validation_payload must not contain locked_* keys: ${payloadLockedPaths.join(', ')}`)
  }

  return {
    validation_payload,
    blockers,
    warnings,
    validation_status,
    validated_at: validatedAt,
    unresolved_canonical_material_ids: [...new Set(unresolvedCanonicalIds)],
    material_lookup_sync_notes: lookupSyncNotes,
  }
}
