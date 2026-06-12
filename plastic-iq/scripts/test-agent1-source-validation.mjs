#!/usr/bin/env node
/**
 * Agent 1 source validation hardening — manufacturer PDP, authority, lab results, PFOA/PFAS/PTFE.
 * Run: npm run test:agent1-source-validation
 */
import assert from 'node:assert/strict'
import {
  classifyManufacturerUrlKind,
  detectManufacturerRegionMismatch,
  validateManufacturerSource,
  validateManufacturerPdpSet,
} from '../src/shared/agent1/manufacturer-pdp-validation.mjs'
import {
  enforceFactSourceAuthority,
  isOutdatedThirdPartyPtfeContext,
  isThirdPartySource,
  reconcileFactConfidence,
} from '../src/shared/agent1/source-authority.mjs'
import {
  analyzeLabResultRetrieval,
  requiresLabResultRetrieval,
} from '../src/shared/agent1/lab-result-retrieval.mjs'
import {
  applyAgent1SourceValidation,
  scoreDrivingBlobExcludesOutdatedThirdPartyPtfe,
} from '../src/shared/agent1/gate1-source-validation.mjs'
import { inferConfidenceForSafetyClaim } from '../src/shared/canonical-taxonomy/confidence-label-consistency.mjs'
import { applyCanonicalMappings } from '../src/shared/canonical-taxonomy/map-structured-evidence.mjs'
import { detectPatternTriggers } from '../src/shared/required-evidence-matrix/pattern-triggers.mjs'
import { getGate1ContradictionBlockers } from '../src/shared/agent1/gate1-contradiction-blockers.mjs'
import {
  buildHybridManufacturerPdpFailureProduct,
  buildHybridManufacturerPdpFailureSources,
  buildHybridManufacturerPdpFailureStructured,
  FIXTURE_MANUFACTURER_HOMEPAGE,
  FIXTURE_MANUFACTURER_VALID_PDP,
  FIXTURE_MANUFACTURER_WRONG_REGION,
  FIXTURE_RETAILER_PDP,
  FIXTURE_THIRD_PARTY_BLOG,
  FIXTURE_MANUFACTURER_LAB_RESULT,
} from '../src/shared/agent1/fixtures/hybridManufacturerPdpFailure.fixture.mjs'
import {
  applyProvidedSourceIntakePriority,
  listProvidedSourceIntakeEntries,
} from '../src/shared/agent1/provided-source-intake.mjs'
import {
  buildProvidedIntakeHexCladPatternProduct,
  buildProvidedIntakeHexCladPatternDiscoveredSources,
  buildProvidedIntakeHexCladPatternStructuredBeforePriority,
  buildProvidedIntakeHexCladPatternIntakeReport,
  FIXTURE_PROVIDED_MANUFACTURER_PDP,
} from '../src/shared/agent1/fixtures/providedSourceIntakeHexCladPattern.fixture.mjs'
import { buildGate1SourcesReview } from '../src/lib/gate1SourcesReview.ts'
import {
  buildManufacturerPdpExcerpt,
  extractModalEvidenceBlocks,
  textContainsLabModalEvidence,
} from '../src/shared/agent1/manufacturer-pdp-modal-extraction.mjs'
import {
  FIXTURE_MODAL_PDP_HTML,
  buildManufacturerModalLabProduct,
  buildManufacturerModalLabSource,
} from '../src/shared/agent1/fixtures/manufacturerPdpModalLab.fixture.mjs'

const product = buildHybridManufacturerPdpFailureProduct()

// --- Manufacturer PDP validation ---
assert.equal(classifyManufacturerUrlKind('https://examplebrand.com/'), 'homepage')
assert.equal(
  classifyManufacturerUrlKind('https://examplebrand.com/collections/fry-pans'),
  'collection',
)
assert.equal(
  classifyManufacturerUrlKind('https://examplebrand.com/products/10-hybrid-fry-pan'),
  'product_detail',
)
console.log('✓ manufacturer URL kind classification')

assert.equal(detectManufacturerRegionMismatch('https://examplebrand.eu/shop', 'US'), true)
console.log('✓ wrong-region manufacturer detection')

const homepageValidation = validateManufacturerSource(FIXTURE_MANUFACTURER_HOMEPAGE, product)
assert.equal(homepageValidation.passed, false)
assert.equal(homepageValidation.url_kind, 'homepage')
assert.ok(homepageValidation.issues.some((i) => /homepage/i.test(i)))
console.log('✓ homepage fails product PDP validation')

const collectionValidation = validateManufacturerSource(FIXTURE_MANUFACTURER_WRONG_REGION, product)
assert.equal(collectionValidation.passed, false)
assert.ok(collectionValidation.region_mismatch || collectionValidation.url_kind === 'collection')
console.log('✓ collection / wrong-region fails without product materials')

