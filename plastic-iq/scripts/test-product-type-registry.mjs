#!/usr/bin/env node
/**
 * Phase 0.5 — product-type registry tests.
 * Run: npm run test:product-type-registry
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  getAllProductTypeConfigs,
  resolveProductTypeConfig,
  resolveMatrixKeyFromRegistry,
  registerProductTypeConfigForTest,
  validateProductTypeConfig,
} from '../src/shared/product-type-registry/index.mjs'
import { STARTER_PRODUCT_TYPE_CONFIGS } from '../src/shared/product-type-registry/configs/starter-configs.mjs'
import {
  assertProductTypeRegistryConfigured,
  CATEGORY_CONFIG_REQUIRED,
} from '../src/shared/product-type-registry/preflight.mjs'
import { deriveProductCategory } from './agent2/deterministic/category.mjs'
import { buildWhyThisScoreOptions } from './agent2/why-this-score-map.mjs'

const RENDERER_SCAN_FILES = [
  'src/pages/ProductPage.tsx',
  'src/components/Sources.tsx',
  'src/components/WhyThisScore.tsx',
  'src/components/RiskDashboard.tsx',
  'src/components/RetailerBuyButtons.tsx',
  'src/components/TransparencyBadge.tsx',
]

const root = join(fileURLToPath(import.meta.url), '..', '..')

console.log('Product-type registry tests\n')

// Starter configs validate and include scoring refs
for (const config of STARTER_PRODUCT_TYPE_CONFIGS) {
  const result = validateProductTypeConfig(config)
  assert.equal(result.valid, true, `${config.registry_key}: ${result.errors.join('; ')}`)
  assert.ok(config.scoring_assumption_ref.startsWith('v2.3.5.'))
}
console.log(`✓ ${STARTER_PRODUCT_TYPE_CONFIGS.length} starter configs validate with V2.3.5 scoring_assumption_ref`)

// Missing scoring_assumption_ref fails validation
{
  const bad = { ...STARTER_PRODUCT_TYPE_CONFIGS[0], scoring_assumption_ref: '' }
  const result = validateProductTypeConfig(bad)
  assert.equal(result.valid, false)
  assert.ok(result.errors.some((e) => e.includes('scoring_assumption_ref')))
}
console.log('✓ config without scoring_assumption_ref fails registry validation')

// Required starter types resolve
const expectedTypes = [
  { category: 'Kitchen', subcategory: 'Cookware', matrix: 'cookware', scoring: 'cookware' },
  {
    category: 'Kitchen',
    subcategory: 'Drinkware',
    product_type: 'Water bottle',
    matrix: 'water_bottles',
    scoring: 'water-bottles',
  },
  {
    category: 'Kitchen',
    subcategory: 'Drinkware',
    product_type: 'Tumbler',
    matrix: 'drinkware',
    scoring: 'drinkware',
  },
  { category: 'Kitchen', subcategory: 'Food storage', matrix: 'food_storage', scoring: 'food-storage' },
  { category: 'Kitchen', subcategory: 'Utensils', matrix: 'cooking_utensils', scoring: 'utensils' },
  { category: 'Textiles', subcategory: 'Bedding', matrix: 'textiles', scoring: 'textiles' },
  { category: 'Toys', subcategory: 'Infant', matrix: 'infant_oral', scoring: 'childrens' },
  { category: 'Personal care', subcategory: 'Rinse-off', matrix: 'rinse_off', scoring: 'rinse-off' },
]
for (const row of expectedTypes) {
  const config = resolveProductTypeConfig({
    category: row.category,
    subcategory: row.subcategory,
    product_type: row.product_type,
  })
  assert.ok(config, `missing config for ${row.category}/${row.subcategory}/${row.product_type ?? ''}`)
  assert.equal(
    resolveMatrixKeyFromRegistry(row.subcategory, {
      category: row.category,
      product_type: row.product_type,
    }),
    row.matrix,
  )
  const scoringCategory = deriveProductCategory(
    {
      agent_metadata: {
        structured_evidence: {
          product_identity: {
            subcategory: row.subcategory,
            category: row.category,
            product_type: row.product_type,
          },
        },
      },
    },
    { subcategory: row.subcategory, category: row.category, product_type: row.product_type },
  )
  assert.equal(scoringCategory, row.scoring, `${row.category}/${row.subcategory}`)
}
console.log('✓ all starter product types resolve to matrix + scoring category')

// Cookware absorbs Phase 3 fixture refs
{
  const cookware = resolveProductTypeConfig({ subcategory: 'Cookware' })
  assert.ok(cookware.fixture_refs.includes('scripts/test-inert-cookware-canonical.mjs'))
  assert.ok(cookware.fixture_refs.includes('scripts/test-compound-cookware-material.mjs'))
}
console.log('✓ cookware config references Phase 3 canonical fixture scripts')

// Composability — new type via config only (no agent code changes)
{
  const composable = registerProductTypeConfigForTest({
    registry_key: 'test.composable.sample_type',
    category: 'Test',
    subcategory: 'Composable',
    product_type: 'Sample type',
    subcategory_aliases: ['composable_sample'],
    contact_model_refs: ['packaging_only'],
    exposure_modifier_refs: ['wet'],
    component_schema: [{ role_ref: 'packaging', material_class_refs: ['paper_cardboard'] }],
    material_class_refs: ['paper_cardboard'],
    chemical_family_refs: ['unknown_proprietary_additive'],
    claim_family_refs: [],
    required_evidence_fields: ['material.primary_contact_raw'],
    disclosure_rule_refs: [],
    matrix_key: 'cookware',
    source_requirements: ['manufacturer'],
    scoring_assumption_ref: 'v2.3.5.cookware',
    display_template_refs: [],
    fixture_refs: [],
  })
  const hit = resolveProductTypeConfig({ subcategory: 'composable_sample' })
  assert.equal(hit.registry_key, composable.registry_key)
}
console.log('✓ new product type registered by config composition only')

// Unconfigured type blocked at preflight
{
  const blocked = assertProductTypeRegistryConfigured({
    product: { category: 'Electronics', subcategory: 'Gadgets', product_name: 'Test' },
  })
  assert.equal(blocked.ok, false)
  assert.equal(blocked.error, CATEGORY_CONFIG_REQUIRED)
  assert.match(blocked.detail, /category config required/i)
}
console.log('✓ unconfigured product type blocked at preflight (no fallback)')

// Cookware use conditions from registry templates
{
  const options = buildWhyThisScoreOptions(
    { facts: [{ fact_key: 'product_use_case', value: 'Stovetop frying pan with oven use' }] },
    { product_category_default: 'cookware', normal_intended_use: 'Stovetop frying pan with oven use' },
  )
  assert.ok(options.use_conditions_options.includes('Oven heat with fat exposure'))
  assert.ok(options.use_conditions_options.includes('Stovetop heat with fat exposure'))
}
console.log('✓ Agent 2 use-condition templates read from registry')

// Renderer must not import product-type registry
{
  const registryForbidden = 'product-type-registry'
  for (const rel of RENDERER_SCAN_FILES) {
    const content = readFileSync(join(root, rel), 'utf8')
    assert.ok(!content.includes(registryForbidden), `${rel} must not import registry`)
  }
}
console.log('✓ public renderer files do not import product-type registry')

console.log('\nProduct-type registry tests passed')
