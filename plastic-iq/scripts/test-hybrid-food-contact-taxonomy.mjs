#!/usr/bin/env node
/**
 * Hybrid food-contact taxonomy regression — HexClad pattern fixture (no product_id).
 * Run: npm run test:hybrid-food-contact-taxonomy
 */
import assert from 'node:assert/strict'
import {
  applyCanonicalMappings,
  resolvePrimaryContactEntry,
} from '../src/shared/canonical-taxonomy/map-structured-evidence.mjs'
import {
  detectHybridCookwareEvidenceSignals,
  getCoatingInertContradictionBlockers,
  inertMetalProtectionBlocked,
  isHybridFoodContactPrimary,
} from '../src/shared/canonical-taxonomy/hybrid-cookware-structural.mjs'
import { inertMetalProtectionBlocked as inertBlockedReexport } from '../src/shared/canonical-taxonomy/inert-cookware-structural.mjs'
import {
  buildHybridCollapsedToInertMappings,
  buildHybridNonstickCookwareStructuredEvidence,
} from '../src/shared/canonical-taxonomy/fixtures/hybridNonstickCookware.fixture.mjs'
import { getGate1ContradictionBlockers } from '../src/lib/gate1ContradictionBlockers.ts'
import { assertCookwareMaterialsResolved } from './agent1/assert-canonical-materials.mjs'
import {
  HYBRID_FOOD_CONTACT_PRIMARY_ENTRY,
  isHybridPrimaryContactRaw,
} from '../src/shared/canonical-taxonomy/canonical-taxonomy-fallbacks.mjs'
import { PRIMARY_CONTACT_MATERIAL_TAXONOMY } from '../src/shared/canonical-taxonomy/primary-contact-material-taxonomy.mjs'

const structured = buildHybridNonstickCookwareStructuredEvidence()
assert.ok(detectHybridCookwareEvidenceSignals(structured, []), 'fixture detects hybrid evidence signals')
console.log('✓ hybrid evidence signals detected on fixture')

const mappings = applyCanonicalMappings(structured, [
  {
    source_type: 'manufacturer_site',
    url: 'https://example.com/hybrid-pan-faq',
    title: 'Hybrid pan FAQ — TerraBond ceramic PFAS-free',
    page_excerpt: 'Laser-etched stainless hybrid with TerraBond proprietary ceramic nonstick valleys',
  },
])

const primaryId = mappings.primary_contact_material_id?.canonical_id
const coatingId = mappings.coating_modifier_id?.canonical_id
const pfasId = mappings.pfas_status_id?.canonical_id

assert.equal(primaryId, 'hybrid_stainless_nonstick_food_contact')
assert.equal(coatingId, 'proprietary_nonstick_coating_undisclosed')
assert.notEqual(pfasId, 'pfas_not_present_inert_material')
assert.ok(isHybridFoodContactPrimary(primaryId))
console.log('✓ hybrid fixture maps to hybrid_stainless_nonstick + proprietary_nonstick_coating_undisclosed')

assert.ok(inertMetalProtectionBlocked(mappings))
assert.ok(inertBlockedReexport(mappings))
console.log('✓ inert-metal protection blocked when hybrid/coating present')

const collapsed = buildHybridCollapsedToInertMappings()
const preMappingFixture = buildHybridNonstickCookwareStructuredEvidence()
const contradiction = getCoatingInertContradictionBlockers(collapsed, preMappingFixture)
assert.ok(contradiction.length >= 2, `expected contradictions, got: ${contradiction.join('; ')}`)
assert.ok(
  contradiction.some((b) => b.includes('pfas_not_present_inert_material')),
  'pfas inert contradiction',
)
assert.ok(
  contradiction.some((b) => b.includes('no_coating_modifier')),
  'no_coating_modifier contradiction',
)
console.log('✓ collapsed inert mapping fails coating/inert contradiction preflight')

