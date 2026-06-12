#!/usr/bin/env node
/**
 * Canonical rule precedence — ceramic/Thermolon must win over hybrid when third-party TerraBond context appears.
 * Run: npm run test:canonical-rule-precedence
 */
import assert from 'node:assert/strict'
import { applyCanonicalMappings } from '../src/shared/canonical-taxonomy/map-structured-evidence.mjs'
import { detectHybridCookwareEvidenceSignals } from '../src/shared/canonical-taxonomy/hybrid-cookware-structural.mjs'
import { detectPatternTriggers } from '../src/shared/required-evidence-matrix/pattern-triggers.mjs'
import {
  buildGreenPanV3SourcesWithTerrabondContext,
  buildGreenPanV3StructuredEvidence,
} from '../src/shared/canonical-taxonomy/fixtures/greenpanV3Precedence.fixture.mjs'
import { buildHybridNonstickCookwareStructuredEvidence } from '../src/shared/canonical-taxonomy/fixtures/hybridNonstickCookware.fixture.mjs'

const structured = buildGreenPanV3StructuredEvidence()
const sources = buildGreenPanV3SourcesWithTerrabondContext()

assert.equal(
  detectHybridCookwareEvidenceSignals(structured, sources),
  false,
  'third-party TerraBond mention must not trigger hybrid for ceramic pan',
)
console.log('✓ third-party TerraBond context does not trigger hybrid signals')

const mappings = applyCanonicalMappings(structured, sources)
const triggers = detectPatternTriggers(structured, mappings, sources)

assert.equal(mappings.primary_contact_material_id?.canonical_id, 'ceramic_nonstick_sol_gel_coating')
assert.ok(
  /cookware_ceramic_nonstick/.test(mappings.primary_contact_material_id?.mapping_rule_id ?? ''),
  `expected ceramic mapping rule, got ${mappings.primary_contact_material_id?.mapping_rule_id}`,
)
assert.equal(mappings.substrate_material_id?.canonical_id, 'hard_anodized_aluminum')
assert.equal(mappings.coating_modifier_id?.canonical_id, 'proprietary_nonstick_coating_undisclosed')
assert.notEqual(mappings.primary_contact_material_id?.canonical_id, 'hybrid_stainless_nonstick_food_contact')
assert.notEqual(mappings.substrate_material_id?.canonical_id, 'stainless_steel_body')
assert.equal(triggers.has('ceramic_nonstick_coating'), true)
console.log('✓ ceramic_nonstick_coating pattern wins final food-contact canonical')

const phraseCases = [
  {
    name: 'Thermolon Minerals Pro',
    structured: {
      product_identity: { subcategory: 'cookware' },
      primary_contact_material: { material_identity: 'hard_anodized_aluminum' },
      coatings_and_finishes: [{ coating_name: 'Thermolon Minerals Pro', coating_type: 'ceramic_nonstick_unverified' }],
      secondary_components: [{ component_role: 'base', material_identity: 'magneto_magnetic_stainless_base' }],
    },
    sources: [{ source_type: 'retailer', url: 'https://example.com/pan', page_excerpt: 'stainless steel bonded base Magneto induction base' }],
  },
  {
    name: 'Thermolon Advanced diamond-infused',
    structured: {
      product_identity: { subcategory: 'cookware', product_name: 'Ceramic fry pan 10 inch' },
      primary_contact_material: { material_identity: 'hard_anodized_aluminum' },
      coatings_and_finishes: [
        {
          coating_name: 'Thermolon Advanced diamond-infused ceramic nonstick',
          coating_type: 'ceramic_nonstick_unverified',
        },
      ],
      secondary_components: [{ component_role: 'handle', material_identity: 'stainless_steel' }],
    },
    sources: [{ source_type: 'manufacturer', url: 'https://example.com/products/pan', page_excerpt: 'Hard Anodized PFAS-Free Cookware' }],
  },
  {
    name: 'stainless bonded base only',
    structured: {
      product_identity: { subcategory: 'cookware' },
      primary_contact_material: { material_identity: 'hard_anodized_aluminum' },
      coatings_and_finishes: [{ coating_name: 'ceramic nonstick coating', coating_type: 'ceramic_nonstick_unverified' }],
      secondary_components: [{ component_role: 'base', material_identity: 'stainless_steel_bonded_base' }],
    },
    sources: [{ source_type: 'retailer', url: 'https://example.com/pan', page_excerpt: 'stainless steel bonded base induction compatible' }],
  },
]

for (const c of phraseCases) {
  const m = applyCanonicalMappings(c.structured, c.sources)
  assert.equal(
    m.primary_contact_material_id?.canonical_id,
    'ceramic_nonstick_sol_gel_coating',
    `${c.name} must map ceramic food-contact`,
  )
  assert.notEqual(
    m.primary_contact_material_id?.canonical_id,
    'hybrid_stainless_nonstick_food_contact',
    `${c.name} must not map hybrid`,
  )
  assert.equal(m.substrate_material_id?.canonical_id, 'hard_anodized_aluminum', `${c.name} body`)
}
console.log('✓ Thermolon / bonded base / Magneto phrases do not create hybrid food-contact')

const hybridFixture = buildHybridNonstickCookwareStructuredEvidence()
const hybridMapped = applyCanonicalMappings(hybridFixture, [
  {
    source_type: 'manufacturer_site',
    url: 'https://example.com/hybrid-pan',
    page_excerpt: 'Laser-etched stainless hybrid with TerraBond proprietary ceramic nonstick valleys',
  },
])
assert.equal(hybridMapped.primary_contact_material_id?.canonical_id, 'hybrid_stainless_nonstick_food_contact')
assert.equal(hybridMapped.substrate_material_id?.canonical_id, 'stainless_steel_body')
console.log('✓ HexClad-style TerraBond + laser-etched geometry still maps hybrid')

console.log('\nCanonical rule precedence tests passed.')
