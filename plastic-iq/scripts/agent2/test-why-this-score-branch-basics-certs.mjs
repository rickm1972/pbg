#!/usr/bin/env node
/**
 * Branch Basics — certifications_options must exclude non–PAC-relevant certs (e.g. Leaping Bunny).
 * Uses approved evidence + scoring_inputs from scripts/output/agent2-{id}.json (no Agent 1/2 re-run).
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { projectRoot } from '../lib/env.mjs'
import { buildWhyThisScoreOptions } from './why-this-score-map.mjs'

const BRANCH_BASICS_ID = 'a0c72167-f0f6-491e-90f7-bbb622fa5123'

const path = join(projectRoot, 'scripts', 'output', `agent2-${BRANCH_BASICS_ID}.json`)
const packet = JSON.parse(readFileSync(path, 'utf8'))
const { evidence, inputs } = packet

const whyThisScore = buildWhyThisScoreOptions(evidence, inputs)
const certs = whyThisScore.certifications_options.filter((o) => o !== 'None')

console.log('Certifications & testing:', certs.join(', '))

let failed = false

if (certs.includes('Leaping Bunny')) {
  console.error('✗ Leaping Bunny must not appear (pac_relevant=false)')
  failed = true
}

for (const required of ['EWG Verified', 'MADE SAFE']) {
  if (!certs.includes(required)) {
    console.error(`✗ Missing required PAC cert: ${required}`)
    failed = true
  }
}

if (certs.length !== 2) {
  console.error(`✗ Expected exactly EWG Verified and MADE SAFE, got: ${certs.join('; ')}`)
  failed = true
}

if (failed) {
  console.error('\nBranch Basics certifications Why This Score test FAILED')
  process.exit(1)
}

console.log('\nBranch Basics certifications Why This Score test PASSED')
process.exit(0)
