#!/usr/bin/env node
/**
 * APR schema + namespace split tests (Phase 1).
 * Run: node scripts/test-apr-schema.mjs
 */
import assert from 'node:assert/strict'
import {
  APR_SCHEMA_VERSION,
  APR_FIELD_OWNERS,
  SOURCE_ROLES,
  DISPLAY_SOURCE_GROUPS,
} from '../src/types/apr.ts'
import {
  buildTwelveInchSkilletFixtureApr,
  fixturePublicEligibleSources,
  FIXTURE_MFR_MISMATCH_URL,
  FIXTURE_REVIEWED_NAME,
} from '../src/lib/apr/fixtures/twelveInchSkillet.fixture.ts'
import { assertDisplayNamespaceSeparation } from '../src/lib/apr/snapshot.ts'

// Schema constants
assert.equal(APR_SCHEMA_VERSION, '1.0.0')
assert.ok(SOURCE_ROLES.includes('retailer_primary'))
assert.ok(SOURCE_ROLES.includes('manufacturer'))
assert.ok(DISPLAY_SOURCE_GROUPS.includes('Retailer'))
console.log('✓ APR schema constants')

// Field ownership map covers contract surface
const ownerPaths = Object.keys(APR_FIELD_OWNERS)
assert.ok(ownerPaths.includes('display.product_title'))
assert.ok(ownerPaths.includes('display.sources'))
assert.ok(ownerPaths.includes('normalization.components'))
assert.ok(ownerPaths.includes('score.tier'))
assert.ok(ownerPaths.includes('evidence.sources.source_role'))
console.log('✓ field ownership map defined')

// Fixture APR assembles with valid shape
const apr = buildTwelveInchSkilletFixtureApr()
assert.equal(apr.product_id, 'fixture-product-12in-skillet')
assert.equal(apr.display.payload.product_title, FIXTURE_REVIEWED_NAME)
assert.equal(apr.score.payload.pac_safety_score, 99)
assert.equal(apr.score.payload.tier, 'Excellent')
assert.equal(apr.score.payload.transparency_badge, 'Documentation Incomplete')
console.log('✓ fixture APR shape')

// Namespace split: components[] not in display payload keys
const displayKeys = Object.keys(apr.display.payload)
assert.ok(!displayKeys.includes('components'))
assert.ok(Array.isArray(apr.normalization.payload.components))
assert.ok(apr.normalization.payload.components.length >= 2)
const namespace = assertDisplayNamespaceSeparation(apr.normalization, apr.display)
assert.equal(namespace.valid, true, namespace.errors.join('; '))
console.log('✓ normalization.components[] vs display.* namespace split')

// Display strings are human-readable — no canonical IDs in fixture display
const displayJson = JSON.stringify(apr.display.payload)
assert.ok(!displayJson.includes('stainless_steel_unspecified'))
assert.ok(!displayJson.includes('graphite_core'))
assert.ok(!/stainless steel \(grade unspecified\)/i.test(displayJson))
console.log('✓ display.* uses authored prose not canonical IDs')

// Variant-mismatched 12.5" manufacturer product page hidden from public eligible set
const eligible = fixturePublicEligibleSources(apr)
assert.ok(!eligible.some((s) => s.url.includes('12-5-inch')))
assert.ok(eligible.some((s) => s.source_role === 'retailer_primary'))
const hidden = apr.display.payload.sources.find((s) => s.url === FIXTURE_MFR_MISMATCH_URL)
assert.equal(hidden?.public_source_eligible, false)
assert.equal(hidden?.variant_mismatch, true)
console.log('✓ variant-mismatched manufacturer product page defaults ineligible')

// retailer_primary never under Context
for (const source of apr.display.payload.sources) {
  if (source.source_role === 'retailer_primary') {
    assert.notEqual(source.group, 'Context')
    assert.equal(source.public_source_eligible, true)
  }
}
console.log('✓ retailer_primary source grouping contract')

// Buy CTA from display only
assert.equal(apr.display.payload.buy_cta[0].label, 'Buy on Williams Sonoma')
console.log('✓ buy CTA authored in display.buy_cta')

console.log('\nAll APR schema tests passed')
