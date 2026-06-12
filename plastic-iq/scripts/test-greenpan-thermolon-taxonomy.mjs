#!/usr/bin/env node
/**
 * Ceramic / Thermolon over hard-anodized aluminum — must not map to HexClad hybrid stainless.
 * Run: npm run test:greenpan-thermolon-taxonomy
 */
import assert from 'node:assert/strict'
import { applyCanonicalMappings } from '../src/shared/canonical-taxonomy/map-structured-evidence.mjs'
import {
  detectHybridCookwareEvidenceSignals,
  isHybridFoodContactPrimary,
} from '../src/shared/canonical-taxonomy/hybrid-cookware-structural.mjs'
import { applyAgent1SourceValidation } from '../src/shared/agent1/gate1-source-validation.mjs'
import { getGate1ContradictionBlockers } from '../src/lib/gate1ContradictionBlockers.ts'
import { assertCookwareMaterialsResolved } from './agent1/assert-canonical-materials.mjs'
import {
  buildCeramicOverHardAnodizedSources,
  buildCeramicOverHardAnodizedStructuredEvidence,
  CERAMIC_OVER_HARD_ANODIZED_PRODUCT,
} from '../src/shared/canonical-taxonomy/fixtures/ceramicOverHardAnodized.fixture.mjs'
import { retailerVariantMismatchWarnings } from '../src/shared/agent1/retailer-variant-guard.mjs'

const structured = buildCeramicOverHardAnodizedStructuredEvidence()
const sources = buildCeramicOverHardAnodizedSources()

assert.equal(
  detectHybridCookwareEvidenceSignals(structured, sources),
  false,
  'ceramic-over-aluminum must not trigger hybrid evidence signals',
)
console.log('✓ no false hybrid evidence signals for ceramic-over-aluminum fixture')

const mappings = applyCanonicalMappings(structured, sources)

assert.equal(
  mappings.primary_contact_material_id?.canonical_id,
  'ceramic_nonstick_sol_gel_coating',
  `primary must be ceramic nonstick, got ${mappings.primary_contact_material_id?.canonical_id}`,
)
assert.equal(
  mappings.substrate_material_id?.canonical_id,
  'hard_anodized_aluminum',
  `substrate must be hard_anodized_aluminum, got ${mappings.substrate_material_id?.canonical_id}`,
)
assert.equal(mappings.coating_modifier_id?.canonical_id, 'proprietary_nonstick_coating_undisclosed')
assert.notEqual(mappings.primary_contact_material_id?.canonical_id, 'hybrid_stainless_nonstick_food_contact')
assert.notEqual(mappings.substrate_material_id?.canonical_id, 'stainless_steel_body')
assert.ok(!isHybridFoodContactPrimary(mappings.primary_contact_material_id?.canonical_id))
console.log('✓ Thermolon Minerals Pro → ceramic_nonstick_sol_gel_coating + hard_anodized_aluminum body')

structured.canonical_mappings = mappings
assert.doesNotThrow(() =>
  assertCookwareMaterialsResolved(structured, {
    product_name: CERAMIC_OVER_HARD_ANODIZED_PRODUCT.product_name,
  }),
)
console.log('✓ pre-save guard accepts ceramic-over-aluminum mapping')

const blockers = getGate1ContradictionBlockers(structured)
assert.ok(!blockers.some((b) => b.includes('hybrid_stainless')))
console.log('✓ no hybrid contradiction blockers')

const validation = applyAgent1SourceValidation(structured, sources, CERAMIC_OVER_HARD_ANODIZED_PRODUCT)
assert.ok(
  validation.blockers.every((b) => !b.includes('MANUFACTURER_PDP_NOT_VALIDATED')),
  `PDP slug material evidence should not trigger PDP not validated: ${validation.blockers.join('; ')}`,
)
console.log('✓ manufacturer PDP URL slug supports material evidence without PDP-not-validated blocker')

const variantWarnings = retailerVariantMismatchWarnings(sources, CERAMIC_OVER_HARD_ANODIZED_PRODUCT)
assert.ok(
  variantWarnings.some((w) => w.includes('8-inch') || w.includes('8 inch') || /456/.test(w)),
  '8-inch walmart should be flagged as variant mismatch',
)
assert.ok(
  !variantWarnings.some((w) => w.includes('/123') && w.includes('mismatch')),
  '10-inch walmart should not be flagged',
)
console.log('✓ wrong-variant Walmart URL flagged, matching 10-inch URL allowed')

console.log('\nCeramic / Thermolon over hard-anodized taxonomy tests passed.')
