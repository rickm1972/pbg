/**
 * Risk Dashboard metrics (keep in sync with src/lib/riskDashboard.ts).
 */

const RISK_DASHBOARD_DOMINANT_MATERIAL_IDS = new Set([
  'proprietary_named_food_contact',
  'terrabond_proprietary',
])

const PRIMARY_CONTACT_ROLES = new Set([
  'primary_food_contact',
  'coating',
  'formulation',
])

function num(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function clampPercent(n) {
  return Math.min(100, Math.max(0, n))
}

function contactIntimacy(component) {
  return num(component.contact_intimacy)
}

function isRiskDashboardDominantMaterial(materialId) {
  return RISK_DASHBOARD_DOMINANT_MATERIAL_IDS.has(String(materialId ?? ''))
}

function primaryFoodContactComponents(components) {
  const primary = components.filter((c) =>
    PRIMARY_CONTACT_ROLES.has(String(c.component_role ?? c.role ?? '')),
  )
  return primary.length > 0 ? primary : components
}

function useConditionsIntensity(component) {
  return num(component.exposure_severity) * contactIntimacy(component)
}

function weightedByContactIntimacy(components, valueFor) {
  const sumCi = components.reduce((acc, c) => acc + contactIntimacy(c), 0)
  if (sumCi <= 0) return 0
  return components.reduce((acc, c) => acc + valueFor(c) * contactIntimacy(c), 0) / sumCi
}

function dominantCapMaterialSignal(components) {
  let hazard = 0
  let migration = 0
  let found = false
  for (const component of components) {
    if (!isRiskDashboardDominantMaterial(component.material_id)) continue
    found = true
    hazard = Math.max(hazard, num(component.material_hazard))
    migration = Math.max(
      migration,
      num(component.adjusted_migration_potential ?? component.base_migration_potential),
    )
  }
  return found ? { hazard, migration } : null
}

function effectiveMaterialHazard(components, weightedHazard) {
  const dominant = dominantCapMaterialSignal(components)
  if (!dominant) return weightedHazard
  return Math.max(weightedHazard, dominant.hazard)
}

function effectiveMigration(components, weightedMigration) {
  const dominant = dominantCapMaterialSignal(components)
  if (!dominant) return weightedMigration
  return Math.max(weightedMigration, dominant.migration)
}

function indicatorFromRiskLevel(riskLevel, labels) {
  const fillPercent = clampPercent(100 - riskLevel * 100)
  if (fillPercent <= 33) {
    return { fillPercent, statusLabel: labels.concerning, tone: 'concerning' }
  }
  if (fillPercent <= 66) {
    return { fillPercent, statusLabel: labels.moderate, tone: 'moderate' }
  }
  return { fillPercent, statusLabel: labels.safe, tone: 'safe' }
}

export function computeRiskDashboardMetrics(components) {
  if (!components?.length) return null

  const weightedHazard = weightedByContactIntimacy(components, (c) => num(c.material_hazard))
  const weightedMigration = weightedByContactIntimacy(components, (c) =>
    num(c.adjusted_migration_potential),
  )
  const materialHazard = effectiveMaterialHazard(components, weightedHazard)
  const migrationLevel = effectiveMigration(components, weightedMigration)
  const useContactSet = primaryFoodContactComponents(components)
  const weightedUseIntensity = weightedByContactIntimacy(
    useContactSet,
    useConditionsIntensity,
  )

  return {
    material: indicatorFromRiskLevel(materialHazard, {
      safe: 'Safe',
      moderate: 'Mixed',
      concerning: 'Concerning',
    }),
    migration: indicatorFromRiskLevel(migrationLevel, {
      safe: 'Minimal',
      moderate: 'Moderate',
      concerning: 'High',
    }),
    useConditions: indicatorFromRiskLevel(weightedUseIntensity, {
      safe: 'Gentle',
      moderate: 'Standard',
      concerning: 'Harsh',
    }),
  }
}
