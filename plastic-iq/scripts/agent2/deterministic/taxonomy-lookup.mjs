/**
 * Step 2 — Material taxonomy lookup.
 * Reads extracted components only. Assigns base hazard/migration and role-default CI/severity/duration.
 * No server inference, Layer 4A, escalators, or Why This Score.
 */

import { requireMaterial } from './material-taxonomy.mjs'

function num(v, fallback = 0) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function contactIntimacyForRole(role, category) {
  switch (role) {
    case 'formulation':
      return category === 'rinse-off' ? 0.25 : 0.5
    case 'primary_food_contact':
      return 1
    case 'coating':
      return 1
    case 'handle':
    case 'rivet':
      return 0.5
    case 'lid':
    case 'gasket':
      return 0.3
    case 'packaging':
      return 0.3
    case 'structural':
      return 0.1
    default:
      return 0.3
  }
}

function severityForRole(role, category) {
  if (role === 'handle' || role === 'rivet') return 0.5
  if (role === 'packaging' || role === 'structural' || role === 'lid') return 0.3
  if (role === 'formulation' && category === 'rinse-off') return 0.3
  if (category === 'cookware' && (role === 'primary_food_contact' || role === 'coating')) {
    return { severity_base: 0.88, additions: [{ factor: 'fatty food (common foreseeable)', value: 0.08 }] }
  }
  if (category === 'drinkware') return 0.7
  return 0.5
}

function durationForRole(role, category) {
  if (role === 'formulation' && category === 'rinse-off') return { duration: 0.2, modifier: 0.3 }
  if (category === 'cookware' && (role === 'primary_food_contact' || role === 'coating')) {
    return { duration: 0.5, modifier: 1 }
  }
  if (role === 'handle') return { duration: 0.5, modifier: 1 }
  if (role === 'packaging') return { duration: 0.2, modifier: category === 'rinse-off' ? 0.3 : 1 }
  return { duration: 0.3, modifier: 1 }
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

function durationJustification(draft, category, durSpec) {
  if (draft.role === 'formulation' && category === 'rinse-off') {
    return 'Rinse-off formulation pathway: base 0.20 × 0.30 modifier.'
  }
  if (category === 'cookware') return 'Cooking pan approximately 15 min daily default — 0.50.'
  return `Duration ${durSpec.duration} from category role table.`
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
    const ci = contactIntimacyForRole(role, category)
    const sevSpec = severityForRole(role, category)
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
