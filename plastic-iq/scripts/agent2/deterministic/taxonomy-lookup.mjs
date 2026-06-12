/**
 * Step 2 — Material taxonomy lookup.
 * Severity / duration / contact intimacy defaults read from product-type registry.
 */

import { requireMaterial } from './material-taxonomy.mjs'
import {
  getExposureDefaultsForScoringCategory,
  resolveExposureDefaultsForRole,
  resolveUtensilsPrimaryDefaults,
  UNIVERSAL_ROLE_DEFAULTS,
} from '../../../src/shared/product-type-registry/scoring-assumptions.mjs'

function roleDefaults(role, category) {
  const exposure = getExposureDefaultsForScoringCategory(category)
  const fromCategory = exposure?.roles?.[role]
  if (fromCategory) return fromCategory
  return UNIVERSAL_ROLE_DEFAULTS[role] ?? UNIVERSAL_ROLE_DEFAULTS.default
}

function contactIntimacyForRole(role, category, materialId = null) {
  return resolveExposureDefaultsForRole(role, category, materialId).contactIntimacy ?? 0.5
}

function severityForRole(role, category, materialId = null) {
  const resolved = resolveExposureDefaultsForRole(role, category, materialId)
  if (resolved.severity != null) return resolved.severity
  const spec = roleDefaults(role, category).severity
  return spec ?? 0.5
}

function durationForRole(role, category, materialId = null) {
  const resolved = resolveExposureDefaultsForRole(role, category, materialId)
  if (resolved.duration != null) {
    return { duration: resolved.duration, modifier: 1 }
  }
  const spec = roleDefaults(role, category).duration
  return spec ?? { duration: 0.3, modifier: 1 }
}

function contactIntimacyLabel(role, category, ci) {
  if (role === 'formulation' && category === 'rinse-off') {
    return 'Brief rinse-off contact (dish soap, shampoo, body wash): 0.25'
  }
  if (role === 'primary_food_contact' || role === 'coating') {
    return 'Direct food contact during cooking (pan surface) — 1.0'
  }
  if (role === 'handle') return 'Intermittent hand contact (handles, grips) — 0.50'
  if (role === 'packaging') {
    return 'Indirect food contact (outer container; formulation dispensed elsewhere) — 0.30'
  }
  if (role === 'structural') return 'Non-contact structural or decorative — 0.10'
  return `Contact intimacy ${ci}`
}

function severityJustification(draft, category) {
  if (draft.role === 'handle') {
    return 'Intermittent hand contact during use; severity reflects grip conditions, not food-surface cooking heat.'
  }
  if (draft.role === 'packaging') {
    return category === 'rinse-off'
      ? 'Non-product-contact container; rinse-off category ambient storage and dispensing.'
      : 'Non-product-contact container; ambient storage and dispensing.'
  }
  if (category === 'rinse-off' && draft.role === 'formulation') {
    return 'Rinse-off product default 0.30 (brief contact, washed away).'
  }
  if (category === 'cookware' && (draft.role === 'primary_food_contact' || draft.role === 'coating')) {
    return 'Cookware stovetop default: base 0.88 + fatty food +0.08 = 0.96 (capped at 1.0). Severity reflects use conditions only.'
  }
  if (draft.role === 'formulation') return 'Rinse-off product default 0.30.'
  return 'Severity assigned from category and component role (deterministic V3.0).'
}

function formatDurationValue(duration) {
  const n = Number(duration)
  return Number.isFinite(n) ? n.toFixed(2) : String(duration)
}

function durationJustification(draft, category, durSpec) {
  const role = draft.role
  const d = formatDurationValue(durSpec.duration)

  if (role === 'formulation' && category === 'rinse-off') {
    return 'Rinse-off formulation pathway: base 0.20 × 0.30 modifier.'
  }
  if (category === 'cookware') {
    if (role === 'primary_food_contact' || role === 'coating') {
      return `Cooking pan approximately 15 min daily default — ${d}.`
    }
    if (role === 'handle') {
      return `Intermittent hand contact (handles, grips) during cooking — ${d}.`
    }
    if (role === 'structural') {
      return `Secondary body component exposure duration — ${d}.`
    }
    if (role === 'lid' || role === 'gasket' || role === 'rivet' || role === 'packaging') {
      return `Secondary ${role} component exposure duration — ${d}.`
    }
    return `Cookware component exposure duration — ${d}.`
  }
  return `Duration ${d} from category role table (${role}).`
}

