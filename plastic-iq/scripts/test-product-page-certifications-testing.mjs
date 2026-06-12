#!/usr/bin/env node
/**
 * Public product page — lab testing vs certification display (hybrid coated fixture pattern).
 * Run: npm run test:product-page-certifications-testing
 */
import assert from 'node:assert/strict'
import { runAgent2NormalizationPipeline } from './agent2/deterministic/pipeline.mjs'
import { buildWhyThisScoreOptions } from './agent2/why-this-score-map.mjs'
import { buildGate1ApprovalEligibilityHexCladV7Evidence } from '../src/shared/agent1/fixtures/gate1ApprovalEligibilityHexCladV7.fixture.mjs'
import {
  publicCertificationsForDisplay,
  isManufacturerLabTestingCertOption,
  CERT_ABSENT_PUBLIC_COATING_FORMULATION,
} from '../src/lib/publicDisclosureGapCopy.ts'
import { CERT_VERIFICATION_ABSENT } from '../src/lib/whyThisScoreVocabulary.ts'
import { assembleAprPublicRenderInput } from '../src/lib/apr/assembleDisplay.ts'
import { transparencyBadgeSummary } from '../src/lib/transparencyBadge.ts'
import { publicSourceDisplayTitle } from '../src/lib/publicProductDisplayContract.ts'
import { showsSaferAlternatives } from '../src/lib/score.ts'

const HYBRID_PRODUCT = {
  product_id: 'fixture-hybrid-public-page',
  product_name: 'ExampleBrand Hybrid Nonstick 10 Inch Frying Pan',
  brand: 'ExampleBrand',
  subcategory: 'Cookware',
  category: 'Kitchen',
  affiliate_link: 'https://www.amazon.com/dp/example',
}

const evidence = buildGate1ApprovalEligibilityHexCladV7Evidence()
evidence.review_status = 'approved'
evidence.agent_metadata.certifications_verified = []

const { inputs } = runAgent2NormalizationPipeline(HYBRID_PRODUCT, evidence)
const whyFields = buildWhyThisScoreOptions(evidence, inputs)

assert.ok(
  whyFields.certifications_options.some((c) => isManufacturerLabTestingCertOption(c)),
  'Gate 2 why-this-score includes manufacturer lab testing option',
)
assert.ok(whyFields.certifications_options.includes(CERT_VERIFICATION_ABSENT))
console.log('✓ Gate 2 fixture emits lab testing + cert-absent options')

const filtered = whyFields.certifications_options.filter((c) => {
  if (isManufacturerLabTestingCertOption(c)) return true
  return c === CERT_VERIFICATION_ABSENT
})
assert.ok(filtered.some((c) => isManufacturerLabTestingCertOption(c)))
assert.ok(filtered.includes(CERT_VERIFICATION_ABSENT))
console.log('✓ raw why-this-score options include lab testing + cert absence')

const shaped = {
  ...whyFields,
  certifications_options: publicCertificationsForDisplay(
    whyFields.certifications_options,
    whyFields.disclosure_quality_options[0],
    whyFields.primary_material_options,
    whyFields.coatings_finishes_options,
  ),
}
const certRows = shaped.certifications_options
assert.ok(certRows.some((c) => /Light Labs Non-Detect/i.test(c)))
assert.ok(certRows.includes(CERT_VERIFICATION_ABSENT))
assert.ok(!certRows.every((c) => /No third-party certification found/i.test(c)))
console.log('✓ public shaping shows lab testing and short cert absence separately')

const collapsed = publicCertificationsForDisplay(
  [CERT_VERIFICATION_ABSENT],
  'Documentation Incomplete',
  ['Proprietary ceramic coating (undisclosed)'],
  ['Proprietary ceramic nonstick (undisclosed)'],
)
assert.equal(collapsed.length, 1)
assert.equal(collapsed[0], CERT_ABSENT_PUBLIC_COATING_FORMULATION)
console.log('✓ without lab testing, legacy combined cert-absence copy remains')

const expanded = publicCertificationsForDisplay(
  [
    CERT_VERIFICATION_ABSENT,
    'Manufacturer-published third-party lab testing (Light Labs Non-Detect for PFOS/PTFE/PFOA/PFAS/PFBS)',
  ],
  'Documentation Incomplete',
  ['Proprietary ceramic coating (undisclosed)'],
  ['Proprietary ceramic nonstick (undisclosed)'],
)
assert.equal(expanded.length, 2)
assert.ok(isManufacturerLabTestingCertOption(expanded[0]))
assert.equal(expanded[1], CERT_VERIFICATION_ABSENT)
console.log('✓ with lab testing, cert absence stays short and separate')

const badge = transparencyBadgeSummary('Documentation Incomplete', {
  coatingFormulaUndisclosed: true,
  hasLabTesting: true,
})
assert.match(badge, /lab testing is available/i)
assert.match(badge, /proprietary coating formula is not fully disclosed/i)
assert.ok(!/minor details \(grade, finish\)/i.test(badge))
console.log('✓ Documentation Incomplete helper copy reflects proprietary formula + lab testing')

const contract = {
  reviewedProductName: HYBRID_PRODUCT.product_name,
  primaryRetailerUrl: HYBRID_PRODUCT.affiliate_link,
  brand: HYBRID_PRODUCT.brand,
}
const mfrTitle = publicSourceDisplayTitle(
  {
    url: 'https://examplebrand.com/collections/fry-pans/products/10-inch-pan',
    title: 'Hybrid',
    public_label: 'Manufacturer',
    public_status: 'supporting',
  },
  contract,
)
assert.equal(mfrTitle, 'ExampleBrand — ExampleBrand Hybrid Nonstick 10 Inch Frying Pan')
assert.ok(!/^Hybrid$/i.test(mfrTitle))
console.log('✓ generic manufacturer title "Hybrid" replaced with brand + product name')

const apr = await assembleAprPublicRenderInput({
  product: HYBRID_PRODUCT,
  evidence,
  pageScore: {
    pac_safety_score: 78,
    tier: 'Good',
    displayed_confidence_range: '75–81',
    transparency_badge: 'Documentation Incomplete',
    ingredient_transparency_score: null,
    explanation_draft: null,
  },
  whyThisScore: shaped,
  productDescription: inputs.product_description ?? 'Example hybrid cookware description.',
  normalizationComponents: inputs.components ?? [],
})

assert.ok(apr)
const certSection = apr.display.why_this_score.sections.find(
  (s) => s.title === 'Certifications & testing',
)
assert.ok(certSection)
const certTexts = certSection.items.map((i) => i.text)
assert.ok(certTexts.some((t) => /Manufacturer-published third-party lab testing/i.test(t)))
assert.ok(certTexts.includes(CERT_VERIFICATION_ABSENT))
assert.equal(apr.score.pac_safety_score, 78)
assert.equal(apr.score.tier, 'Good')
assert.equal(apr.score.transparency_badge, 'Documentation Incomplete')
assert.equal(showsSaferAlternatives(78), false)
console.log('✓ assembled public page includes both cert rows; Good tier hides safer alternatives')

console.log('\nAll product page certifications/testing tests passed.')
