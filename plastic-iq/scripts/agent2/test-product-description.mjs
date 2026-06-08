#!/usr/bin/env node
/**
 * Product description — material order + acronym casing (no Agent 1/2 re-run).
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { projectRoot } from '../lib/env.mjs'
import { buildWhyThisScoreOptions } from './why-this-score-map.mjs'
import { runProductDescriptionStep } from './deterministic/product-description-generate.mjs'
import {
  formatDescriptionText,
  formatDescriptionPhrase,
} from './deterministic/description-text.mjs'
import { PRODUCT_DESCRIPTION_GENERATOR_VERSION } from './deterministic/product-description-generate.mjs'

const HEXCLAD_ID = 'fd05c5fb-19c2-4bc0-9882-ce73a7644ef5'
const TFAL_ID = '7a457a86-ab62-4cbf-90b9-ccaeafe06896'

function loadPacket(productId) {
  const path = join(projectRoot, 'scripts', 'output', `agent2-${productId}.json`)
  if (!existsSync(path)) {
    console.error(`Missing ${path} — run Agent 2 locally or patch from DB`)
    process.exit(1)
  }
  return JSON.parse(readFileSync(path, 'utf8'))
}

let failed = false

function assert(cond, msg) {
  if (!cond) {
    console.error(`✗ ${msg}`)
    failed = true
  } else {
    console.log(`✓ ${msg}`)
  }
}

assert(formatDescriptionText('PTFE coating') === 'PTFE coating', 'PTFE casing preserved')
assert(
  formatDescriptionPhrase('ptfe nonstick coating') === 'PTFE nonstick coating',
  'ptfe phrase casing',
)
assert(
  formatDescriptionPhrase('ptfe coating as its food-contact surface').startsWith('PTFE coating'),
  'ptfe in phrase casing',
)

const hexPacket = loadPacket(HEXCLAD_ID)
const hexWhy = buildWhyThisScoreOptions(hexPacket.evidence, hexPacket.inputs)
const hexPrimary = hexWhy.primary_material_options.filter((o) => o !== 'None')
const hexCeramic = 'Proprietary ceramic coating (undisclosed)'
const hexLaser = 'Laser-etched stainless steel surface'
if (hexPrimary.includes(hexCeramic) && hexPrimary.includes(hexLaser)) {
  assert(
    hexPrimary.indexOf(hexCeramic) < hexPrimary.indexOf(hexLaser),
    'HexClad Why This Score primary: ceramic before laser-etched',
  )
}
const hexDesc = runProductDescriptionStep({
  product: { brand: 'HexClad', product_name: 'HexClad Hybrid' },
  evidence: hexPacket.evidence,
  inputs: hexPacket.inputs,
  whyThisScore: hexWhy,
})

assert(
  hexDesc.description_generator_version === PRODUCT_DESCRIPTION_GENERATOR_VERSION,
  'generator version stamped',
)

if (hexDesc.product_description_status !== 'generated') {
  console.error('✗ HexClad description generation warning:', hexDesc.flagged_missing_fields)
  failed = true
} else {
  const s1 = hexDesc.product_description.split('.')[0] + '.'
  console.log('\nHexClad sentence 1:', s1)
  assert(
    /proprietary ceramic coating \(undisclosed\)/i.test(s1) &&
      s1.indexOf('proprietary') < s1.indexOf('laser-etched'),
    'HexClad: higher-hazard ceramic before laser-etched (with clause)',
  )
}

const tfalPacket = loadPacket(TFAL_ID)
const tfalWhy = buildWhyThisScoreOptions(tfalPacket.evidence, tfalPacket.inputs)
const tfalDesc = runProductDescriptionStep({
  product: { brand: 'T-Fal', product_name: 'T-Fal Ultimate' },
  evidence: tfalPacket.evidence,
  inputs: tfalPacket.inputs,
  whyThisScore: tfalWhy,
})

if (tfalDesc.product_description_status !== 'generated') {
  console.error('✗ T-Fal description generation warning:', tfalDesc.flagged_missing_fields)
  failed = true
} else {
  console.log('\nT-Fal description:', tfalDesc.product_description.slice(0, 120) + '…')
  assert(/PTFE/i.test(tfalDesc.product_description), 'T-Fal description contains PTFE (not ptfe)')
  assert(!/\bptfe\b/.test(tfalDesc.product_description), 'T-Fal description has no lowercase ptfe')
}

if (failed) {
  console.error('\nProduct description tests FAILED')
  process.exit(1)
}
console.log('\nProduct description tests PASSED')
