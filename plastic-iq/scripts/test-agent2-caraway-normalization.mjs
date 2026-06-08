#!/usr/bin/env node
/**
 * Caraway-style Agent 2 — coatings line, no tri-ply inference, secondary body guard.
 */
import assert from 'node:assert/strict'
import { applyCanonicalMappings } from '../src/shared/canonical-taxonomy/map-structured-evidence.mjs'
import { buildWhyThisScoreOptions } from './agent2/why-this-score-map.mjs'
import { extractComponents } from './agent2/deterministic/component-extract.mjs'
import { runAgent2NormalizationPipeline } from './agent2/deterministic/pipeline.mjs'
import { NONE } from './agent2/why-this-score-vocabulary.mjs'

const structured = {
  product_identity: { subcategory: 'cookware', brand: 'Caraway', product_name: 'Nonstick Ceramic Frying Pan' },
  primary_contact_material: {
    material_identity: 'sol_gel_ceramic_coating_on_aluminum_core',
    source_url: 'https://www.thenewknew.com/kitchen/ceramic-cookware/',
    confidence_label: 'third_party_review_citing_manufacturer',
  },
  coatings_and_finishes: [
    {
      coating_name: 'Sol-Gel Ceramic Nonstick Coating',
      coating_type: 'sol_gel_ceramic_nonstick_coating',
      composition_disclosed: false,
      source_url: 'https://www.thenewknew.com/kitchen/ceramic-cookware/',
    },
  ],
  secondary_components: [
    { component_role: 'handle', material_identity: 'stainless_steel', source_url: 'https://www.amazon.com/dp/B09SS34H3K' },
    { component_role: 'body', material_identity: 'stainless_steel', source_url: 'https://www.amazon.com/dp/B09SS34H3K' },
  ],
  safety_claims: {},
  ingredient_list: { ingredients: [] },
  conflict_and_review: {
    class_action_history: false,
    class_action_sources: [],
    conflicting_evidence: [],
    requires_human_review: false,
  },
  retailer_links: {
    amazon_url: 'https://www.amazon.com/dp/B09SS34H3K',
    manufacturer_direct_url: 'https://www.carawayhome.com/',
  },
  product_use_case: 'cookware',
}

const sources = [
  {
    url: 'https://www.thenewknew.com/kitchen/ceramic-cookware/',
    title: 'The New Knew',
    page_excerpt: 'Ceramic nonstick sol-gel on aluminum core.',
    source_type: 'context',
    fetched_at: new Date().toISOString(),
  },
  {
    url: 'https://www.amazon.com/dp/B09SS34H3K',
    title: 'Amazon',
    page_excerpt: 'Non Toxic, PTFE & PFOA Free. Aluminum core.',
    source_type: 'amazon',
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

const product = { product_id: 'test', product_name: 'Caraway Pan', brand: 'Caraway', subcategory: 'cookware' }
const { inputs, whyThisScore } = runAgent2NormalizationPipeline(product, evidence)

const coatings = whyThisScore.coatings_finishes_options.filter((o) => o !== NONE)
assert.ok(coatings.length > 0, 'coatings must not be None')
assert.ok(
  coatings.some((c) => /ceramic.*sol|sol.*gel|ceramic nonstick/i.test(c)),
  `expected ceramic coating label, got: ${coatings.join('; ')}`,
)

const names = inputs.components.map((c) => c.component_name).join(' | ')
assert.ok(!/tri-ply body/i.test(names), `tri-ply body name forbidden: ${names}`)
assert.ok(/aluminum core/i.test(names), `expected aluminum core body: ${names}`)

const bodyStainless = inputs.components.filter(
  (c) => c.role === 'structural' && /body.*stainless/i.test(c.component_name),
)
assert.equal(bodyStainless.length, 0, `unsupported Body stainless: ${bodyStainless.map((c) => c.component_name).join(', ')}`)

const desc = String(inputs.product_description ?? '')
assert.ok(!/can't quantify|cannot quantify/i.test(desc), `description must not say cannot quantify: ${desc}`)

const body = inputs.components.find((c) => c.material_id === 'aluminum_core' && c.role === 'structural')
assert.ok(body, 'expected aluminum core structural component')
assert.equal(body.exposure_duration, 0.3)
assert.ok(
  /secondary body component exposure duration — 0\.30/i.test(body.duration_justification ?? ''),
  `body duration justification must match 0.30, got: ${body.duration_justification}`,
)
assert.ok(
  !/15 min daily default — 0\.50/i.test(body.duration_justification ?? ''),
  'body must not use primary cookware 0.50 justification',
)

const secondary = whyThisScore.secondary_materials_options.filter((o) => o !== NONE)
assert.ok(secondary.includes('Aluminum core'), `missing Aluminum core: ${secondary.join('; ')}`)
assert.ok(
  secondary.some((o) => /stainless steel handle/i.test(o)),
  `missing handle in Why This Score secondary: ${secondary.join('; ')}`,
)

console.log('✓ Agent 2 Caraway normalization')
console.log('  coatings:', coatings.join(', '))
console.log('  transparency:', inputs.layer_4b?.transparency_badge)
console.log('  components:', inputs.components.length)