const validPdp = validateManufacturerSource(FIXTURE_MANUFACTURER_VALID_PDP, product)
assert.equal(validPdp.passed, true)
assert.equal(validPdp.supports_material_evidence, true)
console.log('✓ correct manufacturer PDP passes validation')

// --- Source authority ---
assert.ok(isThirdPartySource(FIXTURE_THIRD_PARTY_BLOG, FIXTURE_THIRD_PARTY_BLOG.url))
assert.equal(
  reconcileFactConfidence('manufacturer_confirmed', FIXTURE_THIRD_PARTY_BLOG, FIXTURE_THIRD_PARTY_BLOG.url),
  'third_party_context_source',
)
assert.equal(
  inferConfidenceForSafetyClaim(
    'pfoa_free_claim',
    FIXTURE_THIRD_PARTY_BLOG.url,
    [FIXTURE_THIRD_PARTY_BLOG],
    {},
  ),
  'third_party_context_source',
)
const downgradedFacts = enforceFactSourceAuthority(
  [FIXTURE_THIRD_PARTY_BLOG],
  [{ fact_key: 'primary_material', confidence: 'manufacturer confirmed', source_index: 0 }],
)
assert.equal(downgradedFacts[0].confidence, 'third_party_context_source')
console.log('✓ third-party blog cannot be manufacturer_confirmed')

assert.ok(
  isOutdatedThirdPartyPtfeContext(
    FIXTURE_THIRD_PARTY_BLOG,
    product,
    [FIXTURE_MANUFACTURER_VALID_PDP, FIXTURE_RETAILER_PDP],
  ),
)
const cleanedBlob = scoreDrivingBlobExcludesOutdatedThirdPartyPtfe(
  `${FIXTURE_THIRD_PARTY_BLOG.page_excerpt} ${FIXTURE_MANUFACTURER_VALID_PDP.page_excerpt}`,
  [FIXTURE_THIRD_PARTY_BLOG, FIXTURE_MANUFACTURER_VALID_PDP],
)
assert.ok(!/\bptfe\b/i.test(cleanedBlob) || /\bptfe[-\s]?free\b/i.test(cleanedBlob))
console.log('✓ old third-party PTFE context does not override official PDP blob')

// --- Lab-result retrieval ---
const structured = buildHybridManufacturerPdpFailureStructured()
const sourcesWeak = [
  FIXTURE_RETAILER_PDP,
  FIXTURE_MANUFACTURER_HOMEPAGE,
  FIXTURE_THIRD_PARTY_BLOG,
]
const mappingsWeak = applyCanonicalMappings(structured, sourcesWeak)
structured.canonical_mappings = mappingsWeak
assert.ok(requiresLabResultRetrieval(mappingsWeak, structured))
const labWeak = analyzeLabResultRetrieval(sourcesWeak, structured)
assert.ok(labWeak.codes.includes('NO_THIRD_PARTY_TESTING_FOUND'))
console.log('✓ coated product triggers lab-result requirement')

const sourcesStrong = buildHybridManufacturerPdpFailureSources()
const mappingsStrong = applyCanonicalMappings(structured, sourcesStrong)
structured.canonical_mappings = mappingsStrong
const labStrong = analyzeLabResultRetrieval(sourcesStrong, structured)
assert.equal(labStrong.retrieved_lab_result, true)
assert.ok(labStrong.lab_sources.some((s) => s.classification?.includes('lab')))
console.log('✓ retrieved lab result classified')

// --- Gate 1 source validation blockers ---
const weakValidation = applyAgent1SourceValidation(structured, sourcesWeak, product)
assert.ok(
  weakValidation.blockers.some((b) => b.includes('MANUFACTURER_MATERIAL_EVIDENCE_MISSING')),
)
assert.ok(weakValidation.search_suggestions.length >= 3)
console.log('✓ identity-only manufacturer URL surfaces loud blocker + search suggestions')

structured.retailer_links.manufacturer_direct_url = FIXTURE_MANUFACTURER_VALID_PDP.url
const strongValidation = applyAgent1SourceValidation(structured, sourcesStrong, product)
assert.ok(!strongValidation.blockers.some((b) => b.includes('MANUFACTURER_MATERIAL_EVIDENCE_MISSING')))
console.log('✓ validated manufacturer PDP clears material-evidence blocker')

