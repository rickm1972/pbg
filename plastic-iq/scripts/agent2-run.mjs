#!/usr/bin/env node
/**
 * Agent 2 — Input Normalization Agent (CLI)
 *
 * Usage:
 *   npm run agent2 -- <product_id>
 *   npm run agent2 -- --name "Lodge Cast Iron Skillet"
 */
import { runAgent2, formatNormalizationSummary } from './agent2/runner.mjs'

function parseArgs(argv) {
  const args = argv.slice(2)
  let productId
  let productName
  let dryRun = false

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--name' && args[i + 1]) {
      productName = args[++i]
    } else if (args[i] === '--id' && args[i + 1]) {
      productId = args[++i]
    } else if (args[i] === '--dry-run') {
      dryRun = true
    } else if (!args[i].startsWith('-')) {
      productId = args[i]
    }
  }

  return { productId, productName, dryRun }
}

async function main() {
  const { productId, productName, dryRun } = parseArgs(process.argv)

  if (!productId && !productName) {
    console.error(`
Usage:
  npm run agent2 -- <product_id>
  npm run agent2 -- --name "Lodge Cast Iron Skillet"

Requires ANTHROPIC_API_KEY in plastic-iq/.env
`)
    process.exit(1)
  }

  const result = await runAgent2({ productId, productName, dryRun })
  console.log('\n' + formatNormalizationSummary(result))

  if (result.ok && result.inputs?.layer_4a_positive_reasoning) {
    const { formatLayer4aPositiveReasoning } = await import('./agent2/layer4a-positive.mjs')
    console.log('\n--- layer_4a_positive_reasoning (after strict lookup enforcement) ---')
    for (const line of formatLayer4aPositiveReasoning(result.inputs.layer_4a_positive_reasoning)) {
      console.log(line)
    }
    console.log(`\nEnforced positive_adjustments: ${JSON.stringify(result.inputs.layer_4a?.positive_adjustments ?? [], null, 2)}`)
    console.log(`Enforced layer_4a net: ${result.inputs.layer_4a?.net_adjustment ?? 0}`)
  }

  if (!result.ok) {
    process.exit(2)
  }
}

main().catch((err) => {
  console.error('Agent 2 failed:', err.message)
  process.exit(1)
})
