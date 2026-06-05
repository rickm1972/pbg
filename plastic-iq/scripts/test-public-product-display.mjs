#!/usr/bin/env node
/**
 * Public product page — disclosure copy, buy CTA, source grouping (global rules).
 * Run: npx tsx scripts/test-public-product-display.mjs
 */
import assert from 'node:assert/strict'
import {
  publicCertificationAbsenceCopy,
  publicCertificationOption,
  rewritePublicDescriptionDisclosureGap,
  coatingsFinishesAreNone,
  CERT_ABSENT_PUBLIC_STAINLESS_GRADE,
  CERT_ABSENT_PUBLIC_COATING_FORMULATION,
} from '../src/lib/publicDisclosureGapCopy.ts'
import { CERT_VERIFICATION_ABSENT } from '../src/lib/whyThisScoreVocabulary.ts'
import { orderedRetailerLinks, publicRetailerCtaLabel } from '../src/lib/retailerLinks.ts'
import { buildPublicSourcesFromEvidence } from '../src/lib/publicSourceDisplay.ts'
import { isAmazonHost } from '../src/lib/publicRetailerHostLabels.ts'
import { transparencyBadgeSummary } from '../src/lib/transparencyBadge.ts'

const WS_URL =
  'https://www.williams-sonoma.com/products/all-clad-g5-graphite-fry-pan-lid/'
const MFR_URL = 'https://www.all-clad.com/cookware/collections/g5-graphite-core.html'
const REVIEW_URL = 'https://www.nytimes.com/wirecutter/reviews/best-skillets/'

const stainlessNoneCoatingFields = {
  primary_material_options: ['Stainless steel grade unspecified'],
  secondary_materials_options: ['Graphite structural core'],
  coatings_finishes_options: ['None'],
  use_conditions_options: ['Stovetop heat'],
  disclosure_quality_options: ['Documentation Incomplete'],
  certifications_options: [CERT_VERIFICATION_ABSENT],
}

// A. Disclosure copy — no coating gap when coatings = None
assert.equal(coatingsFinishesAreNone(['None']), true)
const stainlessCertCopy = publicCertificationAbsenceCopy(
  'Documentation Incomplete',
  stainlessNoneCoatingFields.primary_material_options,
  stainlessNoneCoatingFields.coatings_finishes_options,
)
assert.equal(stainlessCertCopy, CERT_ABSENT_PUBLIC_STAINLESS_GRADE)
assert.ok(!/coating formulation/i.test(stainlessCertCopy))
assert.ok(/stainless steel grade\/spec is not fully disclosed/i.test(stainlessCertCopy))
console.log('✓ stainless unspecified + no coating → grade/spec disclosure copy')

const shapedCert = publicCertificationOption(
  CERT_VERIFICATION_ABSENT,
  stainlessNoneCoatingFields.disclosure_quality_options[0],
  stainlessNoneCoatingFields.primary_material_options,
  stainlessNoneCoatingFields.coatings_finishes_options,
)
assert.ok(!/coating formulation/i.test(shapedCert))
assert.ok(/stainless steel grade\/spec/i.test(shapedCert))
console.log('✓ publicCertificationOption aligns cert copy with disclosure gap')

const badgeSummary = transparencyBadgeSummary('Documentation Incomplete')
assert.ok(!/coating formulation/i.test(badgeSummary))
assert.ok(/grade|finish|unconfirmed/i.test(badgeSummary))
console.log('✓ transparency badge summary does not contradict stainless gap')

// Coating gap only when coatings present
const coatingGapCopy = publicCertificationAbsenceCopy(
  'Documentation Incomplete',
  ['Proprietary ceramic coating (undisclosed)'],
  ['Ceramic nonstick sol-gel coating'],
)
assert.equal(coatingGapCopy, CERT_ABSENT_PUBLIC_COATING_FORMULATION)
console.log('✓ coating formulation copy only when coating gap exists')

// Product description rewrite
const legacyDesc =
  "Because the exact coating formulation is not fully disclosed, that uncertainty is reflected in the score and transparency badge."
const fixedDesc = rewritePublicDescriptionDisclosureGap(
  legacyDesc,
  stainlessNoneCoatingFields.primary_material_options,
  stainlessNoneCoatingFields.coatings_finishes_options,
)
assert.ok(!/coating formulation/i.test(fixedDesc))
assert.ok(/stainless steel grade\/spec/i.test(fixedDesc))
console.log('✓ product description disclosure gap rewrite')

