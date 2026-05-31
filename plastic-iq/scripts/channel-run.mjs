#!/usr/bin/env node
/**
 * CLI: run Channel Discovery agent for a topic.
 * Usage: node scripts/channel-run.mjs "plastic exposure"
 */
import { runChannelMapCli } from './channel/runner.mjs'
import { formatChannelMapSummary } from './channel/format.mjs'

const topic = process.argv.slice(2).join(' ').trim()
if (!topic) {
  console.error('Usage: node scripts/channel-run.mjs "<topic>"')
  process.exit(1)
}

runChannelMapCli({ topic })
  .then(({ row }) => {
    console.log(formatChannelMapSummary(row))
  })
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  })
