/**
 * Safety claims vs disclosed materials — used by Layer 4A applicability and strip guard.
 */
import { getSafetyClaims } from './deterministic/schema-input.mjs'

/** @param {object[]} components */
export function hasDisclosedFluoropolymer(components) {
  return (components ?? []).some((c) =>
    /ptfe|pfa|fep|fluoropolymer/i.test(`${c.material_id ?? ''} ${c.material ?? ''}`),
  )
}

/** @param {object[]} components */
export function hasDisclosedHighHazardMaterial(components) {
  return (components ?? []).some((c) => {
    const hazard = Number(c.material_hazard)
    if (Number.isFinite(hazard) && hazard >= 0.5) return true
    return /ptfe|pfa|fep|fluoropolymer/i.test(`${c.material_id ?? ''}`)
  })
}

/**
 * PFAS-Free + PTFE, or Non-toxic + high-hazard / fluoropolymer — structural_guarantee must not apply.
 * @param {object} evidence
 * @param {object[]} components
 */
export function safetyClaimContradictsMaterials(evidence, components) {
  const safety = getSafetyClaims(evidence)
  if (!safety) return false

  const pfasClaimed = Boolean(safety.pfas_free_claim?.claimed)
  const nonToxicClaimed = Boolean(safety.non_toxic_claim?.claimed)
  const fluoropolymer = hasDisclosedFluoropolymer(components)
  const highHazard = hasDisclosedHighHazardMaterial(components)

  if (pfasClaimed && fluoropolymer) return true
  if (nonToxicClaimed && highHazard) return true
  return false
}

/**
 * Cast iron + PFAS-Free, etc. — Agent 1 structural_guarantee is valid only when materials support it.
 * @param {object} evidence
 * @param {object[]} components
 */
export function isStructuralSafetyClaimValid(evidence, components) {
  const safety = getSafetyClaims(evidence)
  if (!safety) return false

  if (safety.pfas_free_claim?.structural_guarantee) {
    if (hasDisclosedFluoropolymer(components)) return false
    const inertPrimary = (components ?? []).some((c) => {
      const role = c.component_role ?? c.role
      if (role !== 'primary_food_contact' && role !== 'formulation') return false
      return /cast_iron|glass|stainless|vitreous/i.test(`${c.material_id ?? ''}`)
    })
    if (!inertPrimary) return false
  }

  if (safety.non_toxic_claim?.structural_guarantee && hasDisclosedHighHazardMaterial(components)) {
    return false
  }

  return Boolean(
    safety.pfas_free_claim?.structural_guarantee ||
      safety.bpa_free_claim?.structural_guarantee ||
      safety.non_toxic_claim?.structural_guarantee,
  )
}
