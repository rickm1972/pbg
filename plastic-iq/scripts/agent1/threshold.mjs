import { isStrongConfidence } from './types.mjs'

function findFact(facts, predicate) {
  return facts.find(predicate)
}

function factValue(fact) {
  if (fact?.fact_value == null) return ''
  return String(fact.fact_value).trim()
}

export function evaluateMinimumThreshold(sources, facts) {
  const primaryMaterial = findFact(
    facts,
    (f) =>
      f.fact_key === 'primary_material' ||
      (f.fact_type === 'material' && f.fact_key.includes('primary')),
  )

  const primaryContact = findFact(
    facts,
    (f) =>
      f.fact_key === 'primary_contact_surface' ||
      f.fact_type === 'contact_surface',
  )

  const useCase = findFact(
    facts,
    (f) =>
      f.fact_key === 'product_use_case' ||
      f.fact_type === 'use_case' ||
      f.fact_key === 'use_case',
  )

  const primaryMaterialConfirmed =
    !!primaryMaterial &&
    isStrongConfidence(primaryMaterial.confidence) &&
    factValue(primaryMaterial).length > 0 &&
    factValue(primaryMaterial).toLowerCase() !== 'unknown'

  const primaryContactIdentified =
    !!primaryContact &&
    primaryContact.confidence !== 'unknown' &&
    factValue(primaryContact).length > 0

  const useCaseAssigned =
    !!useCase &&
    useCase.confidence !== 'unknown' &&
    factValue(useCase).length > 0

  const sourceRecordedForPrimaryMaterial =
    !!primaryMaterial &&
    primaryMaterial.source_index != null &&
    Number.isInteger(primaryMaterial.source_index) &&
    primaryMaterial.source_index >= 0 &&
    primaryMaterial.source_index < sources.length &&
    Boolean(sources[primaryMaterial.source_index]?.url)

  const checks = {
    primary_material_confirmed: primaryMaterialConfirmed,
    primary_contact_surface_identified: primaryContactIdentified,
    product_use_case_assigned: useCaseAssigned,
    evidence_source_recorded_for_primary_material: sourceRecordedForPrimaryMaterial,
  }

  const failures = Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([key]) => key)

  return {
    met: failures.length === 0,
    checks,
    failures,
  }
}
