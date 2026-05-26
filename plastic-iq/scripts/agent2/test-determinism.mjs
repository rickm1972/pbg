#!/usr/bin/env node
/**
 * Agent 2 determinism test — same evidence must yield identical outputs.
 * Usage: node scripts/agent2/test-determinism.mjs
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { projectRoot } from '../lib/env.mjs'
import { runAgent2NormalizationPipeline } from './deterministic/pipeline.mjs'
import { scoreNormalization } from '../agent3/algorithm.mjs'

const PRODUCTS = [
  { label: 'Lodge', id: '1cf2fa4e-5cdd-4798-8f3c-6c273ae69fa8' },
  { label: 'Branch Basics', id: 'a0c72167-f0f6-491e-90f7-bbb622fa5123' },
  { label: 'HexClad', id: 'fd05c5fb-19c2-4bc0-9882-ce73a7644ef5' },
]

const RUNS = 3

function stableSnapshot(product, evidence, inputs, whyThisScore) {
  return JSON.stringify({
    product_id: product.product_id,
    category: inputs.product_category_default,
    is_formulation: inputs.is_formulation_product,
    components: inputs.components.map((c) => ({
      name: c.component_name,
      role: c.component_role,
      material_id: c.material_id,
      hazard: c.material_hazard,
      migration: c.adjusted_migration_potential,
      ci: c.contact_intimacy,
      confidence: c.data_confidence,
    })),
    layer_4a: inputs.layer_4a,
    layer_4b: inputs.layer_4b,
    whyThisScore,
  })
}

function diffLines(a, b) {
  const linesA = a.split('\n')
  const linesB = b.split('\n')
  const max = Math.max(linesA.length, linesB.length)
  const diffs = []
  for (let i = 0; i < max; i++) {
    if (linesA[i] !== linesB[i]) {
      diffs.push({ line: i + 1, run1: linesA[i], run2: linesB[i] })
    }
  }
  return diffs
}

let failed = false

for (const { label, id } of PRODUCTS) {
  const path = join(projectRoot, 'scripts', 'output', `agent2-${id}.json`)
  const packet = JSON.parse(readFileSync(path, 'utf8'))
  const product = packet.product
  const evidence = packet.evidence

  const snapshots = []
  for (let r = 0; r < RUNS; r++) {
    const { inputs, whyThisScore } = runAgent2NormalizationPipeline(product, evidence)
    snapshots.push(stableSnapshot(product, evidence, inputs, whyThisScore))
  }

  const base = snapshots[0]
  let productOk = true
  for (let r = 1; r < RUNS; r++) {
    if (snapshots[r] !== base) {
      productOk = false
      failed = true
      console.error(`\n✗ ${label}: run 1 vs run ${r + 1} differ`)
      const diffs = diffLines(base, snapshots[r])
      for (const d of diffs.slice(0, 8)) {
        console.error(`  line ${d.line}:`)
        console.error(`    run1: ${d.run1?.slice(0, 120)}`)
        console.error(`    run${r + 1}: ${d.run2?.slice(0, 120)}`)
      }
      if (diffs.length > 8) console.error(`  … ${diffs.length - 8} more line diffs`)
    }
  }

  if (productOk) {
    const parsed = JSON.parse(base)
    console.log(`✓ ${label}: ${RUNS} identical runs`)
    console.log(`  badge: ${parsed.layer_4b.transparency_badge} (±${parsed.layer_4b.confidence_interval})`)
    console.log(`  components: ${parsed.components.map((c) => c.name).join('; ')}`)
    console.log(`  primary options: ${parsed.whyThisScore.primary_material_options.join(', ')}`)
    console.log(`  secondary options: ${parsed.whyThisScore.secondary_materials_options.join(', ')}`)
    console.log(`  layer_4a net: ${parsed.layer_4a.net_adjustment}`)
    const positives = parsed.layer_4a.positive_adjustments ?? []
    if (positives.length) {
      console.log(`  layer_4a positives: ${positives.map((a) => `${a.reason} +${a.value}`).join('; ')}`)
    }
    if (label === 'Lodge' && positives.some((a) => /made safe/i.test(a.reason))) {
      console.error('  ✗ Lodge must not receive MADE SAFE Layer 4A credit')
      failed = true
    }
    if (label === 'Branch Basics') {
      const madeSafe = positives.filter((a) => /made safe/i.test(a.reason))
      if (madeSafe.length > 1 || (madeSafe[0] && madeSafe[0].value > 2)) {
        console.error('  ✗ Branch Basics MADE SAFE must be +2 once only')
        failed = true
      }
      if (parsed.category !== 'rinse-off') {
        console.error(`  ✗ Branch Basics category must be rinse-off, got ${parsed.category}`)
        failed = true
      }
      const form = parsed.components.find((c) => c.role === 'formulation')
      if (!form || form.ci !== 0.25) {
        console.error(`  ✗ Branch Basics formulation CI must be 0.25, got ${form?.ci}`)
        failed = true
      }
    }
    if (label === 'HexClad') {
      if (parsed.components.length !== 6) {
        console.error(`  ✗ HexClad must extract 6 components, got ${parsed.components.length}`)
        failed = true
      }
      const peaks = parsed.components.find((c) => /peaks|hexagonal/i.test(c.name))
      const valleys = parsed.components.find((c) => /terrabond|valley/i.test(c.name))
      if (!peaks) {
        console.error('  ✗ HexClad must include Cooking Surface — Stainless Steel Hexagonal Peaks')
        failed = true
      }
      if (!valleys) {
        console.error('  ✗ HexClad must include Cooking Surface — TerraBond Ceramic (valleys)')
        failed = true
      }
      if (peaks && peaks.ci !== 1) {
        console.error(`  ✗ HexClad peaks CI must be 1.0, got ${peaks.ci}`)
        failed = true
      }
      if (peaks && peaks.hazard > 0.1) {
        console.error(`  ✗ HexClad peaks hazard must be ~0.03, got ${peaks.hazard}`)
        failed = true
      }
      const { inputs } = runAgent2NormalizationPipeline(product, evidence)
      const scored = scoreNormalization(inputs, { brand: product.brand })
      if (scored.pac_safety_score < 35 || scored.pac_safety_score > 40) {
        console.error(
          `  ✗ HexClad PAC score must be 35–40 Concern (with net Layer 4A -5), got ${scored.pac_safety_score} (${scored.tier})`,
        )
        failed = true
      } else {
        console.log(`  pac score: ${scored.pac_safety_score} (${scored.tier})`)
      }
      if (!parsed.layer_4a.unknown_coating_cap_applies) {
        console.error('  ✗ HexClad must set unknown_coating_cap_applies')
        failed = true
      }
      if (parsed.layer_4b.transparency_badge !== 'Opaque') {
        console.error(`  ✗ HexClad badge must be Opaque, got ${parsed.layer_4b.transparency_badge}`)
        failed = true
      }
      const unknownNeg = (parsed.layer_4a.negative_adjustments ?? []).find((a) =>
        /unknown proprietary food-contact coating/i.test(a.reason),
      )
      if (!unknownNeg || unknownNeg.value !== -3) {
        console.error('  ✗ HexClad must have Layer 4A -3 unknown proprietary food-contact coating')
        failed = true
      }
      if (parsed.layer_4a.net_adjustment !== -5) {
        console.error(`  ✗ HexClad Layer 4A net must be -5, got ${parsed.layer_4a.net_adjustment}`)
        failed = true
      }
      const handle = parsed.components.find((c) => /stay-cool|handle/i.test(c.name))
      if (handle && !handle.name.toLowerCase().includes('stay-cool')) {
        console.error(`  ✗ HexClad handle display label must preserve stay-cool evidence text, got "${handle.name}"`)
        failed = true
      }
      if (handle && handle.material_id !== 'stay_cool_handle_undisclosed') {
        console.error(`  ✗ HexClad handle material_id must stay undisclosed for display, got ${handle.material_id}`)
        failed = true
      }
      if (parsed.whyThisScore.primary_material_options.includes('None')) {
        console.error('  ✗ HexClad primary_material must not be None')
        failed = true
      }
      if (parsed.whyThisScore.secondary_materials_options.some((o) => /Magnetic stainless steel base/i.test(o))) {
        console.error('  ✗ HexClad must not have phantom Magnetic stainless steel base in secondary_materials')
        failed = true
      }
      const sec = parsed.whyThisScore.secondary_materials_options.filter((o) => o !== 'None')
      const expected = ['Aluminum core', 'Stainless steel grade unspecified', 'Tempered glass lid']
      for (const label of expected) {
        if (!sec.includes(label)) {
          console.error(`  ✗ HexClad secondary_materials missing: ${label}`)
          failed = true
        }
      }
      if (!sec.some((o) => /stay-cool|stainless steel handle/i.test(o))) {
        console.error('  ✗ HexClad secondary_materials must include handle option')
        failed = true
      }
    }
    if (parsed.whyThisScore.primary_material_options.some((o) => /PTFE/i.test(o))) {
      console.error(`  ✗ PTFE option present — regression`)
      failed = true
    }
  }
}

if (failed) {
  console.error('\nDeterminism test FAILED')
  process.exit(1)
}
console.log('\nDeterminism test PASSED (all products, 3 runs each)')
process.exit(0)
