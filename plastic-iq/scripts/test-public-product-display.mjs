#!/usr/bin/env node
/**
 * Public product page — display contract, disclosure, CTA, source grouping.
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
import {
  applyPublicDisplayContractToSources,
  applyPublicSecondaryMaterialsToFields,
  buildPublicDisplayContract,
  heuristicPublicSourcesFromRaw,
  manufacturerTitleConflictsReviewedIdentity,
  publicSecondaryMaterialLabels,
  publicSourceDisplayTitle,
} from '../src/lib/publicProductDisplayContract.ts'
import {
  filterPublicSourcesByContractEligibility,
  resolvePublicSourceContractEligibility,
} from '../src/lib/publicSourceEligibility.ts'
import {
  applyPublicMaterialLabelsToWhyThisScore,
  humanizePublicContactMaterialDisplay,
  humanizePublicMaterialLabel,
  humanizePublicMaterialProse,
} from '../src/lib/publicMaterialProse.ts'
import { softenPublicDescription } from '../src/lib/publicProductDisplay.ts'
import {
  containsPublicSizeArtifact,
  isFilenameLikeSourceTitle,
  isMalformedPublicSourceTitle,
  manufacturerFallbackTitleFromUrl,
  sanitizePublicSourceTitleText,
} from '../src/lib/publicSourceTitleFormat.ts'

const WS_URL =
  'https://www.williams-sonoma.com/products/all-clad-g5-graphite-fry-pan-lid/'
const MFR_URL = 'https://www.all-clad.com/cookware/collections/g5-graphite-core.html'
const REVIEW_URL = 'https://www.nytimes.com/wirecutter/reviews/best-skillets/'

const REVIEWED_NAME =
  'All-Clad G5 Graphite Core Stainless-Steel Fry Pan with Lid, 12 inch'
const MFR_VARIANT_TITLE =
  'G5 graphite core stainless steel 5-ply bonded, skillet with lid, 12.5 inch'

const MFR_PRODUCT_PAGE =
  'https://www.all-clad.com/products/g5-graphite-core-5-ply-bonded-cookware-skillet-with-lid-12-5-inch.html'

const contract = {
  reviewedProductName: REVIEWED_NAME,
  primaryRetailerUrl: WS_URL,
  brand: 'All-Clad',
}

const stainlessNoneCoatingFields = {
  primary_material_options: ['Stainless steel grade unspecified'],
  secondary_materials_options: ['Aluminum core'],
  coatings_finishes_options: ['None'],
  use_conditions_options: ['Stovetop heat'],
  disclosure_quality_options: ['Documentation Incomplete'],
  certifications_options: [CERT_VERIFICATION_ABSENT],
}

const graphiteAluminumComponents = [
  { material_id: 'graphite_core', component_role: 'structural', material_hazard: 0.02 },
  { material_id: 'aluminum_core', component_role: 'structural', material_hazard: 0.22 },
]

// A. Secondary materials — both cores from normalized components
const secondaryLabels = publicSecondaryMaterialLabels(stainlessNoneCoatingFields, graphiteAluminumComponents)
assert.ok(secondaryLabels.includes('Graphite core'), `missing Graphite core: ${secondaryLabels}`)
assert.ok(secondaryLabels.includes('Aluminum core'), `missing Aluminum core: ${secondaryLabels}`)
const mergedFields = applyPublicSecondaryMaterialsToFields(stainlessNoneCoatingFields, graphiteAluminumComponents)
assert.ok(mergedFields.secondary_materials_options.includes('Graphite core'))
assert.ok(mergedFields.secondary_materials_options.includes('Aluminum core'))
console.log('✓ secondary materials include graphite + aluminum cores')

// B. Variant-mismatched manufacturer sources are ineligible — not renamed for public display
assert.equal(
  manufacturerTitleConflictsReviewedIdentity(MFR_VARIANT_TITLE, REVIEWED_NAME),
  true,
)

const mismatchedMfrEligibility = resolvePublicSourceContractEligibility(
  {
    url: MFR_PRODUCT_PAGE,
    title: MFR_VARIANT_TITLE,
    public_label: 'Manufacturer',
    public_status: 'supporting',
    source_type: 'manufacturer',
  },
  contract,
)
assert.equal(mismatchedMfrEligibility.public_source_eligible, false)
assert.match(
  mismatchedMfrEligibility.hide_reason ?? '',
  /different.*variant/i,
)

const mismatchedCollectionTitleEligibility = resolvePublicSourceContractEligibility(
  {
    url: MFR_URL,
    title: `Manufacturer product page: ${MFR_VARIANT_TITLE}`,
    public_label: 'Manufacturer',
    public_status: 'supporting',
    source_type: 'manufacturer',
  },
  contract,
)
assert.equal(mismatchedCollectionTitleEligibility.public_source_eligible, false)
console.log('✓ variant-mismatched manufacturer/context sources are not public_source_eligible')

const neutralCollectionTitle = publicSourceDisplayTitle(
  {
    url: MFR_URL,
    title: 'G5 Graphite Core cookware collection',
    public_label: 'Manufacturer',
    public_status: 'supporting',
  },
  contract,
)
assert.ok(/G5 Graphite Core/i.test(neutralCollectionTitle))
assert.ok(!/12\.5\s*inch/i.test(neutralCollectionTitle))
assert.ok(!/construction page/i.test(neutralCollectionTitle))
console.log('✓ eligible manufacturer collection keeps clean title')

const filteredMfrProductPage = filterPublicSourcesByContractEligibility(
  [
    {
      source_type: 'manufacturer',
      url: MFR_PRODUCT_PAGE,
      title: MFR_VARIANT_TITLE,
      public_label: 'Manufacturer',
      public_status: 'supporting',
    },
  ],
  contract,
)
assert.equal(filteredMfrProductPage.length, 0)
assert.equal(
  manufacturerFallbackTitleFromUrl(MFR_PRODUCT_PAGE, 'All-Clad'),
  'All-Clad G5 Graphite Core cookware construction page',
)
console.log('✓ variant-mismatched manufacturer product page filtered — not renamed to hide mismatch')

const htmlFilenameTitle = publicSourceDisplayTitle(
  {
    url: MFR_URL,
    title: 'G5 Graphite Core.html',
    public_label: 'Manufacturer',
    public_status: 'supporting',
  },
  contract,
)
assert.ok(!/\.html/i.test(htmlFilenameTitle))
assert.ok(/G5 Graphite Core cookware collection/i.test(htmlFilenameTitle))
console.log('✓ filename-like manufacturer titles use URL fallback')

const malformedSanitized = sanitizePublicSourceTitleText(
  'G5 graphite core stainless steel 5-ply bonded, skillet with lid, 12.5 inch',
)
assert.ok(!/12\.5\s*inch/i.test(malformedSanitized))
assert.ok(!isMalformedPublicSourceTitle(malformedSanitized))
console.log('✓ source title sanitizer removes dangling punctuation')

assert.equal(
  manufacturerFallbackTitleFromUrl(MFR_URL, 'All-Clad'),
  'All-Clad G5 Graphite Core cookware collection',
)
assert.equal(isFilenameLikeSourceTitle('G5 Graphite Core.html'), true)
console.log('✓ source title sanitizer and fallbacks')

const uglyManufacturerEligibility = resolvePublicSourceContractEligibility(
  {
    url: MFR_PRODUCT_PAGE,
    title: 'G5 Graphite Core 5 Ply Bonded Cookware Skillet With Lid 12 5 Inch page',
    public_label: 'Manufacturer',
    public_status: 'supporting',
    source_type: 'manufacturer',
  },
  contract,
)
assert.equal(uglyManufacturerEligibility.public_source_eligible, false)
assert.ok(containsPublicSizeArtifact('12 5 Inch page'))
console.log('✓ manufacturer product-page slug filtered from public display (not vague rename)')

const wsTitle = publicSourceDisplayTitle(
  {
    url: WS_URL,
    title: 'Williams Sonoma product listing',
    public_label: 'Retailer',
    public_status: 'primary',
  },
  contract,
)
assert.ok(wsTitle.includes('Williams Sonoma'))
assert.ok(wsTitle.includes(REVIEWED_NAME))
assert.ok(!/Primary retailer listing/i.test(wsTitle))
console.log('✓ primary retailer label includes retailer name and reviewed title')

// C. Disclosure copy
assert.equal(coatingsFinishesAreNone(['None']), true)
const stainlessCertCopy = publicCertificationAbsenceCopy(
  'Documentation Incomplete',
  stainlessNoneCoatingFields.primary_material_options,
  stainlessNoneCoatingFields.coatings_finishes_options,
)
assert.equal(stainlessCertCopy, CERT_ABSENT_PUBLIC_STAINLESS_GRADE)
assert.ok(!/coating formulation/i.test(stainlessCertCopy))
console.log('✓ stainless grade/spec disclosure copy')

const coatingGapCopy = publicCertificationAbsenceCopy(
  'Documentation Incomplete',
  ['Proprietary ceramic coating (undisclosed)'],
  ['Ceramic nonstick sol-gel coating'],
)
assert.equal(coatingGapCopy, CERT_ABSENT_PUBLIC_COATING_FORMULATION)
console.log('✓ coating formulation copy only when coating gap exists')

// D. Buy CTA
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
assert.equal(links[0].buyLabel, 'Buy on Williams Sonoma')
assert.notEqual(links[0].buyLabel, 'Buy on All-Clad')
console.log('✓ primary retailer Williams Sonoma CTA')

// E. Source grouping with Gate 1 evidence + display contract
const evidence = {
  sources: [
    { source_type: 'other_retailer', url: WS_URL, title: 'Williams Sonoma product listing' },
    { source_type: 'manufacturer', url: MFR_URL, title: 'G5 Graphite Core cookware collection' },
    { source_type: 'manufacturer', url: MFR_PRODUCT_PAGE, title: MFR_VARIANT_TITLE },
    { source_type: 'third_party_review', url: REVIEW_URL, title: 'Wirecutter best skillets' },
  ],
  agent_metadata: {
    warnings: [],
    structured_evidence: {
      product_identity: { product_name: REVIEWED_NAME },
      retailer_links: { amazon_url: WS_URL, manufacturer_direct_url: MFR_URL },
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

const builtContract = buildPublicDisplayContract(
  { product_name: REVIEWED_NAME, brand: 'All-Clad', affiliate_link: WS_URL, amazon_url: WS_URL },
  evidence,
)
assert.equal(builtContract.reviewedProductName, REVIEWED_NAME)
assert.equal(builtContract.primaryRetailerUrl, WS_URL)

const publicSources = buildPublicSourcesFromEvidence(evidence, builtContract)
const wsSource = publicSources.find((s) => s.url.includes('williams-sonoma'))
const mfrSource = publicSources.find((s) => s.url.includes('all-clad.com/cookware/collections'))
const mfrProductPage = publicSources.find((s) => s.url.includes('12-5-inch'))
const reviewSource = publicSources.find((s) => s.url.includes('nytimes'))

assert.equal(wsSource?.public_label, 'Retailer')
assert.equal(wsSource?.public_status, 'primary')
assert.ok(wsSource?.title.includes('Williams Sonoma'))
assert.ok(wsSource?.title.includes(REVIEWED_NAME))
assert.ok(!/Third-party or background context/i.test(wsSource?.title ?? ''))
console.log('✓ primary retailer under Retailer/primary with reviewed identity')

assert.equal(mfrSource?.public_label, 'Manufacturer')
assert.ok(!/12\.5\s*inch/i.test(mfrSource?.title ?? ''))
assert.equal(mfrProductPage, undefined, '12.5-inch manufacturer product page must not render publicly')
console.log('✓ eligible manufacturer collection shown; variant-mismatched product page filtered')

assert.equal(reviewSource?.public_label, 'Context')
console.log('✓ third-party review stays Context')

// F. Heuristic fallback — WS not grouped as generic Context
const heuristic = heuristicPublicSourcesFromRaw(
  [
    { source_type: 'other_retailer', url: WS_URL, title: 'WS listing' },
    { source_type: 'manufacturer', url: MFR_URL, title: 'G5 Graphite Core cookware collection' },
    { source_type: 'manufacturer', url: MFR_PRODUCT_PAGE, title: MFR_VARIANT_TITLE },
  ],
  contract,
)
const heuristicWs = heuristic.find((s) => s.url.includes('williams-sonoma'))
assert.equal(heuristicWs?.public_label, 'Retailer')
assert.equal(heuristicWs?.public_status, 'primary')
assert.ok(!heuristic.some((s) => s.url.includes('12-5-inch')))
console.log('✓ heuristic fallback promotes primary retailer host and filters mismatched manufacturer pages')

const upgraded = applyPublicDisplayContractToSources(
  [
    {
      source_type: 'other_retailer',
      url: WS_URL,
      title: 'Context source: WS',
      public_label: 'Context',
      public_status: 'context',
    },
  ],
  contract,
)
assert.equal(upgraded[0].public_label, 'Retailer')
assert.equal(upgraded[0].public_status, 'primary')
console.log('✓ display contract upgrades mislabeled primary retailer rows')

assert.equal(
  publicCertificationOption(
    CERT_VERIFICATION_ABSENT,
    'Documentation Incomplete',
    stainlessNoneCoatingFields.primary_material_options,
    stainlessNoneCoatingFields.coatings_finishes_options,
  ),
  CERT_ABSENT_PUBLIC_STAINLESS_GRADE,
)
assert.ok(!/coating formulation/i.test(transparencyBadgeSummary('Documentation Incomplete')))
console.log('✓ disclosure badge/copy consistency')

const dbProse =
  'All-Clad uses stainless steel grade unspecified as its food-contact surface.'
const humanProse = humanizePublicMaterialProse(softenPublicDescription(dbProse))
assert.ok(/stainless steel of unspecified grade/i.test(humanProse))
assert.ok(!/stainless steel grade unspecified/i.test(humanProse))
assert.ok(!/stainless steel \(grade unspecified\)/i.test(humanProse))

const parentheticalProse =
  'The food-contact surface is stainless steel (grade unspecified) bonded to an aluminum core.'
const pipelineProse = humanizePublicMaterialProse(
  rewritePublicDescriptionDisclosureGap(
    softenPublicDescription(parentheticalProse),
    stainlessNoneCoatingFields.primary_material_options,
    stainlessNoneCoatingFields.coatings_finishes_options,
  ),
)
assert.ok(/stainless steel of unspecified grade/i.test(pipelineProse))
assert.ok(!/stainless steel \(grade unspecified\)/i.test(pipelineProse))
assert.ok(!/stainless steel grade unspecified/i.test(pipelineProse))
console.log('✓ public description uses human-readable material phrasing')

assert.equal(
  humanizePublicMaterialLabel('Stainless steel grade unspecified'),
  'Stainless steel of unspecified grade',
)
assert.equal(
  humanizePublicMaterialLabel('stainless steel (grade unspecified)'),
  'Stainless steel of unspecified grade',
)
const labeledWhy = applyPublicMaterialLabelsToWhyThisScore({
  ...stainlessNoneCoatingFields,
  primary_material_options: ['Stainless steel grade unspecified'],
})
assert.equal(
  labeledWhy.primary_material_options[0],
  'Stainless steel of unspecified grade',
)
assert.equal(
  humanizePublicContactMaterialDisplay('Stainless steel grade unspecified'),
  'Stainless steel of unspecified grade',
)
console.log('✓ human-readable material labels in Why This Score and contact material')

console.log('\nAll public product display regression tests passed')
