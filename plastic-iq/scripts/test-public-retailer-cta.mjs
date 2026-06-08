#!/usr/bin/env node
/**
 * Public retailer CTA — admin product fields are source of truth.
 * Run: npx tsx scripts/test-public-retailer-cta.mjs
 */
import assert from 'node:assert/strict'
import {
  evaluatePublicRetailerCtaEligibility,
  isAdminProductRetailerUrl,
  isExactUrlExplicitlyRejectedInGate1,
} from '../src/lib/publicRetailerLinks.ts'
import { retailerListingMatchesProductVariant, retailerListingHasConfirmedVariantMismatch } from '../src/lib/retailerVariantMatch.ts'
import { publicRetailerSectionTitle } from '../src/lib/publicProductDisplay.ts'
import { publicRetailerCtaLabel, usePublicRetailerMutedStyle } from '../src/lib/retailerLinks.ts'

const TFAL_NAME =
  'T-Fal Ultimate Hard Anodized Nonstick Fry Pan Set 3 Piece: 8, 10.25, 12 inch'
const LODGE_NAME = 'Lodge 10.25 Inch Cast Iron Skillet'

const lodgeProduct = {
  product_name: LODGE_NAME,
  affiliate_link: 'https://www.amazon.com/Lodge-Skillet/dp/B00006JSUA',
  amazon_url: 'https://www.amazon.com/Lodge-Skillet/dp/B00006JSUA',
  target_url: 'https://www.target.com/p/lodge-10-25-cast-iron-skillet/-/A-10291925',
  walmart_url: 'https://www.walmart.com/ip/Lodge-Cast-Iron-Seasoned-12-Skillet/5969628',
}

function evidenceWithUrls({ sources, warnings = [] }) {
  return {
    sources,
    agent_metadata: { warnings, structured_evidence: { retailer_links: {} } },
  }
}

assert.equal(isExactUrlExplicitlyRejectedInGate1({ usageStatus: 'mismatch', section: 'rejected_mismatch' }), true)
assert.equal(isExactUrlExplicitlyRejectedInGate1({ usageStatus: 'supporting', section: 'other_context' }), false)

const amazonPrimary = evidenceWithUrls({
  sources: [
    { source_type: 'amazon', url: 'https://www.amazon.com/dp/B000AMAZON', title: 'Amazon' },
    {
      source_type: 'target',
      url: 'https://www.target.com/p/simply-cook-12-5',
      title: 'Target Simply Cook 12.5',
    },
  ],
  warnings: [
    'Target URL mismatch — different product line: https://www.target.com/p/simply-cook-12-5',
  ],
})

const tfalProduct = {
  product_name: TFAL_NAME,
  amazon_url: 'https://www.amazon.com/dp/B000AMAZON',
  target_url: 'https://www.target.com/p/simply-cook-12-5',
}

assert.equal(
  evaluatePublicRetailerCtaEligibility(tfalProduct.amazon_url, amazonPrimary, tfalProduct).reason,
  'admin_curated_product_link',
)
const tfalTarget = evaluatePublicRetailerCtaEligibility(
  tfalProduct.target_url,
  amazonPrimary,
  tfalProduct,
)
assert.equal(tfalTarget.allowed, false, 'admin Target blocked when exact URL rejected or wrong variant')
assert.ok(
  /gate1_exact_url_rejected/.test(tfalTarget.reason),
  `unexpected reason: ${tfalTarget.reason}`,
)

assert.equal(
  evaluatePublicRetailerCtaEligibility(lodgeProduct.target_url, null, lodgeProduct).allowed,
  true,
  'admin Target allowed without Gate 1 primary evidence',
)
assert.equal(
  evaluatePublicRetailerCtaEligibility(lodgeProduct.amazon_url, null, lodgeProduct).allowed,
  true,
)

const lodgeWalmart = evaluatePublicRetailerCtaEligibility(
  lodgeProduct.walmart_url,
  null,
  lodgeProduct,
)
assert.equal(lodgeWalmart.allowed, true, 'admin walmart_url always allowed unless Gate 1 rejects exact URL')
assert.equal(lodgeWalmart.reason, 'admin_curated_product_link')

assert.equal(publicRetailerSectionTitle('Excellent'), 'Where to buy')
assert.equal(publicRetailerSectionTitle('Caution'), 'Product listings')
assert.equal(publicRetailerSectionTitle('High Risk'), 'Product listings')

const link = { id: 'amazon', url: 'x', buyLabel: 'Buy on Amazon', viewLabel: 'View on Amazon' }
assert.equal(publicRetailerCtaLabel(link, 'Excellent', false), 'Buy on Amazon')
assert.equal(publicRetailerCtaLabel(link, 'High Risk', true), 'View on Amazon')
assert.equal(usePublicRetailerMutedStyle('Caution'), true)
assert.equal(usePublicRetailerMutedStyle('Excellent'), false)

assert.equal(
  retailerListingMatchesProductVariant(
    LODGE_NAME,
    'https://www.target.com/p/lodge-10-25-cast-iron-skillet/-/A-10291925',
    '',
    { strictMissingSize: false },
  ),
  true,
)

assert.equal(
  retailerListingHasConfirmedVariantMismatch(
    LODGE_NAME,
    'https://www.walmart.com/ip/Lodge-10-1-4-Cast-Iron-Skillet/596962815',
  ),
  false,
  'Lodge 10-1-4 Walmart slug matches 10.25″ product',
)
assert.equal(
  retailerListingHasConfirmedVariantMismatch(
    LODGE_NAME,
    'https://www.walmart.com/ip/Lodge-Cast-Iron-Seasoned-12-Skillet/5969628',
  ),
  true,
  'Lodge 12″ Walmart slug is confirmed mismatch for 10.25″ product',
)

console.log('✓ admin-first public retailer CTA rules')
