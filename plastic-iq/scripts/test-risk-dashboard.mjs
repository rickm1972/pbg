#!/usr/bin/env node
/**
 * Risk Dashboard — Oura-style favorable fill + descriptive factor labels.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { projectRoot } from './lib/env.mjs'
import { computeRiskDashboardMetrics } from './lib/risk-dashboard-metrics.mjs'

const CARAWAY_COMPONENTS = [
  {
    role: 'primary_food_contact',
    material_id: 'ceramic_nonstick_sol_gel',
    material_hazard: 0.35,
    adjusted_migration_potential: 0.38,
    contact_intimacy: 0.95,
    exposure_severity: 0.96,
  },
  {
    role: 'structural',
    material_id: 'aluminum_core',
    material_hazard: 0.12,
    adjusted_migration_potential: 0.15,
    contact_intimacy: 0.3,
  },
]

const DUO = [
  {
    label: 'Lodge',
    id: '1cf2fa4e-5cdd-4798-8f3c-6c273ae69fa8',
    material: { fill: [67, 100], status: 'Minimal PAC concern', tone: 'safe' },
    migration: { fill: [67, 100], status: 'Low migration', tone: 'safe' },
    useConditions: { fill: [0, 33], status: 'Harsh', tone: 'concerning' },
  },
  {
    label: 'T-Fal',
    id: '7a457a86-ab62-4cbf-90b9-ccaeafe06896',
    material: { fill: [0, 33], status: 'High concern · PTFE coating', tone: 'concerning' },
    migration: { fill: [0, 33], status: 'High migration', tone: 'concerning' },
    useConditions: { fill: [0, 33], status: 'Harsh', tone: 'concerning' },
  },
]

function checkIndicator(label, key, actual, expected) {
  const fillOk =
    actual.fillPercent >= expected.fill[0] && actual.fillPercent <= expected.fill[1]
  const statusOk = actual.statusLabel === expected.status
  const toneOk = actual.tone === expected.tone
  if (!fillOk || !statusOk || !toneOk) {
    console.error(
      `  ✗ ${label} ${key}: fill ${actual.fillPercent.toFixed(1)}% (want ${expected.fill[0]}-${expected.fill[1]}), status "${actual.statusLabel}" (want "${expected.status}"), tone ${actual.tone}`,
    )
    return false
  }
  return true
}

let failed = false

for (const row of DUO) {
  const packet = JSON.parse(
    readFileSync(join(projectRoot, 'scripts/output', `agent2-${row.id}.json`), 'utf8'),
  )
  const components = packet.scoringInput?.inputs?.components ?? packet.inputs?.components
  if (!components?.length) {
    console.error(`  ✗ ${row.label}: no components in agent2 output packet`)
    failed = true
    continue
  }
  const m = computeRiskDashboardMetrics(components, {
    transparencyBadge: row.label === 'T-Fal' ? 'Material Uncertain' : undefined,
  })

  let ok = true
  ok =
    checkIndicator(row.label, 'material', m.material, row.material) &&
    checkIndicator(row.label, 'migration', m.migration, row.migration) &&
    checkIndicator(row.label, 'useConditions', m.useConditions, row.useConditions)

  console.log(
    `${ok ? '✓' : '✗'} ${row.label}: Material ${m.material.statusLabel} ${m.material.fillPercent.toFixed(1)}% (${m.material.tone}) | Migration ${m.migration.statusLabel} ${m.migration.fillPercent.toFixed(1)}% | Use ${m.useConditions.statusLabel} ${m.useConditions.fillPercent.toFixed(1)}% (${m.useConditions.tone})`,
  )
  if (!ok) failed = true
}

const caraway = computeRiskDashboardMetrics(CARAWAY_COMPONENTS, {
  transparencyBadge: 'Material Uncertain',
})
assert.ok(caraway.material.statusLabel === 'Moderate concern · coating uncertainty')
assert.ok(caraway.material.tone === 'moderate')
assert.ok(caraway.material.fillPercent >= 55 && caraway.material.fillPercent <= 60)
assert.ok(caraway.migration.statusLabel === 'Moderate migration')
assert.ok(caraway.migration.fillPercent >= 50 && caraway.migration.fillPercent <= 55)
assert.ok(caraway.useConditions.statusLabel === 'Harsh')
assert.ok(caraway.useConditions.tone === 'concerning')
assert.ok(caraway.useConditions.fillPercent <= 33)
console.log(
  `✓ Caraway: Material ${caraway.material.statusLabel} ${caraway.material.fillPercent.toFixed(1)}% | Migration ${caraway.migration.statusLabel} ${caraway.migration.fillPercent.toFixed(1)}% | Use ${caraway.useConditions.statusLabel} ${caraway.useConditions.fillPercent.toFixed(1)}%`,
)

const gentleUse = computeRiskDashboardMetrics([
  {
    role: 'formulation',
    material_id: 'plant_based_formulation',
    material_hazard: 0.08,
    adjusted_migration_potential: 0.1,
    contact_intimacy: 0.25,
    exposure_severity: 0.15,
  },
])
assert.ok(gentleUse.useConditions.statusLabel === 'Gentle')
assert.ok(gentleUse.useConditions.tone === 'safe')
assert.ok(gentleUse.useConditions.fillPercent >= 67)
console.log(
  `✓ Gentle use: ${gentleUse.useConditions.statusLabel} ${gentleUse.useConditions.fillPercent.toFixed(1)}%`,
)

if (failed) {
  console.error('\nRisk dashboard test FAILED')
  process.exit(1)
}
console.log('\nRisk dashboard test PASSED')
