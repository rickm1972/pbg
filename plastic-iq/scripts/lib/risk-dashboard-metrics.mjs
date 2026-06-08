/**
 * Risk Dashboard metrics (keep in sync with src/lib/riskDashboard.ts).
 */

const RISK_DASHBOARD_MINIMAL_THRESHOLD = 0.15
const RISK_DASHBOARD_MODERATE_THRESHOLD = 0.4
const MODERATE_MIGRATION_FILL = { min: 50, max: 55 }
const MODERATE_COATING_UNCERTAINTY_FILL = { min: 55, max: 60 }

const UNKNOWN_FOOD_CONTACT_COATING_MATERIAL_IDS = new Set([
  'proprietary_named_food_contact',
  'terrabond_proprietary',
])

const FOOD_CONTACT_COATING_MATERIAL_IDS = new Set([
  'ceramic_nonstick_sol_gel',
  'thermolon_ceramic',
  'ptfe_coating',
  'ptfe_nonstick',
  'ptfe_nonstick_titanium',
  'ptfe_titanium_reinforced',
])

const KNOWN_PTFE_FLUOROPOLYMER_IDS = new Set([
  'ptfe_coating',
  'ptfe_nonstick',
  'ptfe_nonstick_titanium',
  'ptfe_titanium_reinforced',
])

const INERT_FOOD_CONTACT_MATERIAL_IDS = new Set([
  'cast_iron',
  'cast_iron_seasoned',
  'carbon_steel',
  'cast_iron_integrated_handle',
  'stainless_steel_304',
  'stainless_steel_316',
  'stainless_steel_unspecified',
  'stainless_steel_handle',
  'tempered_glass',
  'borosilicate_glass',
  'soda_lime_glass',
  'glass_type_unspecified',
  'vitreous_enamel_over_cast_iron',
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

function clampRiskLevel(n) {
  return Math.min(1, Math.max(0, n))
}

function contactIntimacy(component) {
  return num(component.contact_intimacy)
}

function materialId(component) {
  return String(component.material_id ?? '')
}

function isRiskDashboardDominantMaterial(materialId) {
  const id = String(materialId ?? '')
  if (!id) return false
  if (UNKNOWN_FOOD_CONTACT_COATING_MATERIAL_IDS.has(id)) return true
  if (FOOD_CONTACT_COATING_MATERIAL_IDS.has(id)) return true
  return /^(ptfe|ceramic_nonstick)|proprietary.*food|terrabond/i.test(id)
}

function isFoodContactCoatingMaterial(materialId) {
  const id = String(materialId ?? '')
  if (!id) return false
  if (UNKNOWN_FOOD_CONTACT_COATING_MATERIAL_IDS.has(id)) return true
  if (FOOD_CONTACT_COATING_MATERIAL_IDS.has(id)) return true
  return /ptfe|ceramic_nonstick|ceramic.*nonstick|proprietary.*food|terrabond/i.test(id)
}

function isKnownPtfeFluoropolymerMaterial(materialId) {
  const id = String(materialId ?? '')
  if (!id) return false
  if (KNOWN_PTFE_FLUOROPOLYMER_IDS.has(id)) return true
  return /^ptfe|teflon/i.test(id) || /\bfluoropolymer\b/i.test(id)
}

function isInertFoodContactMaterial(materialId) {
  const id = String(materialId ?? '')
  if (!id) return false
  if (INERT_FOOD_CONTACT_MATERIAL_IDS.has(id)) return true
  return /^(cast_iron|carbon_steel|tempered_glass|borosilicate|soda_lime)/.test(id)
}

function isUnknownFoodContactCoatingMaterial(materialId) {
  return UNKNOWN_FOOD_CONTACT_COATING_MATERIAL_IDS.has(String(materialId ?? ''))
}

function disclosureBadgeLimitsCoatingChemistry(badge) {
  const b = String(badge ?? '').trim()
  return b === 'Material Uncertain' || b === 'Documentation Incomplete' || b === 'Opaque'
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

function toneForRiskLevel(riskLevel) {
  if (riskLevel <= RISK_DASHBOARD_MINIMAL_THRESHOLD) return 'safe'
  if (riskLevel <= RISK_DASHBOARD_MODERATE_THRESHOLD) return 'moderate'
  return 'concerning'
}

function moderateBandFill(riskLevel, fillMin, fillMax) {
  const span = RISK_DASHBOARD_MODERATE_THRESHOLD - RISK_DASHBOARD_MINIMAL_THRESHOLD
  if (span <= 0) return fillMax
  const t = (riskLevel - RISK_DASHBOARD_MINIMAL_THRESHOLD) / span
  return clampPercent(fillMax - t * (fillMax - fillMin))
}

function favorableFillFromRiskLevel(riskLevel, moderateFillRange) {
  const level = clampRiskLevel(riskLevel)
  if (level > RISK_DASHBOARD_MODERATE_THRESHOLD) {
    return Math.min(clampPercent((1 - level) * 100), 33)
  }
  const tone = toneForRiskLevel(level)
  if (tone === 'safe') return clampPercent((1 - level) * 100)
  if (tone === 'moderate' && moderateFillRange) {
    return moderateBandFill(level, moderateFillRange.min, moderateFillRange.max)
  }
  return clampPercent((1 - level) * 100)
}

function contactSetHasKnownPtfe(contactSet) {
  return contactSet.some((c) => isKnownPtfeFluoropolymerMaterial(materialId(c)))
}

function contactSetNeedsCoatingUncertaintyLabel(contactSet, transparencyBadge) {
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

function resolveMaterialStatusLabel(tone, labels, contactSet, transparencyBadge) {
  if (contactSetHasKnownPtfe(contactSet) && tone === 'concerning') {
    return 'High concern · PTFE coating'
  }
  if (contactSetNeedsCoatingUncertaintyLabel(contactSet, transparencyBadge)) {
    if (tone === 'moderate') return 'Moderate concern · coating uncertainty'
    if (tone === 'concerning') return 'High concern · coating uncertainty'
  }
  return tone === 'safe' ? labels.safe : tone === 'moderate' ? labels.moderate : labels.concerning
}

function indicatorFromRiskLevel(riskLevel, labels, options) {
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

export function computeRiskDashboardMetrics(components, options = {}) {
  if (!components?.length) return null

  const contactSet = primaryFoodContactComponents(components)
  const weightedHazard = weightedByContactIntimacy(contactSet, (c) => num(c.material_hazard))
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
