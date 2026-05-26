import type { NormalizationComponent } from '../types/agent'
import { isRiskDashboardDominantMaterial } from './materialTaxonomy'

const PRIMARY_CONTACT_ROLES = new Set([
  'primary_food_contact',
  'coating',
  'formulation',
])

export type RiskIndicatorTone = 'safe' | 'moderate' | 'concerning'

export type RiskDashboardIndicator = {
  fillPercent: number
  statusLabel: string
  tone: RiskIndicatorTone
}

export type RiskDashboardMetrics = {
  material: RiskDashboardIndicator
  migration: RiskDashboardIndicator
  useConditions: RiskDashboardIndicator
}

function num(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function clampPercent(n: number): number {
  return Math.min(100, Math.max(0, n))
}

function contactIntimacy(component: NormalizationComponent): number {
  return num(component.contact_intimacy)
}

function materialId(component: NormalizationComponent): string {
  return String(component.material_id ?? '')
}

function primaryFoodContactComponents(components: NormalizationComponent[]) {
  const primary = components.filter((c) => {
    const role = c.component_role ?? c.role
    return PRIMARY_CONTACT_ROLES.has(String(role ?? ''))
  })
  return primary.length > 0 ? primary : components
}

/** Use Conditions: severity × contact intimacy only (duration excluded). */
function useConditionsIntensity(component: NormalizationComponent): number {
  return num(component.exposure_severity) * contactIntimacy(component)
}

function weightedByContactIntimacy(
  components: NormalizationComponent[],
  valueFor: (c: NormalizationComponent) => number,
): number {
  const sumCi = components.reduce((acc, c) => acc + contactIntimacy(c), 0)
  if (sumCi <= 0) return 0
  const weighted = components.reduce(
    (acc, c) => acc + valueFor(c) * contactIntimacy(c),
    0,
  )
  return weighted / sumCi
}

function dominantCapMaterialSignal(components: NormalizationComponent[]): {
  hazard: number
  migration: number
} | null {
  let hazard = 0
  let migration = 0
  let found = false

  for (const component of components) {
    if (!isRiskDashboardDominantMaterial(materialId(component))) continue
    found = true
    hazard = Math.max(hazard, num(component.material_hazard))
    migration = Math.max(
      migration,
      num(component.adjusted_migration_potential ?? component.base_migration_potential),
    )
  }

  return found ? { hazard, migration } : null
}

function effectiveMaterialHazard(
  components: NormalizationComponent[],
  weightedHazard: number,
): number {
  const dominant = dominantCapMaterialSignal(components)
  if (!dominant) return weightedHazard
  return Math.max(weightedHazard, dominant.hazard)
}

function effectiveMigration(
  components: NormalizationComponent[],
  weightedMigration: number,
): number {
  const dominant = dominantCapMaterialSignal(components)
  if (!dominant) return weightedMigration
  return Math.max(weightedMigration, dominant.migration)
}

function indicatorFromRiskLevel(
  riskLevel: number,
  labels: { safe: string; moderate: string; concerning: string },
): RiskDashboardIndicator {
  const fillPercent = clampPercent(100 - riskLevel * 100)

  if (fillPercent <= 33) {
    return { fillPercent, statusLabel: labels.concerning, tone: 'concerning' }
  }
  if (fillPercent <= 66) {
    return { fillPercent, statusLabel: labels.moderate, tone: 'moderate' }
  }
  return { fillPercent, statusLabel: labels.safe, tone: 'safe' }
}

export function computeRiskDashboardMetrics(
  components: NormalizationComponent[],
): RiskDashboardMetrics | null {
  if (!components?.length) return null

  const weightedHazard = weightedByContactIntimacy(components, (c) =>
    num(c.material_hazard),
  )
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
