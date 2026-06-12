#!/usr/bin/env node
/**
 * Product source intake — admin fields, commerce separation, Agent 1 handoff.
 * Run: npm run test:product-source-intake
 */
import assert from 'node:assert/strict'
import {
  buildAdminProductSavePayload,
  assertAdminSavePayloadExcludesPipelineFields,
} from '../src/lib/adminProductEditor.ts'
import { HIDDEN_LEGACY_INTAKE_KEYS } from '../src/lib/simpleProductIntake.ts'
import {
  listProvidedSourceIntakeEntries,
  resolvePrimaryRetailerEvidenceUrl,
  buildAgent1ProvidedInput,
  applyProvidedSourceIntakePriority,
} from '../src/shared/agent1/provided-source-intake.mjs'
import {
  buildProvidedIntakeHexCladPatternProduct,
  buildProvidedIntakeHexCladPatternDiscoveredSources,
  buildProvidedIntakeHexCladPatternStructuredBeforePriority,
  buildProvidedIntakeHexCladPatternIntakeReport,
  FIXTURE_PROVIDED_MANUFACTURER_PDP,
} from '../src/shared/agent1/fixtures/providedSourceIntakeHexCladPattern.fixture.mjs'
import { enrichRetailerLinks } from './agent1/structured-normalize.mjs'

const sampleProduct = {
  product_id: 'intake-test',
  product_name: 'Example Pan',
  brand: 'ExampleBrand',
  category: 'Kitchen',
  subcategory: 'Cookware',
  description: null,
  pac_safety_score: null,
  tier: null,
  score_basis: null,
  primary_material: null,
  secondary_material: null,
  bpa_free: 'Unknown',
  phthalate_free_claim: 'Unknown',
  amazon_asin: null,
  amazon_url: 'https://www.amazon.com/dp/B0TEST0001',
  affiliate_link: 'https://www.amazon.com/dp/B0TEST0001?tag=affiliate',
  target_url: 'https://target.com/p/example',
  walmart_url: null,
  other_retailer_label: null,
  other_retailer_url: null,
  primary_retailer_evidence_url: null,
  manufacturer_product_url: 'https://examplebrand.com/products/10-pan',
  manufacturer_lab_results_url: null,
  manufacturer_materials_faq_url: null,
  agent1_source_notes: null,
  image_url: null,
  date_added: '2026-01-01T00:00:00Z',
  date_last_updated: '2026-01-01T00:00:00Z',
  active: true,
}

// --- Admin save payload includes three intake columns, not legacy extras ---
const payload = buildAdminProductSavePayload(sampleProduct, 'full')
assertAdminSavePayloadExcludesPipelineFields(payload)
assert.equal(payload.manufacturer_product_url, sampleProduct.manufacturer_product_url)
assert.equal(payload.amazon_url, sampleProduct.amazon_url)
assert.equal(payload.product_name, sampleProduct.product_name)
for (const key of HIDDEN_LEGACY_INTAKE_KEYS) {
  assert.equal(key in payload, false)
}

// --- Commerce affiliate distinct from evidence URLs ---
assert.equal(resolvePrimaryRetailerEvidenceUrl(sampleProduct), sampleProduct.amazon_url)
assert.notEqual(resolvePrimaryRetailerEvidenceUrl(sampleProduct), sampleProduct.affiliate_link)
const agentInput = buildAgent1ProvidedInput(sampleProduct)
assert.equal(agentInput.primary_retailer_url, sampleProduct.amazon_url)
assert.equal(agentInput.manufacturer_product_url, sampleProduct.manufacturer_product_url)

// --- Agent 1 intake entry list (retailer + manufacturer only) ---
const entries = listProvidedSourceIntakeEntries(sampleProduct)
assert.equal(entries.length, 2)
assert.ok(entries.some((e) => e.role === 'amazon_evidence'))
assert.ok(entries.some((e) => e.role === 'manufacturer_product'))

// --- enrichRetailerLinks prefers provided manufacturer over synthesis ---
const links = enrichRetailerLinks(
  { manufacturer_direct_url: 'https://examplebrand.eu/' },
  sampleProduct,
)
assert.equal(links.manufacturer_direct_url, sampleProduct.manufacturer_product_url)
assert.equal(links.amazon_url, sampleProduct.amazon_url)

// --- Provided manufacturer PDP beats wrong-region discovered URL ---
const hexProduct = buildProvidedIntakeHexCladPatternProduct()
const structured = buildProvidedIntakeHexCladPatternStructuredBeforePriority()
const sources = buildProvidedIntakeHexCladPatternDiscoveredSources()
const intakeReport = buildProvidedIntakeHexCladPatternIntakeReport()
const applied = applyProvidedSourceIntakePriority(structured, sources, hexProduct, intakeReport)

assert.equal(
  applied.structured.retailer_links.manufacturer_direct_url,
  FIXTURE_PROVIDED_MANUFACTURER_PDP.url,
)
const wrongRegion = applied.sources.find((s) => s.url?.includes('examplebrand.eu'))
assert.ok(wrongRegion?.provided_intake_supplemental || wrongRegion?.provided_intake_mismatch)

console.log('✓ three-field intake saves to correct product columns')
console.log('✓ legacy intake keys excluded from admin save payload')
console.log('✓ commerce affiliate distinct from Agent 1 retailer URL')
console.log('✓ enrichRetailerLinks prefers provided manufacturer_product_url')
console.log('✓ provided manufacturer PDP beats wrong-region discovered URL')
console.log('\nAll product source intake tests passed.')
