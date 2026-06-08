#!/usr/bin/env node
/**
 * Regression — Agent 2 output contract governs product-description generation and validation.
 * Cosmetic copy failures must not block normalization.
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { projectRoot } from '../lib/env.mjs'
import {
  AGENT2_OUTPUT_CONTRACT,
  cosmeticProductDescriptionWarningMessage,
  getProductDescriptionWordLimits,
  isProductDescriptionScoreBlocking,
  scoreBlockingNormalizationFailureMessage,
  validateProductDescriptionWordCount,
} from '../../src/shared/agent2/output-contract.mjs'
import { runAgent2NormalizationPipeline } from './deterministic/pipeline.mjs'
import { runProductDescriptionStep, PRODUCT_DESCRIPTION_GENERATOR_VERSION } from './deterministic/product-description-generate.mjs'
import { buildWhyThisScoreOptions } from './why-this-score-map.mjs'

const ALL_CLAD_ID = 'c645ae86-0b82-429d-8f46-78b8007041b5'

let failed = false

function assert(cond, msg) {
  if (!cond) {
    console.error(`✗ ${msg}`)
    failed = true
  } else {
    console.log(`✓ ${msg}`)
  }
}

function assertNoFixEvidenceMessage(text) {
  assert(!/fix evidence/i.test(String(text)), `message must not say "fix evidence": ${text}`)
}

// --- Contract is single source of truth ---
const limits = getProductDescriptionWordLimits()
assert(
  limits.min_words === AGENT2_OUTPUT_CONTRACT.product_description.min_words,
  'getProductDescriptionWordLimits min matches contract',
)
assert(
  limits.max_words === AGENT2_OUTPUT_CONTRACT.product_description.max_words,
  'getProductDescriptionWordLimits max matches contract',
)
assert(isProductDescriptionScoreBlocking() === false, 'product_description is non-score-blocking')

const validation = validateProductDescriptionWordCount(40)
assert(validation.min_words === limits.min_words, 'validator reads min_words from contract')
assert(validation.max_words === limits.max_words, 'validator reads max_words from contract')
assert(validation.withinRange === false, '40 words is outside contract range')

// --- Warning copy must not blame Gate 1 evidence ---
const warningMsg = cosmeticProductDescriptionWarningMessage(['word_count_out_of_range:40'])
assertNoFixEvidenceMessage(warningMsg)
assert(/non-score metadata/i.test(warningMsg), 'warning explains non-score metadata')
assert(/scoring inputs were still produced/i.test(warningMsg), 'warning confirms scoring inputs produced')

const taxonomyMsg = scoreBlockingNormalizationFailureMessage('taxonomy_expansion_required', [
  'unknown_material_x',
])
assertNoFixEvidenceMessage(taxonomyMsg)
assert(/material taxonomy/i.test(taxonomyMsg), 'score-blocking message names taxonomy issue')

// --- Generator uses contract limits (inspect source, not duplicate constants) ---
const genSource = readFileSync(
  join(projectRoot, 'scripts/agent2/deterministic/product-description-generate.mjs'),
  'utf8',
)
assert(
  genSource.includes('output-contract.mjs'),
  'generator imports shared output contract',
)
assert(
  !genSource.includes('wordCount < 50') && !genSource.includes('wordCount > 100'),
  'generator has no hardcoded 50/100 word limits',
)

// --- Pipeline produces scoring inputs despite cosmetic copy issues ---
function loadPacket(productId) {
  const path = join(projectRoot, 'scripts', 'output', `agent2-${productId}.json`)
  if (!existsSync(path)) return null
  return JSON.parse(readFileSync(path, 'utf8'))
}

const packet = loadPacket(ALL_CLAD_ID)
if (packet?.evidence && packet?.product) {
  const { inputs, whyThisScore } = runAgent2NormalizationPipeline(
    packet.product,
    packet.evidence,
  )
  assert(Array.isArray(inputs.components) && inputs.components.length > 0, 'pipeline emits components')
  assert(inputs.layer_4a != null, 'pipeline emits layer_4a')
  assert(inputs.layer_4b != null, 'pipeline emits layer_4b')
  assert(inputs.status !== 'description_generation_failed', 'pipeline does not block on description')
  assert(
    inputs.product_description_status === 'generated' || inputs.product_description_status === 'warning',
    'pipeline sets product_description_status',
  )

  const desc = runProductDescriptionStep({
    product: packet.product,
    evidence: packet.evidence,
    inputs,
    whyThisScore: whyThisScore ?? buildWhyThisScoreOptions(packet.evidence, inputs),
  })
  assert(desc.description_generator_version === PRODUCT_DESCRIPTION_GENERATOR_VERSION, 'generator version stamped')
  if (desc.product_description) {
    const wc = desc.description_word_count
    const v = validateProductDescriptionWordCount(wc)
    if (desc.product_description_status === 'generated') {
      assert(v.withinRange, `generated description ${wc} words is within contract range`)
    } else {
      assert(!v.withinRange || desc.flagged_missing_fields?.length, 'warning status when out of range or missing inputs')
      assertNoFixEvidenceMessage(desc.product_description_warnings?.[0] ?? '')
    }
  }
} else {
  console.log('(skip All-Clad pipeline fixture — no scripts/output/agent2-<id>.json; run Agent 2 to populate)')
}

// --- Simulated short-copy path still non-blocking ---
const mockDesc = runProductDescriptionStep({
  product: { brand: 'TestBrand', product_name: 'Mock Pan' },
  evidence: {},
  inputs: {
    components: [
      {
        component_role: 'primary_food_contact',
        material_id: 'stainless_steel_unspecified',
        material_hazard: 0.05,
      },
    ],
    layer_4b: { transparency_badge: 'Fully Disclosed' },
    layer_4a: { negative_adjustments: [] },
  },
  whyThisScore: {
    primary_material_options: ['Stainless steel (unspecified grade)'],
    use_conditions_options: ['Oven heat', 'Stovetop heat', 'Fat exposure'],
  },
})

assert(mockDesc.product_description != null, 'mock inert product produces description text')
assert(
  mockDesc.product_description_status === 'generated' || mockDesc.product_description_status === 'warning',
  'mock description returns cosmetic status not blocking failure',
)
assertNoFixEvidenceMessage(mockDesc.product_description_warnings?.[0] ?? warningMsg)

if (failed) {
  console.error('\nOutput contract product-description tests FAILED')
  process.exit(1)
}
console.log('\nOutput contract product-description tests PASSED')
