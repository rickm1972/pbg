#!/usr/bin/env node
/**
 * Agent 4 — QA audit (CLI)
 *
 *   npm run agent4 -- --name "Lodge 10.25 Inch Cast Iron Skillet"
 *   npm run agent4 -- <product_id> --dry-run
 *   npm run agent4 -- --name "Lodge" --replace
 */
import { runAgent4, formatQaSummary } from './agent4/runner.mjs'

function parseArgs(argv) {
  const args = argv.slice(2)
  let productId
  let productName
  let scoreId
  let dryRun = false
  let replaceExisting = false

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--name' && args[i + 1]) productName = args[++i]
    else if (args[i] === '--id' && args[i + 1]) productId = args[++i]
    else if (args[i] === '--score-id' && args[i + 1]) scoreId = args[++i]
    else if (args[i] === '--dry-run') dryRun = true
    else if (args[i] === '--replace') replaceExisting = true
    else if (!args[i].startsWith('-')) productId = args[i]
  }

  return { productId, productName, scoreId, dryRun, replaceExisting }
}

async function main() {
  const { productId, productName, scoreId, dryRun, replaceExisting } = parseArgs(process.argv)

  if (!productId && !productName) {
    console.error(`
Usage:
  npm run agent4 -- <product_id>
  npm run agent4 -- --name "Lodge 10.25 Inch Cast Iron Skillet"
  npm run agent4 -- --name "Lodge" --dry-run
  npm run agent4 -- --name "Lodge" --replace
`)
    process.exit(1)
  }

  const result = await runAgent4({
    productId,
    productName,
    scoreId,
    dryRun,
    replaceExisting,
  })
  console.log('\n' + formatQaSummary(result))

  if (!result.ok) {
    process.exit(2)
  }
}

main().catch((err) => {
  console.error('Agent 4 failed:', err.message)
  process.exit(1)
})
