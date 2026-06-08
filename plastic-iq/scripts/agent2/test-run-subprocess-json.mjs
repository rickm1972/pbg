#!/usr/bin/env node
/**
 * Assert Agent 2 JSON CLI keeps stdout parseable.
 * Usage: node scripts/agent2/test-run-subprocess-json.mjs
 */
import { parseAgent2JsonStdout } from './run-subprocess.mjs'

const payload = { ok: true, product_id: 'test', input_id: 'abc' }
const polluted = `=== Agent 2: T-Fal ===\nStep 5b: mapped\n${JSON.stringify(payload)}`

const parsed = parseAgent2JsonStdout(polluted)
if (parsed.product_id !== 'test') {
  console.error('✗ failed to parse JSON from polluted stdout')
  process.exit(1)
}

const clean = parseAgent2JsonStdout(`${JSON.stringify(payload)}\n`)
if (clean.input_id !== 'abc') {
  console.error('✗ failed to parse clean stdout')
  process.exit(1)
}

console.log('OK: Agent 2 subprocess JSON stdout parsing')
