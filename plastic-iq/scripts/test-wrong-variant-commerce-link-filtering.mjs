#!/usr/bin/env node
/**
 * Wrong-variant commerce links hidden from public product listings.
 * Run: npm run test:wrong-variant-commerce-link-filtering
 */
import assert from 'node:assert/strict'
import {
  retailerListingHasConfirmedVariantMismatch,
  extractInchSizes,
} from '../src/lib/retailerVariantMatch.ts'
import { evaluatePublicRetailerCtaEligibility } from '../src/lib/publicRetailerLinks.ts'

const GREENPAN_NAME = 'GreenPan Valencia Pro Ceramic Nonstick 10\u201d Frying Pan Skillet with Lid'
const WALMART_8 =
  'https://www.walmart.com/ip/GreenPan-Valencia-Pro-Healthy-Ceramic-Nonstick-8-Fry-Pan/371763910'
const TARGET_AMBIG =
  'https://www.target.com/p/greenpan-valencia-pro-10-34-ceramic-frypan-with-lid-black/-/A-86482934'
const AMAZON_10 =
  'https://www.amazon.com/GreenPan-CC000670-001-Valencia-Toxin-Free-Dishwasher/dp/B074CVZ7MM'

assert.deepEqual(extractInchSizes(GREENPAN_NAME), [10])
assert.equal(retailerListingHasConfirmedVariantMismatch(GREENPAN_NAME, WALMART_8, ''), true)
assert.equal(retailerListingHasConfirmedVariantMismatch(GREENPAN_NAME, TARGET_AMBIG, ''), false)

const product = {
  product_name: GREENPAN_NAME,
  amazon_url: AMAZON_10,
  walmart_url: WALMART_8,
  target_url: TARGET_AMBIG,
}
assert.equal(evaluatePublicRetailerCtaEligibility(AMAZON_10, null, product).allowed, true)
assert.equal(evaluatePublicRetailerCtaEligibility(WALMART_8, null, product).allowed, false)
assert.equal(evaluatePublicRetailerCtaEligibility(TARGET_AMBIG, null, product).allowed, true)

console.log('✓ wrong-variant commerce link filtering')
