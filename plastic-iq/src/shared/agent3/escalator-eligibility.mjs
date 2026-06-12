/**
 * Agent 3 escalator_1 eligibility — labeled "PFAS/PTFE cookware escalation".
 * Requires confirmed PFAS/PTFE-family material; not proprietary undisclosed + Non-Detect lab alone.
 */

const PFAS_PRESENT_STATUS_IDS = new Set([
  'pfas_intentionally_added_disclosed',
  'pfas_present_disclosed',
])

function num(v, fallback = 0) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function componentBlob(component) {
  return [
    component?.material,
    component?.material_id,
    component?.component_name,
    component?.material_hazard_table_entry,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function pfasStatusFromContext(inputs, evidence) {
  return (
    inputs?.canonical_mappings?.pfas_status_id?.canonical_id ??
    inputs?.pfas_status_id?.canonical_id ??
    evidence?.agent_metadata?.structured_evidence?.canonical_mappings?.pfas_status_id
      ?.canonical_id ??
    null
  )
}

function coatingModifierFromContext(inputs, evidence) {
  return (
    inputs?.canonical_mappings?.coating_modifier_id?.canonical_id ??
    inputs?.coating_modifier_id?.canonical_id ??
    evidence?.agent_metadata?.structured_evidence?.canonical_mappings?.coating_modifier_id
      ?.canonical_id ??
    null
  )
}

/** Explicit PFAS/PTFE fluoropolymer material family on the component. */
export function isPfasPtfeFamilyMaterial(component) {
  const blob = componentBlob(component)
  const materialId = String(component?.material_id ?? '').toLowerCase()

  if (/ptfe|teflon|fluoropolymer|pfoa|pfos/.test(materialId)) return true
  if (/\bptfe\b|teflon|fluoropolymer/.test(blob)) return true
  if (/\bpfas\b/.test(blob) && !/pfas[-\s]?free/i.test(blob)) return true

  return false
}

function hasManufacturerPfasPtfeNonDetectLab(inputs) {
  const te = inputs?.testing_evidence
  if (!te?.testing_evidence_present) return false
  if (String(te.testing_result ?? '').trim().toLowerCase() !== 'non-detect') return false
  const analytes = te.tested_analytes ?? []
  return analytes.some((a) => /pfas|ptfe|pfoa|pfos/i.test(String(a)))
}

function isProprietaryUndisclosedFoodContact(component, inputs, evidence) {
  const modifier = coatingModifierFromContext(inputs, evidence)
  if (modifier === 'proprietary_nonstick_coating_undisclosed') return true

  const blob = componentBlob(component)
  if (/proprietary|undisclosed|proprietary_named/i.test(blob)) {
    if (/coating|nonstick|terrabond|ceramic/i.test(blob) && !isPfasPtfeFamilyMaterial(component)) {
      return true
    }
  }
  return false
}

/**
 * escalator_1 — only when PFAS/PTFE-family food-contact material is supported by approved evidence.
 * @param {object} component
 * @param {object} [inputs]
 * @param {object | null} [evidence]
 */
export function escalator1Eligible(component, inputs = {}, evidence = null) {
  if (!component?.escalator_1_triggers) return false

  const pfasStatus = pfasStatusFromContext(inputs, evidence)
  const pfasFamilyMaterial = isPfasPtfeFamilyMaterial(component)

  if (PFAS_PRESENT_STATUS_IDS.has(pfasStatus) && pfasFamilyMaterial) {
    return true
  }

  if (
    hasManufacturerPfasPtfeNonDetectLab(inputs) &&
    isProprietaryUndisclosedFoodContact(component, inputs, evidence)
  ) {
    return false
  }

  if (pfasStatus === 'pfas_not_disclosed' && !pfasFamilyMaterial) {
    return false
  }

  if (pfasStatus === 'pfas_free_claimed' && !pfasFamilyMaterial) {
    return false
  }

  return pfasFamilyMaterial
}

/**
 * Clear ineligible escalator_1 flags before Agent 3 scoring (approved Gate 2 flags may be over-broad).
 */
export function sanitizeEscalatorFlagsForScoring(components, inputs, evidence = null) {
  return (components ?? []).map((component) => {
    if (!component.escalator_1_triggers) return component
    if (escalator1Eligible(component, inputs, evidence)) return component

    const cleared = {
      ...component,
      escalator_1_triggers: false,
    }
    if (cleared.escalator_applied === 'escalator_1') {
      cleared.escalator_applied = null
      cleared.escalator_multiplier = 1
    }
    return cleared
  })
}
