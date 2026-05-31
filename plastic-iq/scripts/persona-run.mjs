#!/usr/bin/env node
/**
 * CLI: run Persona agent for a target segment.
 * Usage: node scripts/persona-run.mjs "primary buyer for kitchen / non-toxic products"
 */
import { runPersonaCli } from './persona/runner.mjs'
import { formatPersonaSummary } from './persona/format.mjs'

const targetSegment = process.argv.slice(2).join(' ').trim()
if (!targetSegment) {
  console.error('Usage: node scripts/persona-run.mjs "<target segment>"')
  process.exit(1)
}

runPersonaCli({ targetSegment })
  .then(({ row }) => {
    console.log(formatPersonaSummary(row))
  })
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  })