function buildRationale(draft, tax, category) {
  const cite = draft.evidence_source?.affirmative_segment
    ? `Affirmative segment: "${draft.evidence_source.affirmative_segment}" (${draft.evidence_source.fact_key}).`
    : draft.evidence_source?.excerpt
      ? `Evidence: "${draft.evidence_source.excerpt}" (${draft.evidence_source.fact_key}).`
      : `Evidence fact_key: ${draft.evidence_source?.fact_key}.`
  return `${tax.name} from material taxonomy (${draft.material_id}). ${cite} Confidence: ${draft.data_confidence}. Category: ${category}.`
}

/**
 * @param {import('./component-extract.mjs').DraftComponent[]} extracted
 * @param {{ category: string, isFormulation: boolean }} ctx
 */
export function enrichComponentsFromTaxonomy(extracted, ctx) {
  const { category, isFormulation } = ctx
  return extracted.map((draft) => {
    const tax = requireMaterial(draft.material_id)
    const role = draft.role
    if (
      category === 'utensils' &&
      role === 'primary_food_contact' &&
      !resolveUtensilsPrimaryDefaults(draft.material_id)
    ) {
      throw new Error(
        `Utensils primary food-contact material "${draft.material_id}" does not match v2.3.5 plastic/nylon or stainless/wood role-split paths`,
      )
    }
    const ci = contactIntimacyForRole(role, category, draft.material_id)
    const sevSpec = severityForRole(role, category, draft.material_id)
    let severity_base
    let severity_additions = []
    let exposure_severity

    if (typeof sevSpec === 'object') {
      severity_base = sevSpec.severity_base
      severity_additions = sevSpec.additions ?? []
      exposure_severity = Math.min(
        1,
        severity_base + severity_additions.reduce((s, a) => s + a.value, 0),
      )
    } else {
      severity_base = sevSpec
      exposure_severity = sevSpec
    }

    const durSpec = durationForRole(role, category)
    let exposure_duration = durSpec.duration
    if (isFormulation && role === 'formulation' && durSpec.modifier < 1) {
      exposure_duration = Math.round(exposure_duration * durSpec.modifier * 100) / 100
    }

    const inert = Boolean(tax.inertProtection) && tax.migration <= 0.05

    return {
      component_name: draft.component_name,
      material: draft.material,
      material_id: draft.material_id,
      component_role: role,
      role,
      material_hazard: tax.hazard,
      material_hazard_table_entry: tax.hazardTableEntry,
      base_migration_potential: tax.migration,
      degradation_adjustment: 0,
      adjusted_migration_potential: tax.migration,
      migration_table_entry: tax.migrationTableEntry,
      contact_intimacy: ci,
      contact_intimacy_table_entry: contactIntimacyLabel(role, category, ci),
      inert_protection_applies: inert,
      exposure_severity,
      severity_base,
      severity_additions,
      severity_justification: severityJustification(draft, category),
      exposure_duration,
      duration_justification: durationJustification(draft, category, durSpec),
      category_modifier_applied:
        isFormulation && role === 'formulation'
          ? 'Rinse-off formulation pathway only: Duration × 0.30'
          : null,
      category_modifier_value: isFormulation && role === 'formulation' ? 0.3 : 1,
      data_confidence: draft.data_confidence,
      evidence_source: draft.evidence_source,
      rationale: buildRationale(draft, tax, category),
      escalator_1_triggers: false,
      escalator_2_triggers: false,
      escalator_3_triggers: false,
      escalator_4_triggers: false,
      escalator_5_note: null,
      escalator_applied: null,
      escalator_multiplier: 1,
    }
  })
}
