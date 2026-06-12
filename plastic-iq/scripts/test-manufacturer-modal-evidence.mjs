#!/usr/bin/env node
/**
 * Manufacturer PDP modal/dialog lab evidence extraction.
 * Run: npm run test:manufacturer-modal-evidence
 */
import assert from 'node:assert/strict'
import {
  buildManufacturerPdpExcerpt,
  extractModalEvidenceBlocks,
  htmlToTextPreserveAlt,
  textContainsLabModalEvidence,
} from '../src/shared/agent1/manufacturer-pdp-modal-extraction.mjs'
import {
  FIXTURE_MODAL_PDP_HTML,
  FIXTURE_MODAL_PDP_URL,
  buildManufacturerModalLabProduct,
  buildManufacturerModalLabSource,
} from '../src/shared/agent1/fixtures/manufacturerPdpModalLab.fixture.mjs'
import { classifyLabResultSource } from '../src/shared/agent1/source-authority.mjs'
import {
  analyzeLabResultRetrieval,
  requiresLabResultRetrieval,
} from '../src/shared/agent1/lab-result-retrieval.mjs'
import { validateManufacturerSource } from '../src/shared/agent1/manufacturer-pdp-validation.mjs'
import { applyCanonicalMappings } from '../src/shared/canonical-taxonomy/map-structured-evidence.mjs'
import { buildHybridManufacturerPdpFailureStructured } from '../src/shared/agent1/fixtures/hybridManufacturerPdpFailure.fixture.mjs'
import {
  FIXTURE_MANUFACTURER_WRONG_REGION,
  FIXTURE_RETAILER_PDP,
} from '../src/shared/agent1/fixtures/hybridManufacturerPdpFailure.fixture.mjs'
import { applyProvidedSourceIntakePriority } from '../src/shared/agent1/provided-source-intake.mjs'
import { isOutdatedThirdPartyPtfeContext } from '../src/shared/agent1/source-authority.mjs'
import { scoreDrivingBlobExcludesOutdatedThirdPartyPtfe } from '../src/shared/agent1/gate1-source-validation.mjs'
import { runCoatedProductLabResultsRetrieval } from './agent1/required-check-retrieval/tasks/cookware-lab-results.mjs'

// --- Static HTML modal extraction ---
const blocks = extractModalEvidenceBlocks(FIXTURE_MODAL_PDP_HTML)
assert.ok(blocks.length >= 1)
assert.ok(blocks.some((b) => b.kind === 'lab_modal'))
console.log('✓ detects evidence-bearing modal blocks in static HTML')

const excerpt = buildManufacturerPdpExcerpt(FIXTURE_MODAL_PDP_HTML)
assert.ok(excerpt.has_lab_modal_evidence)
assert.ok(/Learn More/i.test(excerpt.visible_excerpt))
assert.ok(/Test Results Verified by 3rd Party Lab/i.test(excerpt.modal_excerpt))
assert.ok(/Logo of Light Labs/i.test(htmlToTextPreserveAlt(FIXTURE_MODAL_PDP_HTML)))
assert.ok(/PFOS.*Non-Detect/i.test(excerpt.modal_excerpt))
assert.ok(textContainsLabModalEvidence(excerpt.combined_excerpt))
console.log('✓ hidden modal/dialog content extracted from HTML (incl. img alt)')

// --- Lab classification ---
const modalSource = buildManufacturerModalLabSource()
const labClass = classifyLabResultSource(modalSource, modalSource.url)
assert.equal(labClass, 'manufacturer_published_third_party_lab_result')
console.log('✓ Light Labs / Non-Detect classified as manufacturer-published third-party lab testing')

