#!/usr/bin/env node
/**
 * Agent 3 — PAC Safety Scoring (CLI)
 *
 * Usage:
 *   npm run agent3 -- <product_id>
 *   npm run agent3 -- --name "Lodge Cast Iron"
 *   npm run agent3 -- --name "Lodge Cast Iron" --dry-run
 */
import { runAgent3, formatScoringSummary } from './agent3/runner.mjs'

function parseArgs(argv) {
  const args = argv.slice(2)
  let productId
  let productName
  let dryRun = false

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--name' && args[i + 1]) productName = args[++i]
    else if (args[i] === '--id' && args[i + 1]) productId = args[++i]
    else if (args[i] === '--dry-run') dryRun = true
    else if (!args[i].startsWith('-')) productId = args[i]
  }

  return { productId, productName, dryRun }
}

async function main() {
  const { productId, productName, dryRun } = parseArgs(process.argv)

  if (!productId && !productName) {
    console.error(`
Usage:
  npm run agent3 -- <product_id>
  npm run agent3 -- --name "Lodge Cast Iron"
  npm run agent3 -- --dry-run --name "Lodge Cast Iron"
`)
    process.exit(1)
  }

  const result = await runAgent3({ productId, productName, dryRun })
  console.log('\n' + formatScoringSummary(result))

  if (!result.ok) {
    process.exit(2)
  }
}

main().catch((err) => {
  console.error('Agent 3 failed:', err.message)
  process.exit(1)
})
