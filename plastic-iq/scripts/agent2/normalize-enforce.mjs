/**
 * Step 3 — Server inference rules (V2.3.4).
 * Reads taxonomy-enriched components. Updates scoring fields only — never display labels
 * (component_name, material, material_id, evidence_source).
 */

import { isUnknownFoodContactCoatingMaterial } from './deterministic/material-taxonomy.mjs'
import {
  applyKnownCeramicNonstickScoringBands,
  isKnownProprietaryCeramicNonstickMaterial,
  isTrulyUnknownProprietaryCoatingMaterial,
} from '../../src/shared/agent2/proprietary-ceramic-nonstick.mjs'

const PRIMARY_CONTACT_CI = 0.7
const ESCALATOR_1_MIGRATION_MIN = 0.6
const ESCALATOR_1_SEVERITY_MIN = 0.88

/** Locked lookup: unknown proprietary food-contact coating (hazard 0.80, hard cap 72). */
export const UNKNOWN_PROPRIETARY_FOOD_CONTACT_COATING = {
  material_hazard: 0.8,
  material_hazard_table_entry:
    'unknown proprietary food-contact coating — 0.80 (TRIGGERS HARD CAP AT 72 + Layer 4A -3)',
  base_migration_potential: 0.875,
  adjusted_migration_potential: 0.875,
  migration_table_entry:
    'Extreme-risk migration band lower midpoint 0.875 (0.85–1.0 band; server-enforced for undisclosed food-contact coatings)',
  contact_intimacy: 1,
  contact_intimacy_table_entry:
    'Direct food contact during cooking (pan surface) — 1.0 (server-enforced)',
  inert_protection_applies: false,
  degradation_adjustment: 0,
}

/** Locked lookup: undisclosed stay-cool cookware handle → SS304 scoring (labels unchanged). */
export const COOKWARE_HANDLE_STAINLESS_INFERRED = {
  material_hazard: 0.03,
  material_hazard_table_entry: 'SS304 — 0.03 (stay-cool cookware handle; inferred from category pattern)',
  base_migration_potential: 0.02,
  adjusted_migration_potential: 0.02,
  migration_table_entry: 'Inert range midpoint: stainless steel 0.02',
  contact_intimacy: 0.5,
  contact_intimacy_table_entry: 'Intermittent hand contact (handles, grips) — 0.50',
  exposure_severity: 0.5,
  severity_base: 0.5,
  severity_additions: [],
  severity_justification:
    'Handle grip during cooking — intermittent hand contact; severity reflects brief heat exposure while holding, not direct food contact.',
  exposure_duration: 0.5,
  duration_justification: 'Cooking pan ~15 min daily default — 0.50',
  inert_protection_applies: true,
}

/** Locked lookup: undisclosed refill bottle resin → HDPE. */
export const REFILL_BOTTLE_HDPE_INFERRED = {
  material_hazard: 0.18,
  material_hazard_table_entry: 'HDPE 0.18 (resin unspecified; conservative)',
  base_migration_potential: 0.29,
  adjusted_migration_potential: 0.29,
  migration_table_entry: 'Lower risk synthetics midpoint 0.29',
  contact_intimacy: 0.3,
  contact_intimacy_table_entry:
    'Indirect food contact (outer container; formulation dispensed elsewhere) — 0.30',
  exposure_severity: 0.3,
  severity_base: 0.3,
  severity_additions: [],
  severity_justification:
    'Non-product-contact container; rinse-off category ambient storage and dispensing.',
  exposure_duration: 0.2,
  duration_justification: 'Ambient storage default — 0.20.',
  inert_protection_applies: false,
}

const SCORING_ONLY_KEYS = new Set([
  'material_hazard',
  'material_hazard_table_entry',
  'base_migration_potential',
  'adjusted_migration_potential',
  'migration_table_entry',
  'degradation_adjustment',
  'contact_intimacy',
  'contact_intimacy_table_entry',
  'inert_protection_applies',
  'exposure_severity',
  'severity_base',
  'severity_additions',
  'severity_justification',
  'exposure_duration',
  'duration_justification',
  'category_modifier_applied',
  'category_modifier_value',
  'rationale',
  'escalator_1_triggers',
  'escalator_2_triggers',
  'escalator_3_triggers',
  'escalator_4_triggers',
  'escalator_5_note',
  'escalator_applied',
  'escalator_multiplier',
])