// --- Canonical hybrid mapping preserved ---
assert.equal(
  mappingsStrong.primary_contact_material_id?.canonical_id,
  'hybrid_stainless_nonstick_food_contact',
)
assert.equal(
  mappingsStrong.coating_modifier_id?.canonical_id,
  'proprietary_nonstick_coating_undisclosed',
)
assert.equal(mappingsStrong.substrate_material_id?.canonical_id, 'stainless_steel_body')
const pfasStrong = mappingsStrong.pfas_status_id?.canonical_id
assert.ok(
  pfasStrong === 'pfas_not_disclosed' || pfasStrong === 'pfas_free_claimed',
  `unexpected PFAS status: ${pfasStrong}`,
)
assert.notEqual(pfasStrong, 'pfas_not_present_inert_material')
assert.notEqual(pfasStrong, 'pfas_present_disclosed')
console.log('✓ hybrid coated cookware canonical rows preserved (no inert/present-disclosed collapse)')

const triggers = detectPatternTriggers(structured, mappingsStrong, sourcesStrong)
assert.ok(triggers.has('coated_nonstick_lab_results'))
assert.ok(triggers.has('pfoa_pfas_distinction'))
console.log('✓ pattern triggers include lab-results + PFOA/PFAS distinction')

structured.agent1_source_validation = {
  blockers: weakValidation.blockers,
  warnings: weakValidation.warnings,
}
const gateBlockers = getGate1ContradictionBlockers(structured)
assert.ok(gateBlockers.some((b) => b.includes('MANUFACTURER_MATERIAL_EVIDENCE_MISSING')))
console.log('✓ Gate 1 contradiction blockers surface source-validation blockers')

// --- Provided source intake priority (HexClad pattern, no product_id) ---
const intakeProduct = buildProvidedIntakeHexCladPatternProduct()
const intakeEntries = listProvidedSourceIntakeEntries(intakeProduct)
assert.ok(intakeEntries.some((e) => e.role === 'manufacturer_product'))
assert.ok(intakeEntries.some((e) => e.role === 'amazon_evidence'))

const intakeStructured = buildProvidedIntakeHexCladPatternStructuredBeforePriority()
const intakeSources = buildProvidedIntakeHexCladPatternDiscoveredSources()
const intakeReport = buildProvidedIntakeHexCladPatternIntakeReport()
const intakeApplied = applyProvidedSourceIntakePriority(
  intakeStructured,
  intakeSources,
  intakeProduct,
  intakeReport,
)
assert.equal(
  intakeApplied.structured.retailer_links.manufacturer_direct_url,
  FIXTURE_PROVIDED_MANUFACTURER_PDP.url,
)
const intakeValidation = applyAgent1SourceValidation(
  intakeApplied.structured,
  intakeApplied.sources,
  intakeProduct,
  [],
  { providedSourceIntake: intakeApplied.intakeReport },
)
assert.ok(intakeValidation.blockers.length === 0 || intakeApplied.intakeReport.entries.length > 0)
console.log('✓ provided manufacturer PDP prioritized over wrong-region discovered URL')

const gate1Model = buildGate1SourcesReview({
  evidence_id: 'fixture',
  product_id: 'fixture',
  bundle_version: 1,
  review_status: 'pending_review',
  sources: intakeApplied.sources,
  facts: [],
  agent_metadata: {
    structured_evidence: {
      ...intakeApplied.structured,
      agent1_source_validation: {
        provided_source_intake: intakeApplied.intakeReport,
      },
    },
  },
})
assert.ok(gate1Model.providedIntake.length >= 2)
assert.ok(gate1Model.allRows.some((r) => r.url === FIXTURE_PROVIDED_MANUFACTURER_PDP.url))
console.log('✓ provided URL appears in Gate 1 source list with intake section')

// --- Manufacturer PDP modal/dialog lab evidence ---
const modalExcerpt = buildManufacturerPdpExcerpt(FIXTURE_MODAL_PDP_HTML)
assert.ok(modalExcerpt.has_lab_modal_evidence)
assert.ok(extractModalEvidenceBlocks(FIXTURE_MODAL_PDP_HTML).some((b) => b.kind === 'lab_modal'))
assert.ok(textContainsLabModalEvidence(modalExcerpt.combined_excerpt))
const modalSource = buildManufacturerModalLabSource()
const modalLab = analyzeLabResultRetrieval(
  [FIXTURE_RETAILER_PDP, modalSource],
  { ...structured, canonical_mappings: mappingsStrong },
)
assert.equal(modalLab.retrieved_lab_result, true)
assert.ok(!modalLab.codes.includes('NO_THIRD_PARTY_TESTING_FOUND'))
const modalProduct = buildManufacturerModalLabProduct()
const modalValidation = validateManufacturerSource(modalSource, modalProduct)
assert.equal(modalValidation.passed, true)
assert.equal(modalValidation.supports_material_evidence, true)
console.log('✓ manufacturer PDP modal lab evidence extracted and classified')

console.log('\nAgent 1 source validation tests passed.')
