#!/usr/bin/env node
/**
 * Compound parser — ceramic nonstick over hard-anodized aluminum (+ induction base).
 * Run: npm run test:ceramic-over-aluminum-compound-parser
 */
import assert from 'node:assert/strict'
import { parseCompoundCookwareMaterial } from '../src/shared/canonical-taxonomy/compound-cookware-material.mjs'
import { applyCanonicalMappings } from '../src/shared/canonical-taxonomy/map-structured-evidence.mjs'
import { assertCookwareMaterialsResolved } from './agent1/assert-canonical-materials.mjs'
import { CERAMIC_OVER_ALUMINUM_COMPOUND_RAW } from '../src/shared/canonical-taxonomy/fixtures/ceramicOverHardAnodized.fixture.mjs'

const compound = parseCompoundCookwareMaterial(CERAMIC_OVER_ALUMINUM_COMPOUND_RAW)
assert.equal(compound.isCompound, true)
assert.equal(compound.primaryContactCanonicalId, 'ceramic_nonstick_sol_gel_coating')
assert.equal(compound.substrateCanonicalId, 'hard_anodized_aluminum')
assert.ok(
  compound.secondaryCoreMaterialIds.includes('stainless_steel_body'),
  'stainless induction base should be secondary, not primary food-contact',
)
console.log('✓ compound parser extracts ceramic primary + hard-anodized substrate')

const structured = {
  product_identity: { subcategory: 'cookware', product_name: 'Ceramic compound fixture pan 10 inch' },
  primary_contact_material: {
    material_identity: CERAMIC_OVER_ALUMINUM_COMPOUND_RAW,
    confidence_label: 'manufacturer_confirmed',
  },
  coatings_and_finishes: [],
}
const mappings = applyCanonicalMappings(structured, [])
assert.equal(mappings.primary_contact_material_id?.canonical_id, 'ceramic_nonstick_sol_gel_coating')
assert.equal(mappings.substrate_material_id?.canonical_id, 'hard_anodized_aluminum')
assert.notEqual(mappings.primary_contact_material_id?.canonical_id, 'hybrid_stainless_nonstick_food_contact')
assert.doesNotThrow(() => assertCookwareMaterialsResolved(structured, { product_name: 'compound fixture' }))
console.log('✓ applyCanonicalMappings uses compound path for ceramic-over-aluminum string')

const handleOnly = {
  product_identity: { subcategory: 'cookware' },
  primary_contact_material: { material_identity: 'hard_anodized_aluminum' },
  coatings_and_finishes: [
    { coating_name: 'Thermolon ceramic nonstick', coating_type: 'ceramic_nonstick_unverified' },
  ],
  secondary_components: [{ component_role: 'handle', material_identity: 'stainless_steel' }],
}
const handleMapped = applyCanonicalMappings(handleOnly, [
  { source_type: 'retailer', url: 'https://example.com/pan', page_excerpt: 'stainless steel handle' },
])
assert.equal(handleMapped.substrate_material_id?.canonical_id, 'hard_anodized_aluminum')
assert.notEqual(handleMapped.substrate_material_id?.canonical_id, 'stainless_steel_body')
console.log('✓ stainless handle does not map body to stainless_steel_body')

console.log('\nCeramic-over-aluminum compound parser tests passed.')