// B. Buy CTA — primary retailer host, not manufacturer brand
const wsProduct = {
  brand: 'All-Clad',
  affiliate_link: WS_URL,
  amazon_url: WS_URL,
  target_url: '',
  walmart_url: '',
  other_retailer_label: null,
  other_retailer_url: null,
}
const links = orderedRetailerLinks(wsProduct)
assert.equal(links.length, 1)
assert.equal(links[0].url, WS_URL)
assert.equal(links[0].buyLabel, 'Buy on Williams Sonoma')
assert.equal(publicRetailerCtaLabel(links[0], 'Excellent'), 'Buy on Williams Sonoma')
console.log('✓ primary retailer Williams Sonoma CTA label')

const mfrOnlyProduct = {
  brand: 'Example Brand',
  affiliate_link: 'https://www.examplebrand.com/product',
  amazon_url: 'https://www.examplebrand.com/product',
  target_url: '',
  walmart_url: '',
  other_retailer_label: null,
  other_retailer_url: null,
}
const mfrLinks = orderedRetailerLinks(mfrOnlyProduct)
assert.equal(mfrLinks[0].buyLabel, 'Buy on Example Brand')
console.log('✓ manufacturer-only fallback CTA uses brand when no retailer host')

const amazonProduct = {
  brand: 'Lodge',
  affiliate_link: 'https://www.amazon.com/dp/B00006JSUA',
  amazon_url: 'https://www.amazon.com/dp/B00006JSUA',
  target_url: '',
  walmart_url: '',
  other_retailer_label: null,
  other_retailer_url: null,
}
const amazonLinks = orderedRetailerLinks(amazonProduct)
assert.equal(amazonLinks[0].buyLabel, 'Buy on Amazon')
assert.ok(isAmazonHost(new URL(amazonLinks[0].url).hostname))
console.log('✓ Amazon label only for Amazon host')

// Manufacturer brand must not override WS URL in primary slot
assert.notEqual(links[0].buyLabel, 'Buy on All-Clad')
console.log('✓ manufacturer brand does not override primary retailer CTA')

// C. Source grouping — primary retailer vs context
const evidence = {
  sources: [
    {
      source_type: 'other_retailer',
      url: WS_URL,
      title: 'Williams Sonoma product listing',
    },
    {
      source_type: 'manufacturer',
      url: MFR_URL,
      title: 'All-Clad G5 collection',
    },
    {
      source_type: 'third_party_review',
      url: REVIEW_URL,
      title: 'Wirecutter best skillets',
    },
  ],
  agent_metadata: {
    warnings: [],
    structured_evidence: {
      retailer_links: {
        amazon_url: WS_URL,
        manufacturer_direct_url: MFR_URL,
      },
      canonical_mappings: {
        primary_contact_material_id: {
          canonical_id: 'stainless_steel_unspecified',
          source_url: WS_URL,
        },
        safety_claim_ids: {
          non_toxic_marketing_claim: {
            canonical_id: 'claim_present',
            source_url: REVIEW_URL,
          },
        },
      },
    },
  },
}

const publicSources = buildPublicSourcesFromEvidence(evidence)
const wsSource = publicSources.find((s) => s.url.includes('williams-sonoma'))
const mfrSource = publicSources.find((s) => s.url.includes('all-clad.com'))
const reviewSource = publicSources.find((s) => s.url.includes('nytimes'))

assert.ok(wsSource, 'Williams Sonoma source should be public')
assert.equal(wsSource.public_label, 'Retailer')
assert.equal(wsSource.public_status, 'primary')
assert.ok(/Primary retailer listing/i.test(wsSource.title))
assert.ok(!/Third-party or background context/i.test(wsSource.title))
console.log('✓ primary retailer grouped as Retailer/primary, not Context')

assert.ok(mfrSource)
assert.equal(mfrSource.public_label, 'Manufacturer')
console.log('✓ manufacturer pages stay Manufacturer')

assert.ok(reviewSource)
assert.equal(reviewSource.public_label, 'Context')
console.log('✓ third-party review stays Context')

// D. Cert option helper consistency
assert.equal(
  publicCertificationOption(
    CERT_VERIFICATION_ABSENT,
    'Documentation Incomplete',
    stainlessNoneCoatingFields.primary_material_options,
    stainlessNoneCoatingFields.coatings_finishes_options,
  ),
  CERT_ABSENT_PUBLIC_STAINLESS_GRADE,
)
console.log('✓ publicCertificationOption matches publicCertificationAbsenceCopy')

console.log('\nAll public product display regression tests passed')
