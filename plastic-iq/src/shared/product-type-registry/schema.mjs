/**
 * Layer 2 — product-type registry schema + validation.
 */

import {
  CONTACT_MODEL_REFS,
  EXPOSURE_MODIFIER_REFS,
  COMPONENT_ROLE_REFS,
  CHEMICAL_FAMILY_REFS,
  MATERIAL_FAMILY_REFS,
} from './layer1/index.mjs'
import { VALID_SCORING_ASSUMPTION_REFS, getScoringAssumption } from './scoring-assumptions.mjs'
import { VALID_SECONDARY_MATERIAL_POLICY_REFS } from './display-policies.mjs'

/**
 * @typedef {object} ProductTypeRegistryConfig
 * @property {string} registry_key
 * @property {string} category
 * @property {string} subcategory
 * @property {string} product_type
 * @property {string[]} contact_model_refs
 * @property {string[]} exposure_modifier_refs
 * @property {{ role_ref: string, material_class_refs: string[] }[]} component_schema
 * @property {string[]} material_class_refs
 * @property {string[]} chemical_family_refs
 * @property {string[]} claim_family_refs
 * @property {string[]} required_evidence_fields
 * @property {string[]} disclosure_rule_refs
 * @property {string} matrix_key
 * @property {string[]} source_requirements
 * @property {string} scoring_assumption_ref
 * @property {string[]} display_template_refs
 * @property {string[]} fixture_refs
 * @property {string[]} [subcategory_aliases]
 * @property {string} [secondary_material_policy_ref]
 */

/**
 * @param {ProductTypeRegistryConfig} config
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateProductTypeConfig(config) {
  const errors = []

  if (!config?.registry_key?.trim()) errors.push('registry_key is required')
  if (!config?.category?.trim()) errors.push('category is required')
  if (!config?.subcategory?.trim()) errors.push('subcategory is required')
  if (!config?.product_type?.trim()) errors.push('product_type is required')

  if (!config?.scoring_assumption_ref?.trim()) {
    errors.push('scoring_assumption_ref is required')
  } else if (!VALID_SCORING_ASSUMPTION_REFS.includes(config.scoring_assumption_ref)) {
    errors.push(`invalid scoring_assumption_ref: ${config.scoring_assumption_ref}`)
  } else if (!getScoringAssumption(config.scoring_assumption_ref)) {
    errors.push(`scoring_assumption_ref not found in V2.3.4 contract: ${config.scoring_assumption_ref}`)
  }

  for (const ref of config?.contact_model_refs ?? []) {
    if (!CONTACT_MODEL_REFS.includes(ref)) errors.push(`unknown contact_model_ref: ${ref}`)
  }
  for (const ref of config?.exposure_modifier_refs ?? []) {
    if (!EXPOSURE_MODIFIER_REFS.includes(ref)) errors.push(`unknown exposure_modifier_ref: ${ref}`)
  }
  for (const row of config?.component_schema ?? []) {
    if (!COMPONENT_ROLE_REFS.includes(row.role_ref)) {
      errors.push(`unknown component role_ref: ${row.role_ref}`)
    }
  }
  for (const ref of config?.material_class_refs ?? []) {
    if (!MATERIAL_FAMILY_REFS.includes(ref)) errors.push(`unknown material_class_ref: ${ref}`)
  }
  for (const ref of config?.chemical_family_refs ?? []) {
    if (!CHEMICAL_FAMILY_REFS.includes(ref)) errors.push(`unknown chemical_family_ref: ${ref}`)
  }

  if (!config?.matrix_key?.trim()) errors.push('matrix_key is required for Agent 1 required evidence')

  if (
    config?.secondary_material_policy_ref &&
    !VALID_SECONDARY_MATERIAL_POLICY_REFS.includes(config.secondary_material_policy_ref)
  ) {
    errors.push(`unknown secondary_material_policy_ref: ${config.secondary_material_policy_ref}`)
  }

  return { valid: errors.length === 0, errors }
}

export function buildRegistryKey(category, subcategory, productType) {
  return [category, subcategory, productType]
    .map((s) =>
      String(s ?? '')
        .trim()
        .toLowerCase()
        .replace(/[\s/]+/g, '_')
        .replace(/[^a-z0-9_]/g, ''),
    )
    .filter(Boolean)
    .join('.')
}

export function normalizeLookupText(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
}
