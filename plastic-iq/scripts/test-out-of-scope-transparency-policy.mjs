#!/usr/bin/env node
import assert from 'node:assert/strict'
import { applyCanonicalMappings } from '../src/shared/canonical-taxonomy/map-structured-evidence.mjs'
import {
  applyOutOfScopeSafetySignalPolicy,
  isOutOfScopeSafetySignalText,
} from '../src/shared/safety-signals/out-of-scope-policy.mjs'
import { assessTransparency } from '../src/shared/canonical-taxonomy/transparency-assessment.mjs'
import { getCanonicalApprovalBlockers } from '../src/shared/canonical-taxonomy/score-driving-fields.mjs'

assert.ok(isOutOfScopeSafetySignalText('Prop 65 disclosure on Target listing flags Iron, Chromium'))

const structured = {
  product_identity: { subcategory: 'cookware' },
  primary_contact_material: {
    material_identity: 'sol_gel_ceramic_coating_on_aluminum_core',
    source_url: 'https://www.thenewknew.com/kitchen/ceramic-cookware/',
    confidence_label: 'manufacturer_confirmed',
  },
  coatings_and_finishes: [
    {
      coating_name: 'Sol-Gel Ceramic Nonstick Coating',
      coating_type: 'sol_gel_ceramic_nonstick_coating',
      composition_disclosed: false,
      source_url: 'https://www.thenewknew.com/kitchen/ceramic-cookware/',
    },
  ],
  secondary_components: [],
  safety_claims: {},
  ingredient_list: { ingredients: [] },
  conflict_and_review: {
    class_action_history: false,
    class_action_sources: [],
    conflicting_evidence: [],
    requires_human_review: true,
  },
}

const sources = [
  {
    url: 'https://www.thenewknew.com/kitchen/ceramic-cookware/',
    title: 'The New Knew — Caraway review',
    page_excerpt: 'Ceramic nonstick on aluminum. PTFE free.',
    source_type: 'context',
    fetched_at: new Date().toISOString(),
  },
  {
    url: 'https://www.target.com/p/caraway',
    title: 'Target — Prop 65',
    page_excerpt: 'WARNING: Iron, Chromium, Manganese, Phosphorus — California Prop 65',
    source_type: 'retailer',
    fetched_at: new Date().toISOString(),
  },
]

const agent_metadata = {
  warnings: [
    'Prop 65 disclosure on Target listing flags Iron, Chromium, Manganese, Phosphorus',
    'Lead Safe Mama heavy-metal allegations noted in research',
  ],
}

const mappings = applyCanonicalMappings(structured, sources, { facts: [], agent_metadata })
const blockers = getCanonicalApprovalBlockers(mappings, { subcategory: 'cookware' })

assert.equal(structured.conflict_and_review.requires_human_review, false)
assert.ok((structured.out_of_scope_safety_signals ?? []).length >= 1)
assert.equal(agent_metadata.warnings.length, 0)
assert.equal(
  mappings.primary_contact_material_id?.confidence_label,
  'third_party_review_citing_manufacturer',
)
assert.notEqual(structured.transparency_assessment?.transparency_badge, 'Fully Disclosed')
assert.equal(structured.transparency_assessment?.fully_disclosed_eligible, false)
assert.equal(blockers.length, 0)

console.log('✓ out-of-scope + transparency + third-party confidence')
console.log('  oos signals:', structured.out_of_scope_safety_signals?.length)
console.log('  transparency:', structured.transparency_assessment?.transparency_badge)
console.log('  primary confidence:', mappings.primary_contact_material_id?.confidence_label)
