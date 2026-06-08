/**
 * Agent 2 Layer 4B transparency contract — Fully Disclosed eligibility (V2.3.4).
 * Zero inferred primary-contact components is necessary but not sufficient.
 */

const PRIMARY_FOOD_CONTACT_ROLES = new Set(['primary_food_contact', 'formulation'])

/** Canonical / taxonomy IDs where manufacturer disclosed family but not grade/spec. */
export const PRIMARY_CONTACT_UNDISCLOSED_SPEC_MATERIAL_IDS = new Set([
  'stainless_steel_unspecified',
  'stainless_steel_cooking_surface',
])

/**
 * @param {string | null | undefined} materialId
 */
export function materialIdHasUndisclosedSpec(materialId) {
  const id = String(materialId ?? '').toLowerCase().trim()
  if (!id) return false
  if (PRIMARY_CONTACT_UNDISCLOSED_SPEC_MATERIAL_IDS.has(id)) return true
  return /_unspecified$/.test(id)
}

/**
 * Confirmed primary food-contact material without full manufacturer spec disclosure.
 * @param {object[]} [components]
 */
export function hasUndisclosedPrimaryContactMaterialSpec(components) {
  return (components ?? []).some((c) => {
    const role = c.component_role ?? c.role
    if (!PRIMARY_FOOD_CONTACT_ROLES.has(role)) return false
    return materialIdHasUndisclosedSpec(c.material_id)
  })
}

/**
 * @param {object} ctx
 * @param {boolean} ctx.opaque
 * @param {boolean} ctx.primaryInferred
 * @param {boolean} ctx.negativeLayer4a
 * @param {object[]} [ctx.components]
 */
export function deriveLayer4bTransparencyFromContract(ctx) {
  const { opaque, primaryInferred, negativeLayer4a, components } = ctx
  const undisclosedPrimarySpec = hasUndisclosedPrimaryContactMaterialSpec(components)

  if (opaque) {
    return {
      transparency_badge: 'Opaque',
      confidence_interval: 22,
      badge_justification: 'Unknown food-contact coating cap applies.',
    }
  }
  if (!primaryInferred && !negativeLayer4a && !undisclosedPrimarySpec) {
    return {
      transparency_badge: 'Fully Disclosed',
      confidence_interval: 0,
      badge_justification:
        'Zero inferred primary contact components, no negative Layer 4A adjustments, and all relevant primary-contact material specs disclosed (V2.3.4).',
    }
  }
  if (!primaryInferred) {
    return {
      transparency_badge: 'Documentation Incomplete',
      confidence_interval: 3,
      badge_justification: undisclosedPrimarySpec
        ? 'Primary food-contact material is confirmed but grade/spec is not fully disclosed by the manufacturer.'
        : 'No primary-contact inferred components; minor Layer 4A or documentation gaps remain.',
    }
  }
  return {
    transparency_badge: 'Material Uncertain',
    confidence_interval: 12,
    badge_justification: 'Inferred or unverified primary-contact component confidence present.',
  }
}
