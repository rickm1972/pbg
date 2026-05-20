/**
 * Check 4 — Primary food-contact material disclosure gaps.
 */
import { INFERRED_MATERIAL_CONFIDENCES, PRIMARY_CONTACT_CI_THRESHOLD } from '../constants.mjs'

const INFERRED_MATERIAL_TEXT = /inferred|unknown|unspecified|not specified|proprietary|undisclosed|manufacturer.claimed/i

function isPrimaryContact(component) {
  return Number(component.contact_intimacy) >= PRIMARY_CONTACT_CI_THRESHOLD
}

function materialLooksInferred(component) {
  const confidence = String(component.data_confidence ?? '').trim().toLowerCase()
  if (INFERRED_MATERIAL_CONFIDENCES.has(confidence)) return true
  const material = String(component.material ?? '').toLowerCase()
  if (INFERRED_MATERIAL_TEXT.test(material)) return true
  const rationale = String(component.rationale ?? '').toLowerCase()
  if (/inferred from|category pattern|not confirmed|unverified|undisclosed/.test(rationale)) {
    return true
  }
  return false
}

function evidenceConfidenceForComponent(facts, componentName) {
  const needle = String(componentName ?? '').toLowerCase().slice(0, 24)
  if (!needle) return null
  for (const fact of facts ?? []) {
    if (!/material|component|contact|surface/i.test(String(fact.fact_key))) continue
    const blob = `${fact.fact_key} ${fact.fact_value} ${fact.excerpt}`.toLowerCase()
    if (blob.includes(needle.slice(0, 16))) {
      return String(fact.confidence ?? '').trim().toLowerCase()
    }
  }
  return null
}

/**
 * @param {object} inputs
 * @param {object} evidence
 */
export function runEvidenceGaps(inputs, evidence) {
  const components = inputs?.components ?? []
  const facts = evidence?.facts ?? []
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
    const evidenceConfidence = evidenceConfidenceForComponent(facts, component.component_name)
    const inferred =
      materialLooksInferred(component) ||
      (evidenceConfidence != null && INFERRED_MATERIAL_CONFIDENCES.has(evidenceConfidence))

    primary_contact_components.push({
      component_name: component.component_name,
      contact_intimacy: Number(component.contact_intimacy),
      material: component.material,
      material_confidence: component.data_confidence ?? evidenceConfidence ?? 'unknown',
    })

    if (inferred) {
      flags.push({
        code: 'PRIMARY_CONTACT_MATERIAL_INFERRED',
        message: `Primary food-contact part "${component.component_name}" relies on inferred or unverified material disclosure`,
        context: {
          component_name: component.component_name,
          material: component.material,
          data_confidence: component.data_confidence,
          evidence_confidence: evidenceConfidence,
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