function num(v, fallback = 0) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function applyScoringPatch(component, patch) {
  for (const key of SCORING_ONLY_KEYS) {
    if (key in patch) component[key] = patch[key]
  }
}

function componentBlob(component) {
  return [
    component.component_name,
    component.material,
    component.material_hazard_table_entry,
    component.rationale,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

export function isUnknownProprietaryFoodContactCoating(component, evidence = null) {
  const role = component.role ?? component.component_role
  if (role !== 'primary_food_contact' && role !== 'coating') return false
  if (isKnownProprietaryCeramicNonstickMaterial(component.material_id, component, evidence)) {
    return false
  }
  if (isTrulyUnknownProprietaryCoatingMaterial(component.material_id, component, evidence)) {
    return true
  }
  return isUnknownFoodContactCoatingMaterial(component.material_id)
}

function isStayCoolCookwareHandleInference(component, ctx) {
  if (component.material_id !== 'stay_cool_handle_undisclosed') return false
  if (!/\bhandle\b/i.test(component.component_name ?? '')) return false
  const cat = String(ctx?.product_category_default ?? '').toLowerCase()
  return /cookware|kitchen|frying|skillet|pan\b/.test(cat)
}

export function isUndisclosedCookwareHandle(component, ctx) {
  if (component.material_id === 'stay_cool_handle_undisclosed') return false
  const cat = String(ctx?.product_category_default ?? '').toLowerCase()
  const text = componentBlob(component)
  if (!/\bhandle\b/i.test(component.component_name ?? '')) return false
  if (!/cookware|kitchen|frying|skillet|pan\b/i.test(cat) && !/cookware|skillet|frying pan/i.test(text)) {
    return false
  }
  if (
    /silicone overmold|rubber overmold|plastic overmold|nylon handle|bakelite/i.test(text) &&
    !/not disclosed|undisclosed|unspecified/i.test(text)
  ) {
    return false
  }
  return (
    /not disclosed|composition not disclosed|material not disclosed|material composition not|undisclosed|stay.cool|stay cool|riveted handle|hollow.*stainless/i.test(
      text,
    ) || num(component.material_hazard) >= 0.15
  )
}

function isUndisclosedRefillBottle(component) {
  if (component.material_id !== 'refill_container_hdpe_unspecified') return false
  const role = component.role ?? component.component_role
  return role === 'packaging' || role === 'refill_bottle'
}

function isChildrensProduct(ctx) {
  const cat = String(ctx?.product_category_default ?? '').toLowerCase()
  const sub = String(ctx?.subcategory ?? '').toLowerCase()
  return /children|infant|toy|kids/.test(cat) || /children|infant|toy/.test(sub)
}

export function computeEscalatorFlags(component, ctx) {
  const migration = num(
    component.adjusted_migration_potential ?? component.base_migration_potential,
  )
  const severity = num(component.exposure_severity)
  const ci = num(component.contact_intimacy)
  const hazard = num(component.material_hazard)
  const degraded = num(component.degradation_adjustment) > 0
  const migrationAfterDegradation = migration + num(component.degradation_adjustment)

  const childrens = isChildrensProduct(ctx)
  const escalator_1_triggers =
    !childrens &&
    migration >= ESCALATOR_1_MIGRATION_MIN &&
    severity >= ESCALATOR_1_SEVERITY_MIN
  const escalator_2_triggers =
    childrens &&
    migration >= ESCALATOR_1_MIGRATION_MIN &&
    severity >= ESCALATOR_1_SEVERITY_MIN
  /** v2.3.5: degradation escalator removed — never fires in active scoring. */
  const escalator_3_triggers = false
  const escalator_4_triggers =
    ci >= 1.0 - 1e-6 && hazard >= 0.8 && /oral|teether|pacifier/i.test(componentBlob(component))
  const escalator_5_note =
    /polystyrene|ps6/i.test(componentBlob(component)) && severity >= ESCALATOR_1_SEVERITY_MIN
      ? 'Escalator 5 (polystyrene) proposed only — not applied per V2.3.4 rules'
      : null

  let escalator_applied = null
  let escalator_multiplier = 1
  if (escalator_4_triggers) {
    escalator_applied = 'escalator_4'
    escalator_multiplier = 1.5
  } else if (escalator_2_triggers) {
    escalator_applied = 'escalator_2'
    escalator_multiplier = 1.4
  } else if (escalator_1_triggers) {
    escalator_applied = 'escalator_1'
    escalator_multiplier = 1.25
  }

  return {
    escalator_1_triggers,
    escalator_2_triggers,
    escalator_3_triggers,
    escalator_4_triggers,
    escalator_5_note,
    escalator_applied,
    escalator_multiplier,
  }
}

/**
 * Step 3 entry — returns new components array (does not mutate Step 2 input).
 * @param {object[]} taxonomyComponents
 * @param {object} pipelineCtx — category, product_category_default, subcategory
 */
export function applyServerInferenceRules(taxonomyComponents, pipelineCtx, options = {}) {
  const enforcement_log = []
  const evidence = options.evidence ?? null
  const testingEvidence = options.testingEvidence ?? null
  const components = structuredClone(taxonomyComponents)

  for (const component of components) {
    const ceramicPatched = applyKnownCeramicNonstickScoringBands(
      component,
      evidence,
      testingEvidence,
    )
    Object.assign(component, ceramicPatched)
    if (ceramicPatched.ceramic_lab_migration_mitigated) {
      enforcement_log.push({
        component_name: component.component_name,
        rule: 'ceramic_lab_non_detect_migration_mitigation',
      })
    }

    if (isUnknownProprietaryFoodContactCoating(component, evidence)) {
      applyScoringPatch(component, UNKNOWN_PROPRIETARY_FOOD_CONTACT_COATING)
      enforcement_log.push({
        component_name: component.component_name,
        rule: 'unknown_proprietary_food_contact_coating',
      })
    } else if (isStayCoolCookwareHandleInference(component, pipelineCtx)) {
      applyScoringPatch(component, COOKWARE_HANDLE_STAINLESS_INFERRED)
      enforcement_log.push({
        component_name: component.component_name,
        rule: 'stay_cool_cookware_handle_ss304_scoring',
      })
    } else if (isUndisclosedCookwareHandle(component, pipelineCtx)) {
      applyScoringPatch(component, COOKWARE_HANDLE_STAINLESS_INFERRED)
      enforcement_log.push({
        component_name: component.component_name,
        rule: 'cookware_handle_stainless_inferred',
      })
    } else if (isUndisclosedRefillBottle(component)) {
      applyScoringPatch(component, REFILL_BOTTLE_HDPE_INFERRED)
      enforcement_log.push({
        component_name: component.component_name,
        rule: 'refill_bottle_hdpe_inferred',
      })
    }

    applyScoringPatch(component, computeEscalatorFlags(component, pipelineCtx))
    enforcement_log.push({
      component_name: component.component_name,
      rule: 'escalator_flags',
    })
  }

  return {
    components,
    normalization_enforcement: {
      version: '2.3.5-deterministic-step3',
      enforcement_log,
    },
  }
}

/** @deprecated Use applyServerInferenceRules in the pipeline. */
export function enforceNormalizationDeterminism(inputs, options = {}) {
  const ctx = {
    product_category_default: inputs.product_category_default,
    subcategory: inputs.subcategory,
  }
  const { components, normalization_enforcement } = applyServerInferenceRules(
    inputs.components ?? [],
    ctx,
    options,
  )
  return {
    ...inputs,
    components,
    normalization_enforcement,
    normalization_notes: [
      inputs.normalization_notes,
      'Server deterministic enforcement applied (scoring fields only).',
    ]
      .filter(Boolean)
      .join(' '),
  }
}
