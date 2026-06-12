#!/usr/bin/env node
/**
 * GreenPan LeafScore review must not satisfy coated_product_lab_results.
 * Run: npm run test:greenpan-lab-evidence-classification
 */
import assert from 'node:assert/strict'
import { classifyLabResultSource, isThirdPartySource } from '../src/shared/agent1/source-authority.mjs'
import {
  analyzeLabResultRetrieval,
  requiresLabResultRetrieval,
} from '../src/shared/agent1/lab-result-retrieval.mjs'
import { hasActualLabReportEvidence, labMentionIsNegatedOrInsufficient } from '../src/shared/agent1/lab-report-evidence.mjs'
import { applyCanonicalMappings } from '../src/shared/canonical-taxonomy/map-structured-evidence.mjs'
import { extractManufacturerPublishedLabTesting } from '../src/shared/agent2/manufacturer-lab-testing-evidence.mjs'
import { buildManufacturerModalLabSource } from '../src/shared/agent1/fixtures/manufacturerPdpModalLab.fixture.mjs'
import {
  buildGreenPanLeafscoreSource,
  buildGreenPanV4LabStructuredEvidence,
  GREENPAN_LEAFSCORE_EXCERPT,
} from '../src/shared/agent1/fixtures/greenpanLeafscoreLab.fixture.mjs'
import {
  buildGreenPanFaqSource,
  GREENPAN_FAQ_EXCERPT,
} from '../src/shared/agent1/fixtures/greenpanFaqLab.fixture.mjs'

const leaf = buildGreenPanLeafscoreSource()

assert.ok(labMentionIsNegatedOrInsufficient(GREENPAN_LEAFSCORE_EXCERPT))
assert.equal(hasActualLabReportEvidence(GREENPAN_LEAFSCORE_EXCERPT), false)
assert.equal(classifyLabResultSource(leaf, leaf.url), null)
assert.ok(isThirdPartySource(leaf, leaf.url))
console.log('✓ LeafScore GreenPan review is not lab report evidence')

const faq = buildGreenPanFaqSource()
assert.equal(hasActualLabReportEvidence(GREENPAN_FAQ_EXCERPT, { url: faq.url }), false)
assert.equal(classifyLabResultSource(faq, faq.url), null)
console.log('✓ GreenPan FAQ toxins page is not lab report evidence')

const structured = buildGreenPanV4LabStructuredEvidence()
const amazon = {
  source_type: 'amazon',
  url: structured.retailer_links.amazon_url,
  title: 'GreenPan Valencia Pro Ceramic Nonstick 10 Inch Fry Pan',
  page_excerpt: 'Thermolon Minerals Pro ceramic nonstick. Hard anodized aluminum. PFOA free PFAS free.',
}
const sources = [amazon, leaf, faq]
const mappings = applyCanonicalMappings(structured, sources)
structured.canonical_mappings = mappings

assert.equal(mappings.primary_contact_material_id?.canonical_id, 'ceramic_nonstick_sol_gel_coating')
assert.equal(mappings.substrate_material_id?.canonical_id, 'hard_anodized_aluminum')
console.log('✓ GreenPan taxonomy remains ceramic + hard-anodized')

assert.ok(requiresLabResultRetrieval(mappings, structured))
const analysis = analyzeLabResultRetrieval(sources, structured)
assert.equal(analysis.retrieved_lab_result, false)
assert.ok(analysis.codes.includes('NO_THIRD_PARTY_TESTING_FOUND'))
assert.equal(analysis.lab_sources.length, 0)
console.log('✓ LeafScore-only sources → NO_THIRD_PARTY_TESTING_FOUND')

const gate1Evidence = {
  sources,
  agent_metadata: {
    structured_evidence: {
      ...structured,
      required_check_results: [
        {
          check_id: 'external.coated_product_lab_results',
          status: 'failed',
          detail: 'NO_THIRD_PARTY_TESTING_FOUND: targeted lab-result search did not retrieve PFAS/PTFE test evidence for coated product claims.',
          source_url: null,
        },
      ],
    },
  },
}
const labExtract = extractManufacturerPublishedLabTesting(gate1Evidence)
assert.equal(labExtract.testing_evidence_present, false)
console.log('✓ Gate 2 lab carry-forward absent without verified lab report')

const hexModal = buildManufacturerModalLabSource()
assert.equal(
  classifyLabResultSource(hexModal, hexModal.url),
  'manufacturer_published_third_party_lab_result',
)
const hexAnalysis = analyzeLabResultRetrieval([hexModal], structured)
assert.equal(hexAnalysis.retrieved_lab_result, true)
assert.ok(hexAnalysis.lab_sources.some((s) => s.classification === 'manufacturer_published_third_party_lab_result'))
console.log('✓ HexClad Light Labs modal still classified as manufacturer-published lab testing')

console.log('\nGreenPan lab evidence classification tests passed.')
