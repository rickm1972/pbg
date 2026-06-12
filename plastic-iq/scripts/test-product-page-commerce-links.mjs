#!/usr/bin/env node
/**
 * Public product page commerce links — exact variant verification only.
 * Run: npm run test:product-page-commerce-links
 */
import assert from 'node:assert/strict'
import {
  evaluatePublicRetailerCtaEligibility,
  publicRetailerLinks,
} from '../src/lib/publicRetailerLinks.ts'
import {
  GREENPAN_PUBLIC_PRODUCT,
  GREENPAN_REVIEWED_NAME,
  buildGreenPanMisclassifiedSourcesEvidence,
} from '../src/lib/fixtures/greenpanPublicPageSources.fixture.ts'
import { buildPublicDisplayContract } from '../src/lib/publicProductDisplayContract.ts'

const evidence = buildGreenPanMisclassifiedSourcesEvidence()
const product = { ...GREENPAN_PUBLIC_PRODUCT, product_name: GREENPAN_REVIEWED_NAME }

const amazon = evaluatePublicRetailerCtaEligibility(product.amazon_url, evidence, product)
assert.equal(amazon.allowed, true, 'Amazon exact listing should remain')
assert.equal(amazon.reason, 'admin_curated_product_link')

const walmart = evaluatePublicRetailerCtaEligibility(product.walmart_url, evidence, product)
assert.equal(walmart.allowed, false, '8-inch Walmart URL must be hidden')
assert.ok(
  walmart.reason === 'admin_url_variant_mismatch' || walmart.reason.startsWith('gate1_exact_url_rejected'),
  `unexpected walmart block reason: ${walmart.reason}`,
)

const target = evaluatePublicRetailerCtaEligibility(product.target_url, evidence, product)
assert.equal(target.allowed, true, 'Target 10-34 Valencia slug should remain (no confirmed mismatch)')

const links = publicRetailerLinks(product, evidence)
assert.equal(links.length, 2, 'Amazon + Target; Walmart 8-inch hidden')
assert.deepEqual(
  links.map((l) => l.id).sort(),
  ['amazon', 'target'],
)

const contract = buildPublicDisplayContract(product, evidence)
assert.match(contract.reviewedProductName, /10/)

console.log('✓ public product page commerce link filtering')
