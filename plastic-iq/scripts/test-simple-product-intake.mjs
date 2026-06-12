#!/usr/bin/env node
/**
 * Simple three-field product intake before Agent 1.
 * Run: npm run test:simple-product-intake
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  SIMPLE_PRODUCT_INTAKE_FIELDS,
  HIDDEN_LEGACY_INTAKE_KEYS,
  buildAgent1ProvidedInput,
} from '../src/lib/simpleProductIntake.ts'
import {
  buildAdminProductSavePayload,
  assertAdminSavePayloadExcludesPipelineFields,
} from '../src/lib/adminProductEditor.ts'
import {
  listProvidedSourceIntakeEntries,
  resolvePrimaryRetailerEvidenceUrl,
  applyProvidedSourceIntakePriority,
} from '../src/shared/agent1/provided-source-intake.mjs'
import {
  buildProvidedIntakeHexCladPatternProduct,
  buildProvidedIntakeHexCladPatternDiscoveredSources,
  buildProvidedIntakeHexCladPatternStructuredBeforePriority,
  buildProvidedIntakeHexCladPatternIntakeReport,
  FIXTURE_PROVIDED_MANUFACTURER_PDP,
} from '../src/shared/agent1/fixtures/providedSourceIntakeHexCladPattern.fixture.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const adminPageSource = readFileSync(join(__dirname, '../src/pages/AdminPage.tsx'), 'utf8')

// --- UI shows exactly three intake fields ---
assert.equal(SIMPLE_PRODUCT_INTAKE_FIELDS.length, 3)
assert.deepEqual(
  SIMPLE_PRODUCT_INTAKE_FIELDS.map((f) => f.label),
  [
    'Product title',
    'Amazon or primary retailer URL',
    'Manufacturer product URL',
  ],
)
assert.ok(adminPageSource.includes('SIMPLE_PRODUCT_INTAKE_FIELDS'), 'AdminPage must render intake from SIMPLE_PRODUCT_INTAKE_FIELDS')
assert.ok(adminPageSource.includes('ProductTaxonomyFields'), 'AdminPage must use managed taxonomy fields')
assert.ok(adminPageSource.includes('ProductClaimIntakeFields'), 'AdminPage must render claim intake fields')
assert.ok(adminPageSource.includes('Product intake (before Agent 1)'), 'AdminPage missing intake section heading')
console.log('✓ product intake UI defines exactly three user-facing fields')

// --- Hidden legacy fields not in admin save workflow ---
const payload = buildAdminProductSavePayload(
  {
    product_id: 'x',
    product_name: 'HexClad Hybrid Nonstick 10 Inch Frying Pan',
    brand: 'HexClad',
    category_id: 'a1111111-1111-4111-8111-111111111101',
    subcategory_id: 'a1111111-1111-4111-8111-111111111201',
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
    amazon_url: 'https://www.amazon.com/HexClad-Nonstick-Dishwasher-Friendly-Compatible/dp/B07WLQTCRH',
    affiliate_link: 'https://www.amazon.com/dp/B07WLQTCRH?tag=affiliate',
    target_url: null,
    walmart_url: null,
    other_retailer_label: null,
    other_retailer_url: null,
    primary_retailer_evidence_url: 'https://legacy.example/should-not-save',
    manufacturer_product_url:
      'https://hexclad.com/collections/fry-pans-deep-sautes/products/10-hexclad-pan',
    manufacturer_lab_results_url: 'https://legacy.example/lab',
    manufacturer_materials_faq_url: 'https://legacy.example/faq',
    agent1_source_notes: 'legacy notes',
    image_url: null,
    date_added: '2026-01-01',
    date_last_updated: '2026-01-01',
    active: true,
  },
  'full',
)
assertAdminSavePayloadExcludesPipelineFields(payload)
for (const key of HIDDEN_LEGACY_INTAKE_KEYS) {
  assert.equal(key in payload, false, `save payload must not include legacy intake key: ${key}`)
}
assert.equal(payload.product_name, 'HexClad Hybrid Nonstick 10 Inch Frying Pan')
assert.equal(
  payload.amazon_url,
  'https://www.amazon.com/HexClad-Nonstick-Dishwasher-Friendly-Compatible/dp/B07WLQTCRH',
)
assert.equal(
  payload.manufacturer_product_url,
  'https://hexclad.com/collections/fry-pans-deep-sautes/products/10-hexclad-pan',
)
assert.equal(payload.affiliate_link, 'https://www.amazon.com/dp/B07WLQTCRH?tag=affiliate')
console.log('✓ save writes title, amazon_url, manufacturer_product_url only (no legacy intake keys)')

// --- Overbuilt evidence panel removed from AdminPage ---
assert.equal(adminPageSource.includes('Evidence source intake (Agent 1)'), false)
assert.equal(adminPageSource.includes('Manufacturer lab results URL'), false)
assert.equal(adminPageSource.includes('Agent 1 source notes'), false)
assert.equal(adminPageSource.includes('Primary retailer evidence URL'), false)
console.log('✓ prior six-field evidence panel removed from AdminPage')

// --- Agent 1 input builder ---
const hexProduct = buildProvidedIntakeHexCladPatternProduct()
const agentInput = buildAgent1ProvidedInput(hexProduct)
assert.equal(agentInput.product_title, hexProduct.product_name)
assert.equal(agentInput.primary_retailer_url, hexProduct.amazon_url)
assert.equal(agentInput.manufacturer_product_url, hexProduct.manufacturer_product_url)
assert.notEqual(agentInput.primary_retailer_url, hexProduct.affiliate_link)
console.log('✓ Agent 1 input receives title, retailer URL, manufacturer URL (not affiliate)')

const entries = listProvidedSourceIntakeEntries(hexProduct)
assert.equal(entries.length, 2)
assert.ok(entries.some((e) => e.role === 'amazon_evidence' || e.role === 'primary_retailer_evidence'))
assert.ok(entries.some((e) => e.role === 'manufacturer_product'))
assert.equal(resolvePrimaryRetailerEvidenceUrl({ amazon_url: null, affiliate_link: 'https://affiliate' }), null)
console.log('✓ Agent 1 source priority uses retailer + manufacturer only (two provided URLs)')

const structured = buildProvidedIntakeHexCladPatternStructuredBeforePriority()
const sources = buildProvidedIntakeHexCladPatternDiscoveredSources()
const intakeReport = buildProvidedIntakeHexCladPatternIntakeReport()
const applied = applyProvidedSourceIntakePriority(structured, sources, hexProduct, intakeReport)
assert.equal(
  applied.structured.retailer_links.manufacturer_direct_url,
  FIXTURE_PROVIDED_MANUFACTURER_PDP.url,
)
console.log('✓ search-discovered manufacturer URL cannot override provided manufacturer_product_url')

console.log('\nAll simple product intake tests passed.')
