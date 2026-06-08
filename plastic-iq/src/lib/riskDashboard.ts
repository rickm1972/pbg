import type { NormalizationComponent } from '../types/agent'
import {
  disclosureBadgeLimitsCoatingChemistry,
  isFoodContactCoatingMaterial,
  isInertFoodContactMaterial,
  isKnownPtfeFluoropolymerMaterial,
  isRiskDashboardDominantMaterial,
  isUnknownFoodContactCoatingMaterial,
} from './materialTaxonomy'

const PRIMARY_CONTACT_ROLES = new Set([
  'primary_food_contact',
  'coating',
  'formulation',
])

/** Hazard/migration at or below this → safe tone (long green bar). */
export const RISK_DASHBOARD_MINIMAL_THRESHOLD = 0.15

/** Inputs above this are capped into the short red unfavorable band (0–33% bar fill). */
export const RISK_DASHBOARD_MODERATE_THRESHOLD = 0.4

/** Visual fill band for moderate migration (orange, mid-bar — not near-safe). */
const MODERATE_MIGRATION_FILL = { min: 50, max: 55 } as const

/** Visual fill band for moderate material with coating-chemistry uncertainty. */
const MODERATE_COATING_UNCERTAINTY_FILL = { min: 55, max: 60 } as const

export type RiskIndicatorTone = 'safe' | 'moderate' | 'concerning'

export type RiskDashboardIndicator = {
  /** Bar fill 0–100: longer = lower concern (Oura-style favorable fill). */
  fillPercent: number
  statusLabel: string
  tone: RiskIndicatorTone
}

export type RiskDashboardMetrics = {
  material: RiskDashboardIndicator
  migration: RiskDashboardIndicator
  useConditions: RiskDashboardIndicator
}

export type RiskDashboardOptions = {
  transparencyBadge?: string | null
}

