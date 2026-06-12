#!/usr/bin/env node
/**
 * Manufacturer FAQ / marketing safety pages must not satisfy coated_product_lab_results.
 * Run: npm run test:faq-lab-evidence-rejection
 */
import assert from 'node:assert/strict'
import { classifyLabResultSource } from '../src/shared/agent1/source-authority.mjs'
import { analyzeLabResultRetrieval } from '../src/shared/agent1/lab-result-retrieval.mjs'
import { hasActualLabReportEvidence } from '../src/shared/agent1/lab-report-evidence.mjs'
import { applyCanonicalMappings } from '../src/shared/canonical-taxonomy/map-structured-evidence.mjs'
import { buildGreenPanV4LabStructuredEvidence } from '../src/shared/agent1/fixtures/greenpanLeafscoreLab.fixture.mjs'
import {
  buildGreenPanFaqSource,
  GREENPAN_FAQ_EXCERPT,
} from '../src/shared/agent1/fixtures/greenpanFaqLab.fixture.mjs'
import { buildManufacturerModalLabSource } from '../src/shared/agent1/fixtures/manufacturerPdpModalLab.fixture.mjs'

const faq = buildGreenPanFaqSource()

assert.equal(hasActualLabReportEvidence(GREENPAN_FAQ_EXCERPT, { url: faq.url }), false)
assert.equal(classifyLabResultSource(faq, faq.url), null)
console.log('✓ FAQ not classified as retailer_linked_lab_result')

const genericClaims = [
  'PFAS-free PFOA-free PTFE-free lead-free cadmium-free toxin-free',
  'Thermolon was tested by third-party labs and is certified safe according to FDA standards',
  'Our products comply with regulations and do not contain harmful toxins',
]
for (const claim of genericClaims) {
  assert.equal(hasActualLabReportEvidence(claim, { url: faq.url }), false, claim)
}
console.log('✓ generic PFAS/toxin/compliance claims alone do not count as lab evidence')

const structured = buildGreenPanV4LabStructuredEvidence()
const mappings = applyCanonicalMappings(structured, [faq])
structured.canonical_mappings = mappings
assert.equal(mappings.primary_contact_material_id?.canonical_id, 'ceramic_nonstick_sol_gel_coating')
assert.equal(mappings.substrate_material_id?.canonical_id, 'hard_anodized_aluminum')

const analysis = analyzeLabResultRetrieval([faq], structured)
assert.equal(analysis.retrieved_lab_result, false)
assert.ok(analysis.codes.includes('NO_THIRD_PARTY_TESTING_FOUND'))
console.log('✓ FAQ-only evidence → NO_THIRD_PARTY_TESTING_FOUND')

const hexModal = buildManufacturerModalLabSource()
assert.equal(classifyLabResultSource(hexModal, hexModal.url), 'manufacturer_published_third_party_lab_result')
console.log('✓ HexClad Light Labs modal still passes')

console.log('\nFAQ lab evidence rejection tests passed.')
