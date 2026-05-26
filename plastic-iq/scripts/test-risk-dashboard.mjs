#!/usr/bin/env node
/**
 * Risk Dashboard — validation duo (agent2 packets, no Agent 1/2 re-run).
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { projectRoot } from './lib/env.mjs'
import { computeRiskDashboardMetrics } from './lib/risk-dashboard-metrics.mjs'
import { runAgent2NormalizationPipeline } from './agent2/deterministic/pipeline.mjs'

const DUO = [
  {
    label: 'Lodge',
    id: '1cf2fa4e-5cdd-4798-8f3c-6c273ae69fa8',
    material: { fill: [95, 99], status: 'Safe' },
    migration: { fill: [95, 98], status: 'Minimal' },
    useConditions: { fill: [0, 8], status: 'Harsh' },
  },
  {
    label: 'HexClad',
    id: 'fd05c5fb-19c2-4bc0-9882-ce73a7644ef5',
    material: { fill: [18, 22], status: 'Concerning' },
    migration: { fill: [10, 15], status: 'High' },
    useConditions: { fill: [0, 8], status: 'Harsh' },
  },
]

function checkIndicator(label, key, actual, expected) {
  const fillOk =
    actual.fillPercent >= expected.fill[0] && actual.fillPercent <= expected.fill[1]
  const statusOk = actual.statusLabel === expected.status
  if (!fillOk || !statusOk) {
    console.error(
      `  ✗ ${label} ${key}: fill ${actual.fillPercent.toFixed(1)}% (want ${expected.fill[0]}-${expected.fill[1]}), status "${actual.statusLabel}" (want "${expected.status}")`,
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
  const { inputs } = runAgent2NormalizationPipeline(packet.product, packet.evidence)
  const m = computeRiskDashboardMetrics(inputs.components)

  let ok = true
  ok =
    checkIndicator(row.label, 'material', m.material, row.material) &&
    checkIndicator(row.label, 'migration', m.migration, row.migration) &&
    checkIndicator(row.label, 'useConditions', m.useConditions, row.useConditions)

  console.log(
    `${ok ? '✓' : '✗'} ${row.label}: Material ${m.material.statusLabel} ${m.material.fillPercent.toFixed(1)}% | Migration ${m.migration.statusLabel} ${m.migration.fillPercent.toFixed(1)}% | Use ${m.useConditions.statusLabel} ${m.useConditions.fillPercent.toFixed(1)}%`,
  )
  if (!ok) failed = true
}

if (failed) {
  console.error('\nRisk dashboard test FAILED')
  process.exit(1)
}
console.log('\nRisk dashboard test PASSED')
