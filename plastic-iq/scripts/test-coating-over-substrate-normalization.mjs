#!/usr/bin/env node
/**
 * Coating-over-substrate Agent 2 component handoff — Caraway / T-Fal / HexClad regressions.
 * Run: npm run test:coating-over-substrate-normalization
 */
import assert from 'node:assert/strict'
import { applyCanonicalMappings } from '../src/shared/canonical-taxonomy/map-structured-evidence.mjs'
import { extractComponents } from './agent2/deterministic/component-extract.mjs'
import { runAgent2NormalizationPipeline } from './agent2/deterministic/pipeline.mjs'
import { buildGate1ApprovalEligibilityHexCladV7Sources, buildGate1ApprovalEligibilityHexCladV7Structured } from '../src/shared/agent1/fixtures/gate1ApprovalEligibilityHexCladV7.fixture.mjs'

// --- Caraway ceramic over aluminum ---
const carawayStructured = {
  product_identity: { subcategory: 'cookware', brand: 'Caraway', product_name: 'Nonstick Ceramic Frying Pan' },
  primary_contact_material: {
    material_identity: 'sol_gel_ceramic_coating_on_aluminum_core',
    source_url: 'https://www.amazon.com/dp/B09SS34H3K',
    confidence_label: 'third_party_review_citing_manufacturer',
  },
  coatings_and_finishes: [
    {
      coating_name: 'Sol-Gel Ceramic Nonstick Coating',
      coating_type: 'sol_gel_ceramic_nonstick_coating',
      composition_disclosed: false,
      source_url: 'https://www.amazon.com/dp/B09SS34H3K',
    },
  ],
  secondary_components: [
    { component_role: 'handle', material_identity: 'stainless_steel', source_url: 'https://www.amazon.com/dp/B09SS34H3K' },
    { component_role: 'body', material_identity: 'stainless_steel', source_url: 'https://www.amazon.com/dp/B09SS34H3K' },
  ],
  safety_claims: {},
  retailer_links: { amazon_url: 'https://www.amazon.com/dp/B09SS34H3K' },
  product_use_case: 'cookware',
}
const carawaySources = [
  {
    url: 'https://www.amazon.com/dp/B09SS34H3K',
    title: 'Amazon',
    page_excerpt: 'Ceramic nonstick sol-gel on aluminum core.',
    source_type: 'amazon',
  },
]
applyCanonicalMappings(carawayStructured, carawaySources)
const carawayEvidence = {
  evidence_id: 'caraway-fixture',
  agent_metadata: { structured_evidence: carawayStructured },
  sources: carawaySources,
  facts: [],
}
const carawayProduct = { product_id: 'caraway', product_name: 'Caraway Pan', brand: 'Caraway', subcategory: 'cookware' }
const caraway = extractComponents(carawayEvidence, carawayProduct)
assert.ok(caraway.components.some((c) => c.role === 'primary_food_contact' && /ceramic/i.test(c.material_id + c.component_name)))
assert.ok(caraway.components.some((c) => c.role === 'structural' && c.material_id === 'aluminum_core'))
console.log('✓ Caraway ceramic-over-aluminum structure preserved')

// --- T-Fal PTFE over hard anodized ---
const tfalStructured = {
  product_identity: { subcategory: 'Cookware', brand: 'T-Fal', product_name: 'PTFE Fry Pan' },
  primary_contact_material: {
    material_identity: 'ptfe_nonstick_on_hard_anodized_aluminum',
    source_url: 'https://example.com/tfal',
    confidence_label: 'manufacturer_confirmed',
  },
  coatings_and_finishes: [{ coating_name: 'PTFE nonstick', coating_type: 'ptfe', source_url: 'https://example.com/tfal' }],
  secondary_components: [{ component_role: 'handle', material_identity: 'stay_cool_handle', source_url: 'https://example.com/tfal' }],
  safety_claims: { pfoa_free_claim: { claimed: true, source_url: 'https://example.com/tfal' } },
  retailer_links: { amazon_url: 'https://example.com/tfal' },
  product_use_case: 'Stovetop frying',
}
applyCanonicalMappings(tfalStructured, [{ url: 'https://example.com/tfal', page_excerpt: 'PTFE nonstick over hard anodized aluminum', source_type: 'manufacturer' }])
const tfalEvidence = {
  evidence_id: 'tfal-fixture',
  agent_metadata: { structured_evidence: tfalStructured },
  sources: [{ url: 'https://example.com/tfal', page_excerpt: 'PTFE nonstick over hard anodized aluminum', source_type: 'manufacturer' }],
  facts: [],
}
const tfal = extractComponents(tfalEvidence, { product_id: 'tfal', product_name: 'T-Fal', subcategory: 'Cookware' })
const tfalPrimary = tfal.components.find((c) => c.role === 'primary_food_contact')
assert.ok(tfalPrimary && /ptfe/i.test(tfalPrimary.material_id))
assert.ok(tfal.components.some((c) => c.material_id === 'hard_anodized_aluminum' && c.role === 'structural'))
console.log('✓ T-Fal PTFE-over-aluminum split preserved')

// --- HexClad hybrid ---
const hexStructured = buildGate1ApprovalEligibilityHexCladV7Structured()
const hexSources = buildGate1ApprovalEligibilityHexCladV7Sources()
const hexEvidence = {
  evidence_id: 'hex-fixture',
  agent_metadata: { structured_evidence: hexStructured },
  sources: hexSources,
  facts: [],
}
const hex = runAgent2NormalizationPipeline(
  { product_id: 'hex', product_name: 'HexClad', brand: 'HexClad', subcategory: 'Cookware' },
  hexEvidence,
)
assert.ok(
  hex.inputs.components.some((c) => /hybrid|terrabond|stainless/i.test(`${c.component_name} ${c.material_id}`)),
)
assert.ok(hex.inputs.testing_evidence?.testing_evidence_present, 'HexClad lab evidence must remain')
console.log('✓ HexClad hybrid split + lab evidence preserved')

console.log('\nCoating-over-substrate normalization tests passed.')