// --- NO_THIRD_PARTY_TESTING_FOUND not emitted when modal evidence present ---
const structured = buildHybridManufacturerPdpFailureStructured()
structured.retailer_links.manufacturer_direct_url = FIXTURE_MODAL_PDP_URL
const sources = [
  FIXTURE_RETAILER_PDP,
  modalSource,
  FIXTURE_MANUFACTURER_WRONG_REGION,
]
const mappings = applyCanonicalMappings(structured, sources)
structured.canonical_mappings = mappings
assert.ok(requiresLabResultRetrieval(mappings, structured))
const labAnalysis = analyzeLabResultRetrieval(sources, structured)
assert.equal(labAnalysis.retrieved_lab_result, true)
assert.ok(!labAnalysis.codes.includes('NO_THIRD_PARTY_TESTING_FOUND'))
console.log('✓ NO_THIRD_PARTY_TESTING_FOUND not emitted when manufacturer modal lab evidence exists')

// --- Manufacturer PDP validation with modal ---
const product = buildManufacturerModalLabProduct()
const validation = validateManufacturerSource(modalSource, product)
assert.equal(validation.passed, true)
assert.equal(validation.supports_material_evidence, true)
console.log('✓ manufacturer PDP + modal supports material/coating evidence')

// --- Provided URL priority: hexclad.eu supplemental ---
structured.retailer_links.manufacturer_direct_url = FIXTURE_MANUFACTURER_WRONG_REGION.url
const intakeReport = {
  entries: [
    {
      url: FIXTURE_MODAL_PDP_URL,
      intended_role: 'manufacturer_product',
      validation: { passed: true },
      has_lab_modal_evidence: true,
    },
  ],
  sources: [modalSource],
}
const applied = applyProvidedSourceIntakePriority(structured, sources, product, intakeReport)
assert.equal(applied.structured.retailer_links.manufacturer_direct_url, FIXTURE_MODAL_PDP_URL)
const eu = applied.sources.find((s) => s.url?.includes('examplebrand.eu'))
assert.ok(eu?.provided_intake_supplemental || eu?.provided_intake_mismatch)
console.log('✓ provided US manufacturer PDP beats wrong-region discovered URL')

// --- Hybrid taxonomy not collapsed to inert ---
const primaryId = mappings.primary_contact_material_id?.canonical_id ?? ''
assert.ok(/hybrid_stainless|terrabond|proprietary/.test(primaryId))
assert.notEqual(mappings.pfas_status_id?.canonical_id, 'pfas_not_present_inert_material')
console.log('✓ hybrid/coated taxonomy intact — no inert shortcut')

// --- Third-party PTFE context does not override manufacturer modal ---
const outdatedBlog = {
  url: 'https://blog.example/ptfe',
  source_type: 'third_party_review',
  page_excerpt: 'PFOA-free PTFE nonstick coating from an older formulation context.',
}
assert.ok(isOutdatedThirdPartyPtfeContext(outdatedBlog, product, [modalSource]))
const blob = scoreDrivingBlobExcludesOutdatedThirdPartyPtfe(
  `${modalSource.page_excerpt} ${outdatedBlog.page_excerpt}`,
  [modalSource, outdatedBlog],
)
assert.ok(!blob.includes(outdatedBlog.page_excerpt.trim()))
assert.ok(/ptfe\s*passed\s*non[-\s]?detect/i.test(blob))
console.log('✓ old third-party PTFE context does not override manufacturer modal evidence')

// --- Lab retrieval task uses manufacturer_product_url modal path (bounded fetch) ---
const originalFetch = globalThis.fetch
globalThis.fetch = async (url, init) => {
  if (String(url) === FIXTURE_MODAL_PDP_URL) {
    return {
      ok: true,
      status: 200,
      text: async () => FIXTURE_MODAL_PDP_HTML,
    }
  }
  return originalFetch(url, init)
}
try {
  const labTask = await runCoatedProductLabResultsRetrieval({
    product,
    structured: { ...structured, canonical_mappings: mappings },
    sources: [FIXTURE_RETAILER_PDP],
    env: {},
  })
  assert.equal(labTask.status, 'passed')
  assert.ok(labTask.lab_assessment?.retrieved_lab_result)
  assert.ok(labTask.newSources.some((s) => s.manufacturer_modal_evidence))
  console.log('✓ coated_product_lab_results passes when manufacturer_product_url modal evidence fetched')
} finally {
  globalThis.fetch = originalFetch
}

console.log('\nAll manufacturer modal evidence tests passed.')
