/**
 * Check 4 — Primary food-contact material disclosure gaps.
 * Only flags components whose data_confidence is inferred/unknown/proprietary.
 */
import {
  INFERRED_MATERIAL_CONFIDENCES,
  PRIMARY_CONTACT_CI_THRESHOLD,
  TRUSTED_MATERIAL_CONFIDENCES,
} from '../constants.mjs'

function isPrimaryContact(component) {
  return Number(component.contact_intimacy) >= PRIMARY_CONTACT_CI_THRESHOLD
}

/**
 * @param {object} inputs
 * @param {object} _evidence — reserved for future cross-checks
 */
export function runEvidenceGaps(inputs, _evidence) {
  const components = inputs?.components ?? []
  const primary = components.filter(isPrimaryContact)
  const audited =
    primary.length > 0
      ? primary
      : components.length
        ? [
            components.reduce((best, c) =>
              Number(c.contact_intimacy) > Number(best?.contact_intimacy ?? -1) ? c : best,
            components[0]),
          ]
        : []

  const flags = []
  const primary_contact_components = []

  for (const component of audited) {
    const confidence = String(component.data_confidence ?? '').trim().toLowerCase()
    const trusted = TRUSTED_MATERIAL_CONFIDENCES.has(confidence)
    const inferred = INFERRED_MATERIAL_CONFIDENCES.has(confidence)

    primary_contact_components.push({
      component_name: component.component_name,
      contact_intimacy: Number(component.contact_intimacy),
      material: component.material,
      material_hazard_table_entry: component.material_hazard_table_entry ?? null,
      material_confidence: component.data_confidence ?? 'unknown',
    })

    if (!trusted && inferred) {
      flags.push({
        code: 'PRIMARY_CONTACT_MATERIAL_INFERRED',
        message: `Primary food-contact part "${component.component_name}" uses inferred or unverified data_confidence (${component.data_confidence})`,
        context: {
          component_name: component.component_name,
          material: component.material,
          material_hazard_table_entry: component.material_hazard_table_entry,
          data_confidence: component.data_confidence,
        },
      })
    }
  }

  return {
    status: flags.length ? 'flag' : 'pass',
    flags,
    primary_contact_components,
  }
}
