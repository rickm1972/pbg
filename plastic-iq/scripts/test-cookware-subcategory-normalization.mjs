#!/usr/bin/env node
/**
 * Granular cookware subcategories route to existing Cookware required-evidence matrix.
 * Run: npm run test:cookware-subcategory-normalization
 */
import assert from 'node:assert/strict'
import {
  resolveMatrixKeyFromRegistry,
  resolveProductTypeConfig,
} from '../src/shared/product-type-registry/index.mjs'
import {
  COOKWARE_GRANULAR_SUBCATEGORY_ALIASES,
  matchesCookwareGranularSubcategory,
} from '../src/shared/product-type-registry/cookware-subcategory-routing.mjs'
import { assertProductTypeRegistryConfigured } from '../src/shared/product-type-registry/preflight.mjs'
import { deriveProductCategory } from './agent2/deterministic/category.mjs'
import {
  buildGate1ApprovalEligibilityHexCladV7Structured,
} from '../src/shared/agent1/fixtures/gate1ApprovalEligibilityHexCladV7.fixture.mjs'

const COOKWARE_ALIASES_TO_TEST = [
  'Frying Pan / Skillet',
  'Frying Pan',
  'Fry Pan',
  'Skillet',
  'Nonstick Skillet',
  'Ceramic Nonstick Skillet',
  'Ceramic Nonstick Frying Pan',
  'Nonstick Frying Pan',
  'Saucepan',
  'Sauté Pan',
  'Saute Pan',
  'Stockpot',
  'Dutch Oven',
  'Wok',
  'Griddle',
  'Grill Pan',
  'Cookware Set',
  'Cookware',
]

for (const alias of COOKWARE_ALIASES_TO_TEST) {
  assert.ok(matchesCookwareGranularSubcategory(alias, 'Kitchen'), `${alias} should match cookware routing`)
  assert.equal(
    resolveMatrixKeyFromRegistry(alias, { category: 'Kitchen' }),
    'cookware',
    `${alias} → cookware matrix`,
  )
  const config = resolveProductTypeConfig({ category: 'Kitchen', subcategory: alias })
  assert.equal(config?.matrix_key, 'cookware', `${alias} config matrix_key`)
  assert.equal(config?.subcategory, 'Cookware', `${alias} inherits Cookware registry config`)
}
console.log(`✓ ${COOKWARE_ALIASES_TO_TEST.length} granular cookware aliases route to cookware matrix`)

// Pan only routes when Kitchen/cookware category context applies
assert.equal(resolveMatrixKeyFromRegistry('Pan', { category: 'Kitchen' }), 'cookware')
assert.equal(resolveMatrixKeyFromRegistry('Pan', {}), 'cookware')
assert.equal(resolveMatrixKeyFromRegistry('Pan', { category: 'Electronics' }), null)
console.log('✓ "Pan" routes in Kitchen context only')

// Exported alias list covers required subtypes
for (const required of COOKWARE_ALIASES_TO_TEST) {
  assert.ok(
    COOKWARE_GRANULAR_SUBCATEGORY_ALIASES.includes(required),
    `COOKWARE_GRANULAR_SUBCATEGORY_ALIASES missing ${required}`,
  )
}
console.log(`✓ cookware alias export list has ${COOKWARE_GRANULAR_SUBCATEGORY_ALIASES.length} entries`)

// HexClad / Caraway / T-Fal-style Cookware still resolve
const hex = buildGate1ApprovalEligibilityHexCladV7Structured()
assert.equal(resolveMatrixKeyFromRegistry(hex.product_identity.subcategory, { category: 'Kitchen' }), 'cookware')
assert.equal(
  deriveProductCategory(
    { agent_metadata: { structured_evidence: { product_identity: { subcategory: 'Cookware', category: 'Kitchen' } } } },
    { subcategory: 'Cookware', category: 'Kitchen' },
  ),
  'cookware',
)
assert.equal(resolveMatrixKeyFromRegistry('cookware', {}), 'cookware')
assert.equal(resolveMatrixKeyFromRegistry('Cookware', { category: 'Kitchen' }), 'cookware')
console.log('✓ HexClad/Caraway/T-Fal Cookware subcategory routing unchanged')

// Unconfigured non-cookware still blocked
const blocked = assertProductTypeRegistryConfigured({
  product: { category: 'Electronics', subcategory: 'Gadgets', product_name: 'Test' },
})
assert.equal(blocked.ok, false)
console.log('✓ non-cookware unconfigured types still blocked')

console.log('\nCookware subcategory normalization tests passed.')
