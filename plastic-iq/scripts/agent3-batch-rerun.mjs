#!/usr/bin/env node
/**
 * Re-run Agent 3 on named products and print review-ready summaries (no approval).
 *
 *   node scripts/agent3-batch-rerun.mjs
 */
import { runAgent3, formatScoringSummary } from './agent3/runner.mjs'

const PRODUCT_NAMES = [
  'Lodge 10.25 Inch Cast Iron Skillet',
  'All-Clad G5 Graphite Core Stainless Steel Skillet 12 Inch',
  'Bentgo Glass Containers with Tempered Glass Lids Set of 3',
  'BlenderBottle Strada 24oz Stainless Steel Shaker',
  'Blueland Powder Dish Soap Refillable System',
  'Branch Basics Multi Purpose Concentrate for Dish Washing',
]

function formatLayer4a(layer4a) {
  if (!layer4a) return ['  (no layer_4a on scoring_inputs)']
  const lines = []
  for (const adj of layer4a.positive_adjustments ?? []) {
    const reason =
      typeof adj === 'string'
        ? adj
        : adj.reason ?? adj.basis ?? adj.label ?? 'Positive'
    let value = typeof adj === 'string' ? null : (adj.value ?? adj.points)
    if (value == null && typeof adj.adjustment === 'string') {
      const parsed = Number.parseInt(adj.adjustment.replace(/[^\d-]/g, ''), 10)
      value = Number.isFinite(parsed) ? parsed : null
    }
    lines.push(`  + ${reason}${value != null ? `: +${value}` : ''}`)
  }
  for (const adj of layer4a.negative_adjustments ?? []) {
    const reason =
      typeof adj === 'string'
        ? adj
        : adj.reason ?? adj.basis ?? adj.label ?? 'Negative'
    let value = typeof adj === 'string' ? null : (adj.value ?? adj.points)
    if (value == null && typeof adj.adjustment === 'string') {
      const parsed = Number.parseInt(adj.adjustment.replace(/[^\d-]/g, ''), 10)
      value = Number.isFinite(parsed) ? parsed : null
    }
    lines.push(`  - ${reason}${value != null ? `: ${value}` : ''}`)
  }
  if (lines.length === 0) lines.push('  (no itemized adjustments)')
  lines.push(`  Net: ${layer4a.net_adjustment ?? 0}`)
  return lines
}

function formatComponents(result) {
  const comps = result.component_nprs?.components ?? []
  return comps.map((c) => {
    const npr = Number(c.final_npr).toFixed(4)
    return `  · ${c.component_name}: NPR ${npr} (CI ${c.contact_intimacy})`
  })
}

async function main() {
  const summaries = []

  for (const productName of PRODUCT_NAMES) {
    console.log('\n' + '='.repeat(72))
    console.log(`RUNNING: ${productName}`)
    console.log('='.repeat(72))

    const run = await runAgent3({ productName, dryRun: false })
    if (!run.ok) {
      summaries.push({ productName, ok: false, error: run.reason })
      console.log(`FAILED: ${run.reason}`)
      continue
    }

    const layer4a = run.scoringInput?.inputs?.layer_4a
    const r = run.result

    const block = [
      '',
      formatScoringSummary(run),
      '',
      'Layer 4A (from scoring_inputs):',
      ...formatLayer4a(layer4a),
      '',
      'Component NPRs:',
      ...formatComponents(r),
      '',
      'Explanation draft:',
      `  ${r.explanation_draft}`,
      '',
      `Status: scoring_review_pending (score_id ${run.scoreRow?.score_id})`,
    ].join('\n')

    console.log(block)
    summaries.push({
      productName,
      ok: true,
      productId: run.product.product_id,
      scoreId: run.scoreRow?.score_id,
      pac_safety_score: r.pac_safety_score,
      tier: r.tier,
      range: r.displayed_confidence_range,
      transparency: r.transparency_badge,
      layer_4a_net: r.layer_4a_net,
      explanation_draft: r.explanation_draft,
      layer4a,
      components: r.component_nprs?.components,
    })
  }

  console.log('\n' + '#'.repeat(72))
  console.log('BATCH SUMMARY')
  console.log('#'.repeat(72))
  for (const s of summaries) {
    if (!s.ok) {
      console.log(`\n✗ ${s.productName}: ${s.error}`)
      continue
    }
    console.log(`\n✓ ${s.productName}`)
    console.log(`  Score: ${s.pac_safety_score} (${s.tier}) · Range ${s.range}`)
    console.log(`  Transparency: ${s.transparency}`)
    console.log(`  Layer 4A net: ${s.layer_4a_net}`)
    console.log(`  Explanation: ${s.explanation_draft}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
