#!/usr/bin/env node
/**
 * HexClad Why This Score category exclusivity — no Agent 1/2 re-run.
 * Uses approved evidence + scoring_inputs from scripts/output/agent2-{id}.json.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { projectRoot } from '../lib/env.mjs'
import { buildWhyThisScoreOptions } from './why-this-score-map.mjs'
import { VOCABULARY } from './why-this-score-vocabulary.mjs'

const HEXCLAD_ID = 'fd05c5fb-19c2-4bc0-9882-ce73a7644ef5'

function assertExclusiveAcrossFields(whyThisScore) {
  const fields = [
    'primary_material_options',
    'secondary_materials_options',
    'coatings_finishes_options',
    'use_conditions_options',
    'disclosure_quality_options',
    'certifications_options',
  ]
  const seen = new Map()
  for (const field of fields) {
    for (const opt of whyThisScore[field] ?? []) {
      if (opt === 'None') continue
      if (seen.has(opt)) {
        throw new Error(
          `Option "${opt}" appears in both ${seen.get(opt)} and ${field}`,
        )
      }
      seen.set(opt, field)
    }
  }
}

const path = join(projectRoot, 'scripts', 'output', `agent2-${HEXCLAD_ID}.json`)
const packet = JSON.parse(readFileSync(path, 'utf8'))
const { evidence, inputs } = packet

if (!inputs?.components?.some((c) => /peaks/i.test(c.component_name ?? ''))) {
  console.error('✗ Packet inputs missing peaks component — refresh agent2 output or run pipeline locally')
  process.exit(1)
}

const whyThisScore = buildWhyThisScoreOptions(evidence, inputs)

const laser = 'Laser-etched stainless steel surface'
const primary = whyThisScore.primary_material_options.filter((o) => o !== 'None')
const coatings = whyThisScore.coatings_finishes_options.filter((o) => o !== 'None')

console.log('Primary material:', primary.join(', '))
console.log('Coatings & finishes:', coatings.join(', '))

let failed = false

const hexCeramic = 'Proprietary ceramic coating (undisclosed)'
if (primary.includes(hexCeramic) && primary.includes(laser)) {
  if (primary.indexOf(hexCeramic) >= primary.indexOf(laser)) {
    console.error(
      `✗ Primary material hazard order: "${hexCeramic}" must appear before "${laser}"`,
    )
    failed = true
  } else {
    console.log(`✓ Primary material hazard order: ceramic before laser-etched`)
  }
}

try {
  assertExclusiveAcrossFields(whyThisScore)
  console.log('✓ Each vocabulary option appears in at most one field')
} catch (err) {
  console.error(`✗ ${err.message}`)
  failed = true
}

if (!primary.includes(laser)) {
  console.error(`✗ Primary material must include "${laser}"`)
  failed = true
} else {
  console.log(`✓ "${laser}" in Primary material only`)
}

if (coatings.includes(laser)) {
  console.error(`✗ "${laser}" must not appear in Coatings & finishes`)
  failed = true
}

const terrabondCoating = 'Proprietary ceramic nonstick (undisclosed)'
if (!coatings.includes(terrabondCoating)) {
  console.error(`✗ Coatings & finishes must include "${terrabondCoating}" (TerraBond)`)
  failed = true
} else {
  console.log(`✓ Coatings & finishes: ${terrabondCoating}`)
}

if (coatings.length !== 1) {
  console.error(`✗ Coatings & finishes must list only TerraBond ceramic, got: ${coatings.join('; ')}`)
  failed = true
}

// Vocabulary lists must not duplicate laser across primary vs coatings vocab keys
const inPrimaryVocab = VOCABULARY.primary_material.includes(laser)
const inCoatingsVocab = VOCABULARY.coatings_finishes.includes(laser)
if (!inPrimaryVocab || inCoatingsVocab) {
  console.error('✗ Vocabulary: laser must be in primary_material only, not coatings_finishes')
  failed = true
}

if (failed) {
  console.error('\nHexClad Why This Score test FAILED')
  process.exit(1)
}

console.log('\nHexClad Why This Score test PASSED')
process.exit(0)