const gate1Blockers = getGate1ContradictionBlockers({
  ...preMappingFixture,
  canonical_mappings: collapsed,
})
assert.ok(gate1Blockers.some((b) => b.includes('Contradiction')))
console.log('✓ Gate 1 contradiction blockers surface coating/inert mismatch')

assert.throws(
  () =>
    assertCookwareMaterialsResolved(
      { ...preMappingFixture, canonical_mappings: collapsed },
      { product_name: 'Hybrid fixture' },
    ),
  /collapsed to inert stainless/,
)
console.log('✓ Agent 1 pre-save guard blocks hybrid collapse to inert stainless')

assert.ok(
  !mappings.blockers?.some((b) => b.includes('Contradiction')),
  `mapped hybrid should not carry contradiction blockers: ${mappings.blockers?.join('; ')}`,
)
assert.deepEqual(mappings.blockers ?? [], [])
console.log('✓ correctly mapped hybrid fixture has no canonical contradiction blockers')

const agent1TerrabondRaw = {
  product_identity: { subcategory: 'Cookware', product_name: '' },
  primary_contact_material: {
    material_identity: 'terrabond_proprietary',
    confidence_label: 'manufacturer_confirmed',
  },
  coatings_and_finishes: [],
}
const terrabondMapped = applyCanonicalMappings(agent1TerrabondRaw, [])
assert.equal(
  terrabondMapped.primary_contact_material_id?.canonical_id,
  'hybrid_stainless_nonstick_food_contact',
)
assert.equal(terrabondMapped.substrate_material_id?.canonical_id, 'stainless_steel_body')
assert.doesNotThrow(() =>
  assertCookwareMaterialsResolved(
    { ...agent1TerrabondRaw, canonical_mappings: terrabondMapped },
    { product_name: 'HexClad Hybrid Nonstick 10 Inch Frying Pan' },
  ),
)
console.log('✓ Agent 1 terrabond_proprietary primary maps without product name in structured')

const staleTaxonomy = PRIMARY_CONTACT_MATERIAL_TAXONOMY.filter(
  (e) => e.canonical_id !== 'hybrid_stainless_nonstick_food_contact',
)
const staleResolved = resolvePrimaryContactEntry('terrabond_proprietary', staleTaxonomy)
assert.equal(staleResolved?.canonical_id, HYBRID_FOOD_CONTACT_PRIMARY_ENTRY.canonical_id)
assert.ok(isHybridPrimaryContactRaw('terrabond_proprietary'))
console.log('✓ terrabond_proprietary resolves via fallback when stale taxonomy cache lacks hybrid row')

const ceramicFixture = {
  product_identity: {
    subcategory: 'Cookware',
    product_name: 'Valencia Pro Ceramic Nonstick 10 Inch Frying Pan',
  },
  primary_contact_material: {
    material_identity: 'hard_anodized_aluminum',
    confidence_label: 'manufacturer_confirmed',
  },
  coatings_and_finishes: [
    {
      coating_name: 'Thermolon Minerals Pro',
      coating_type: 'ceramic_nonstick_unverified',
    },
  ],
}
const ceramicSources = [
  {
    source_type: 'manufacturer',
    url: 'https://example.com/products/ceramic-non-stick-frypan-10-inch',
    page_excerpt: 'Magneto induction base with stainless steel plate. Hard anodized aluminum body.',
  },
]
assert.equal(detectHybridCookwareEvidenceSignals(ceramicFixture, ceramicSources), false)
const ceramicMapped = applyCanonicalMappings(ceramicFixture, ceramicSources)
assert.equal(ceramicMapped.primary_contact_material_id?.canonical_id, 'ceramic_nonstick_sol_gel_coating')
assert.equal(ceramicMapped.substrate_material_id?.canonical_id, 'hard_anodized_aluminum')
assert.notEqual(ceramicMapped.primary_contact_material_id?.canonical_id, 'hybrid_stainless_nonstick_food_contact')
console.log('✓ ceramic-over-aluminum with induction base does not map to hybrid stainless')

console.log('\nHybrid food-contact taxonomy tests passed.')
