#!/usr/bin/env node
/**
 * Manufacturer source validation — summary must not contradict Gate 1 material warnings.
 * Run: npm run test:manufacturer-source-validation-consistency
 */
import assert from 'node:assert/strict'
import {
  sourceSupportsMaterialEvidence,
  validateManufacturerSource,
  validateManufacturerPdpSet,
} from '../src/shared/agent1/manufacturer-pdp-validation.mjs'
import { applyAgent1SourceValidation } from '../src/shared/agent1/gate1-source-validation.mjs'
import {
  buildCeramicOverHardAnodizedSources,
  buildCeramicOverHardAnodizedStructuredEvidence,
  CERAMIC_OVER_HARD_ANODIZED_PRODUCT,
} from '../src/shared/canonical-taxonomy/fixtures/ceramicOverHardAnodized.fixture.mjs'
import { applyCanonicalMappings } from '../src/shared/canonical-taxonomy/map-structured-evidence.mjs'

const product = CERAMIC_OVER_HARD_ANODIZED_PRODUCT
const pdpUrl =
  'https://exampleceramicbrand.us/products/valencia-pro-ceramic-non-stick-covered-frypan-10-inch'

const emptyExcerptPdp = {
  url: pdpUrl,
  title: '',
  page_excerpt: '',
  source_type: 'manufacturer',
}

assert.equal(sourceSupportsMaterialEvidence(emptyExcerptPdp), true, 'URL slug should support material evidence')
const pdpValidation = validateManufacturerSource(emptyExcerptPdp, product)
assert.equal(pdpValidation.passed, true, `expected passed PDP validation: ${pdpValidation.issues.join('; ')}`)
assert.equal(pdpValidation.supports_material_evidence, true)
console.log('✓ exact PDP with ceramic slug passes validation despite empty excerpt')

const collectionOnly = {
  url: 'https://exampleceramicbrand.us/collections/fry-pans',
  title: 'Shop fry pans',
  page_excerpt: 'Browse our cookware collections',
  source_type: 'manufacturer',
}
const collectionValidation = validateManufacturerSource(collectionOnly, product)
assert.equal(collectionValidation.passed, false)
assert.equal(collectionValidation.supports_material_evidence, false)
console.log('✓ collection page without materials fails validation')

const structured = buildCeramicOverHardAnodizedStructuredEvidence()
const sources = buildCeramicOverHardAnodizedSources()
structured.canonical_mappings = applyCanonicalMappings(structured, sources)

const strongValidation = applyAgent1SourceValidation(structured, sources, product)
const pdpSet = validateManufacturerPdpSet(sources, product, structured)
assert.equal(pdpSet.has_validated_pdp, true)
assert.ok(!strongValidation.blockers.some((b) => b.includes('MANUFACTURER_MATERIAL_EVIDENCE_MISSING')))
assert.ok(!strongValidation.blockers.some((b) => b.includes('MANUFACTURER_PDP_NOT_VALIDATED')))
console.log('✓ validated PDP clears material-evidence blockers (no summary/warning contradiction)')

const weakStructured = buildCeramicOverHardAnodizedStructuredEvidence()
weakStructured.canonical_mappings = structured.canonical_mappings
weakStructured.retailer_links = { amazon_url: weakStructured.retailer_links?.amazon_url }
const weakSources = [collectionOnly]
const weakValidation = applyAgent1SourceValidation(weakStructured, weakSources, product)
assert.ok(weakValidation.blockers.some((b) => b.includes('MANUFACTURER_MATERIAL_EVIDENCE_MISSING')))
assert.ok(
  weakValidation.warnings.some((w) => /collection page|homepage/i.test(w)) ||
    weakValidation.blockers.some((b) => b.includes('MANUFACTURER_PDP_NOT_VALIDATED')),
  'collection-only path should surface validation warning or blocker',
)
console.log('✓ collection-only manufacturer source consistent with blockers/warnings')

console.log('\nManufacturer source validation consistency tests passed.')
