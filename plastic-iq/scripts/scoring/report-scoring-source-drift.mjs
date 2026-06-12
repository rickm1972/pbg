#!/usr/bin/env node
/**
 * Read-only scoring source-of-truth reconciliation.
 * Compares live code constants against repo source files:
 *   - docs/source-of-truth/PBG_Material_Lookup.xlsx
 *   - docs/source-of-truth/PAC_Scoring_Algorithm_v2.3.5.docx
 *
 * Does NOT mutate code, DB, or scoring data. Outputs JSON report to stdout.
 */
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '../..')
const PY = path.join(__dirname, 'report-scoring-source-drift.py')

const result = spawnSync('python3', [PY], {
  cwd: ROOT,
  encoding: 'utf8',
  maxBuffer: 50 * 1024 * 1024,
})

if (result.error) {
  console.error(result.error.message)
  process.exit(1)
}
if (result.status !== 0) {
  process.stderr.write(result.stderr || '')
  process.stdout.write(result.stdout || '')
  process.exit(result.status ?? 1)
}

process.stdout.write(result.stdout)
