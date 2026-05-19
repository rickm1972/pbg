#!/usr/bin/env node
/**
 * Agent 1 — Product Evidence Agent (CLI)
 *
 * Usage:
 *   npm run agent1 -- <product_id>
 *   npm run agent1 -- --name "Lodge Cast Iron Skillet"
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runAgent1, formatPacketSummary } from './agent1/runner.mjs'
import { projectRoot } from './lib/env.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))

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
  npm run agent1 -- <product_id>
  npm run agent1 -- --name "Lodge Cast Iron Skillet"

Requires PERPLEXITY_API_KEY + ANTHROPIC_API_KEY in plastic-iq/.env (default: Perplexity Search + Claude synthesis)
`)
    process.exit(1)
  }

  const result = await runAgent1({ productId, productName, dryRun })

  const outDir = join(projectRoot, 'scripts', 'output')
  const outFile = join(
    outDir,
    `agent1-${result.product.product_id}.json`,
  )

  mkdirSync(outDir, { recursive: true })

  writeFileSync(outFile, JSON.stringify(result, null, 2), 'utf8')

  console.log('\n' + formatPacketSummary(result))
  console.log(`\nFull packet written to: ${outFile}`)

  if (!result.ok) {
    process.exit(2)
  }
}

main().catch((err) => {
  console.error('Agent 1 failed:', err.message)
  process.exit(1)
})