function num(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function clampPercent(n: number): number {
  return Math.min(100, Math.max(0, n))
}

function clampRiskLevel(n: number): number {
  return Math.min(1, Math.max(0, n))
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

function toneForRiskLevel(riskLevel: number): RiskIndicatorTone {
  if (riskLevel <= RISK_DASHBOARD_MINIMAL_THRESHOLD) return 'safe'
  if (riskLevel <= RISK_DASHBOARD_MODERATE_THRESHOLD) return 'moderate'
  return 'concerning'
}

/** Map moderate risk inputs into a mid-orange bar band (higher risk → shorter bar). */
function moderateBandFill(
  riskLevel: number,
  fillMin: number,
  fillMax: number,
): number {
  const span = RISK_DASHBOARD_MODERATE_THRESHOLD - RISK_DASHBOARD_MINIMAL_THRESHOLD
  if (span <= 0) return fillMax
  const t = (riskLevel - RISK_DASHBOARD_MINIMAL_THRESHOLD) / span
  return clampPercent(fillMax - t * (fillMax - fillMin))
}

function favorableFillFromRiskLevel(
  riskLevel: number,
  moderateFillRange?: { min: number; max: number },
): number {
  const level = clampRiskLevel(riskLevel)
  if (level > RISK_DASHBOARD_MODERATE_THRESHOLD) {
    return Math.min(clampPercent((1 - level) * 100), 33)
  }

  const tone = toneForRiskLevel(level)
  if (tone === 'safe') {
    return clampPercent((1 - level) * 100)
  }
  if (tone === 'moderate' && moderateFillRange) {
    return moderateBandFill(level, moderateFillRange.min, moderateFillRange.max)
  }
  return clampPercent((1 - level) * 100)
}

function contactSetHasKnownPtfe(contactSet: NormalizationComponent[]): boolean {
  return contactSet.some((c) => isKnownPtfeFluoropolymerMaterial(materialId(c)))
}

function contactSetNeedsCoatingUncertaintyLabel(
  contactSet: NormalizationComponent[],
  transparencyBadge: string | null | undefined,
): boolean {
  if (contactSetHasKnownPtfe(contactSet)) return false

  const limitedDisclosure = disclosureBadgeLimitsCoatingChemistry(transparencyBadge)

  return contactSet.some((c) => {
    const id = materialId(c)
    if (isInertFoodContactMaterial(id)) return false
    if (isKnownPtfeFluoropolymerMaterial(id)) return false
    if (isUnknownFoodContactCoatingMaterial(id)) return true
    if (!limitedDisclosure) return false
    return isFoodContactCoatingMaterial(id)
  })
}

function resolveMaterialStatusLabel(
  tone: RiskIndicatorTone,
  labels: { safe: string; moderate: string; concerning: string },
  contactSet: NormalizationComponent[],
  transparencyBadge: string | null | undefined,
): string {
  if (contactSetHasKnownPtfe(contactSet) && tone === 'concerning') {
    return 'High concern · PTFE coating'
  }

  if (contactSetNeedsCoatingUncertaintyLabel(contactSet, transparencyBadge)) {
    if (tone === 'moderate') return 'Moderate concern · coating uncertainty'
    if (tone === 'concerning') return 'High concern · coating uncertainty'
  }

  return tone === 'safe' ? labels.safe : tone === 'moderate' ? labels.moderate : labels.concerning
}

function indicatorFromRiskLevel(
  riskLevel: number,
  labels: { safe: string; moderate: string; concerning: string },
  options?: {
    components?: NormalizationComponent[]
    transparencyBadge?: string | null
    moderateFillRange?: { min: number; max: number }
  },
): RiskDashboardIndicator {
  const level = clampRiskLevel(riskLevel)
  let moderateFillRange = options?.moderateFillRange

  if (options?.components) {
    const contactSet = primaryFoodContactComponents(options.components)
    if (
      contactSetNeedsCoatingUncertaintyLabel(contactSet, options.transparencyBadge) &&
      toneForRiskLevel(level) === 'moderate'
    ) {
      moderateFillRange = MODERATE_COATING_UNCERTAINTY_FILL
    }
  }

  const fillPercent = favorableFillFromRiskLevel(level, moderateFillRange)
  const tone = toneForRiskLevel(level)

  let statusLabel =
    tone === 'safe' ? labels.safe : tone === 'moderate' ? labels.moderate : labels.concerning

  if (options?.components) {
    const contactSet = primaryFoodContactComponents(options.components)
    statusLabel = resolveMaterialStatusLabel(
      tone,
      labels,
      contactSet,
      options.transparencyBadge,
    )
  }

  return { fillPercent, statusLabel, tone }
}

export function computeRiskDashboardMetrics(
  components: NormalizationComponent[],
  options: RiskDashboardOptions = {},
): RiskDashboardMetrics | null {
  if (!components?.length) return null

  const contactSet = primaryFoodContactComponents(components)

  const weightedHazard = weightedByContactIntimacy(contactSet, (c) =>
    num(c.material_hazard),
  )
  const weightedMigration = weightedByContactIntimacy(contactSet, (c) =>
    num(c.adjusted_migration_potential ?? c.base_migration_potential),
  )

  const materialHazard = effectiveMaterialHazard(contactSet, weightedHazard)
  const migrationLevel = effectiveMigration(contactSet, weightedMigration)

  const weightedUseIntensity = clampRiskLevel(
    weightedByContactIntimacy(contactSet, useConditionsIntensity),
  )

  return {
    material: indicatorFromRiskLevel(
      materialHazard,
      {
        safe: 'Minimal PAC concern',
        moderate: 'Moderate concern',
        concerning: 'High PAC concern',
      },
      { components, transparencyBadge: options.transparencyBadge },
    ),
    migration: indicatorFromRiskLevel(
      migrationLevel,
      {
        safe: 'Low migration',
        moderate: 'Moderate migration',
        concerning: 'High migration',
      },
      { moderateFillRange: MODERATE_MIGRATION_FILL },
    ),
    useConditions: indicatorFromRiskLevel(weightedUseIntensity, {
      safe: 'Gentle',
      moderate: 'Standard',
      concerning: 'Harsh',
    }),
  }
}
