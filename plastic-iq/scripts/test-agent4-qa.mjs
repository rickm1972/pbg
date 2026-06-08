#!/usr/bin/env node
/**
 * Agent 4 QA — score sanity peer threshold + explanation vocabulary (no literal None in primary).
 */
import assert from 'node:assert/strict'
import { applyCanonicalMappings } from '../src/shared/canonical-taxonomy/map-structured-evidence.mjs'
import { buildWhyThisScoreOptions } from './agent2/why-this-score-map.mjs'
import { runAgent2NormalizationPipeline } from './agent2/deterministic/pipeline.mjs'
import { runExplanationAccuracy } from './agent4/checks/explanation-accuracy.mjs'
import { runScoreSanity, INSUFFICIENT_PEERS_MESSAGE } from './agent4/checks/score-sanity.mjs'
import { NONE } from './agent2/why-this-score-vocabulary.mjs'
import { SCORE_SANITY_MIN_PEERS } from './agent4/constants.mjs'

const structured = {
  product_identity: { subcategory: 'cookware', brand: 'Caraway', product_name: 'Nonstick Ceramic Frying Pan' },
  primary_contact_material: {
    material_identity: 'sol_gel_ceramic_coating_on_aluminum_core',
    source_url: 'https://example.com/review',
    confidence_label: 'third_party_review_citing_manufacturer',
  },
  coatings_and_finishes: [
    {
      coating_name: 'Sol-Gel Ceramic',
      coating_type: 'sol_gel_ceramic_nonstick_coating',
      composition_disclosed: false,
      source_url: 'https://example.com/review',
    },
  ],
  secondary_components: [
    { component_role: 'handle', material_identity: 'stainless_steel', source_url: 'https://example.com/amazon' },
  ],
  safety_claims: {},
  ingredient_list: { ingredients: [] },
  conflict_and_review: { class_action_history: false, conflicting_evidence: [], requires_human_review: false },
  retailer_links: { amazon_url: 'https://example.com/amazon' },
  product_use_case: 'cookware',
}

const sources = [
  {
    url: 'https://example.com/review',
    title: 'Review',
    page_excerpt: 'Ceramic sol-gel on aluminum core.',
    source_type: 'context',
    fetched_at: new Date().toISOString(),
  },
]

applyCanonicalMappings(structured, sources, { facts: [], agent_metadata: { warnings: [] } })

const evidence = {
  evidence_id: 'test-evidence',
  agent_metadata: { structured_evidence: structured, certifications_verified: [] },
  facts: [],
  sources,
}

const product = { product_id: 'test-caraway', product_name: 'Caraway Pan', brand: 'Caraway', subcategory: 'cookware' }
const { inputs, whyThisScore } = runAgent2NormalizationPipeline(product, evidence)

assert.ok(!whyThisScore.primary_material_options.includes(NONE), 'primary must not contain None')
assert.ok(
  whyThisScore.primary_material_options.some((o) => /ceramic nonstick sol-gel/i.test(o)),
  `expected ceramic primary label: ${whyThisScore.primary_material_options.join('; ')}`,
)

const scoringInput = {
  ...whyThisScore,
  inputs,
  review_status: 'approved',
}

const explanation = runExplanationAccuracy({ component_nprs: {} }, inputs, scoringInput, evidence)
assert.equal(explanation.status, 'pass', `explanation accuracy: ${explanation.issues?.join(', ')}`)

const lodge = {
  product: { product_id: 'lodge', product_name: 'Lodge Cast Iron', subcategory: 'cookware' },
  score: { score_id: 's1', pac_safety_score: 92, review_status: 'approved', component_nprs: { components: [] } },
  inputs: { components: [{ component_name: 'Cast iron', role: 'primary_food_contact', material: 'cast iron', final_npr: 0.1, contact_intimacy: 0.95 }] },
}
const tfal = {
  product: { product_id: 'tfal', product_name: 'T-Fal PTFE', subcategory: 'cookware' },
  score: { score_id: 's2', pac_safety_score: 9, review_status: 'approved', component_nprs: { components: [] } },
  inputs: { components: [{ component_name: 'PTFE', role: 'primary_food_contact', material: 'ptfe', final_npr: 0.9, contact_intimacy: 0.95 }] },
}

const score = { pac_safety_score: 66, component_nprs: { components: inputs.components } }
const sanity = runScoreSanity({
  product,
  inputs,
  score,
  peerScores: [lodge, tfal],
  scoringInput,
})

assert.equal(sanity.status, 'not_applicable', `expected not_applicable, got ${sanity.status}`)
assert.equal(sanity.peer_count, 2)
assert.ok(sanity.message?.includes('Insufficient'), sanity.message)
assert.equal(sanity.flags.length, 0)
assert.ok(SCORE_SANITY_MIN_PEERS >= 5)

console.log('✓ Agent 4 QA structural checks')
console.log('  primary:', whyThisScore.primary_material_options.join(', '))
console.log('  score_sanity:', sanity.status, `(${sanity.peer_count} peers, min ${SCORE_SANITY_MIN_PEERS})`)
console.log('  explanation:', explanation.status)
