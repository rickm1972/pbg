#!/usr/bin/env node
/**
 * Admin Product Editor Part B — pipeline-owned fields locked read-only in save payload.
 * Run: npm run test:admin-editor
 */
import assert from 'node:assert/strict'
import {
  ADMIN_PIPELINE_READONLY_FIELDS,
  ADMIN_PIPELINE_READONLY_FIELD_KEYS,
  buildAdminProductSavePayload,
  assertAdminSavePayloadExcludesPipelineFields,
  formatAdminReadOnlyFieldValue,
} from '../src/lib/adminProductEditor.ts'

const sampleProduct = {
  product_id: 'test-id',
  product_name: 'Lodge Cast Iron Skillet',
  brand: 'Lodge',
  category: 'Kitchen',
  subcategory: 'Cookware',
  description: 'Legacy listing blurb',
  pac_safety_score: 99,
  tier: 'Excellent',
  score_basis: 'Based on Materials Science',
  primary_material: 'Cast iron',
  secondary_material: 'None',
  bpa_free: 'Yes',
  phthalate_free_claim: 'Unknown',
  amazon_asin: null,
  amazon_url: 'https://amazon.com/example',
  affiliate_link: 'https://amazon.com/affiliate',
  target_url: 'https://target.com/example',
  walmart_url: 'https://walmart.com/example',
  other_retailer_label: 'Brand site',
  other_retailer_url: 'https://lodge.com/example',
  image_url: 'https://cdn.example/image.jpg',
  date_added: '2026-01-01T00:00:00Z',
  date_last_updated: '2026-01-01T00:00:00Z',
  active: true,
}

assert.equal(ADMIN_PIPELINE_READONLY_FIELDS.length, 5)
assert.deepEqual(
  ADMIN_PIPELINE_READONLY_FIELDS.map((f) => f.key),
  [...ADMIN_PIPELINE_READONLY_FIELD_KEYS],
)

for (const field of ADMIN_PIPELINE_READONLY_FIELDS) {
  assert.ok(field.label.length > 0, `${field.key} has label`)
  assert.ok(field.hint.length > 0, `${field.key} has hint`)
  const display = formatAdminReadOnlyFieldValue(field.key, sampleProduct)
  assert.ok(display.length > 0, `${field.key} renders display value`)
}

assert.equal(formatAdminReadOnlyFieldValue('pac_safety_score', { ...sampleProduct, pac_safety_score: null }), '—')
assert.equal(formatAdminReadOnlyFieldValue('tier', { ...sampleProduct, tier: null }), '—')

const fullPayload = buildAdminProductSavePayload(sampleProduct, 'full')
assertAdminSavePayloadExcludesPipelineFields(fullPayload)

for (const key of ADMIN_PIPELINE_READONLY_FIELD_KEYS) {
  assert.equal(
    key in fullPayload,
    false,
    `full payload must not include ${key}`,
  )
}

assert.equal(fullPayload.product_name, sampleProduct.product_name)
assert.equal(fullPayload.brand, sampleProduct.brand)
assert.equal(fullPayload.category, sampleProduct.category)
assert.equal(fullPayload.subcategory, sampleProduct.subcategory)
assert.equal(fullPayload.description, sampleProduct.description)
assert.equal(fullPayload.bpa_free, sampleProduct.bpa_free)
assert.equal(fullPayload.phthalate_free_claim, sampleProduct.phthalate_free_claim)
assert.equal(fullPayload.amazon_url, sampleProduct.amazon_url)
assert.equal(fullPayload.affiliate_link, sampleProduct.affiliate_link)
assert.equal(fullPayload.target_url, sampleProduct.target_url)
assert.equal(fullPayload.walmart_url, sampleProduct.walmart_url)
assert.equal(fullPayload.other_retailer_label, sampleProduct.other_retailer_label)
assert.equal(fullPayload.other_retailer_url, sampleProduct.other_retailer_url)
assert.equal(fullPayload.image_url, sampleProduct.image_url)
assert.equal(fullPayload.active, sampleProduct.active)

const noOtherPayload = buildAdminProductSavePayload(sampleProduct, 'no_other')
assertAdminSavePayloadExcludesPipelineFields(noOtherPayload)
assert.equal('other_retailer_url' in noOtherPayload, false)

const noRetailPayload = buildAdminProductSavePayload(sampleProduct, 'no_retailer_urls')
assertAdminSavePayloadExcludesPipelineFields(noRetailPayload)
assert.equal('target_url' in noRetailPayload, false)
assert.equal('walmart_url' in noRetailPayload, false)

console.log('Admin editor Part B tests PASSED')
