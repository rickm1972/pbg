#!/usr/bin/env node
/**
 * GreenPan v6 granular subcategory must use Cookware required-evidence matrix (not unconfigured).
 * Run: npm run test:greenpan-required-evidence-matrix
 */
import assert from 'node:assert/strict'
import { validateRequiredEvidence } from '../src/shared/required-evidence-matrix/validate-required-evidence.mjs'
import { resolveSubcategoryKey } from '../src/shared/required-evidence-matrix/resolve-subcategory.mjs'
import { resolveMatrixKeyFromRegistry } from '../src/shared/product-type-registry/index.mjs'
import { assertProductTypeRegistryConfigured } from '../src/shared/product-type-registry/preflight.mjs'
import { applyCanonicalMappings } from '../src/shared/canonical-taxonomy/map-structured-evidence.mjs'
import {
  analyzeLabResultRetrieval,
} from '../src/shared/agent1/lab-result-retrieval.mjs'
import {
  buildGreenPanLeafscoreSource,
  buildGreenPanV4LabStructuredEvidence,
} from '../src/shared/agent1/fixtures/greenpanLeafscoreLab.fixture.mjs'
import { buildGreenPanFaqSource } from '../src/shared/agent1/fixtures/greenpanFaqLab.fixture.mjs'
import {
  buildGreenPanV6MatrixStructuredEvidence,
  GREENPAN_V6_MATRIX_PRODUCT,
} from '../src/shared/product-type-registry/fixtures/greenpanV6MatrixRouting.fixture.mjs'

const structured = buildGreenPanV6MatrixStructuredEvidence()

// Before fix symptom: subcategory present but category missing → matrix null
assert.equal(structured.product_identity.subcategory, 'Frying Pan / Skillet')
assert.equal(structured.product_identity.category, undefined)

const matrixKey = resolveSubcategoryKey(structured.product_identity.subcategory, {
  category: structured.product_identity.category,
})
assert.equal(matrixKey, 'cookware', 'Frying Pan / Skillet must resolve to cookware matrix key')
assert.equal(
  resolveMatrixKeyFromRegistry('Frying Pan / Skillet', { category: '' }),
  'cookware',
)
console.log('✓ GreenPan v6 subcategory resolves to cookware (not unknown)')

const preflight = assertProductTypeRegistryConfigured({
  product: GREENPAN_V6_MATRIX_PRODUCT,
  evidence: { agent_metadata: { structured_evidence: structured } },
})
assert.equal(preflight.ok, true, preflight.detail ?? 'registry preflight should pass')
console.log('✓ product-type preflight passes for GreenPan-like Kitchen cookware')

const validation = validateRequiredEvidence(structured, [])
assert.notEqual(validation.subcategory_key, null)
assert.equal(validation.subcategory_key, 'cookware')
assert.equal(validation.matrix_display_label, 'Cookware')
assert.notEqual(validation.matrix_display_label, 'Unconfigured product type')
assert.notEqual(validation.summary.category_config_required, true)
assert.ok(validation.checklist_items.length > 0, 'cookware matrix checklist should evaluate')
assert.ok(
  !validation.approval_blockers.some((b) => /category config required/i.test(b)),
  `unexpected category blocker: ${validation.approval_blockers.join('; ')}`,
)
console.log('✓ Phase 3.6 required evidence checklist uses Cookware matrix (not unconfigured)')

// Taxonomy + lab evidence remain fixed with granular subcategory
const leaf = buildGreenPanLeafscoreSource()
const faq = buildGreenPanFaqSource()
const labStructured = buildGreenPanV4LabStructuredEvidence()
labStructured.product_identity.subcategory = 'Frying Pan / Skillet'
const sources = [
  {
    source_type: 'amazon',
    url: labStructured.retailer_links.amazon_url,
    title: 'GreenPan Valencia Pro Ceramic Nonstick 10 Inch Fry Pan',
    page_excerpt: 'Thermolon Minerals Pro ceramic nonstick. Hard anodized aluminum.',
  },
  leaf,
  faq,
]
const mappings = applyCanonicalMappings(labStructured, sources)
assert.equal(mappings.primary_contact_material_id?.canonical_id, 'ceramic_nonstick_sol_gel_coating')
assert.equal(mappings.substrate_material_id?.canonical_id, 'hard_anodized_aluminum')
assert.equal(mappings.coating_modifier_id?.canonical_id, 'proprietary_nonstick_coating_undisclosed')
console.log('✓ GreenPan taxonomy remains ceramic + hard-anodized with granular subcategory')

const labAnalysis = analyzeLabResultRetrieval(sources, labStructured)
assert.equal(labAnalysis.retrieved_lab_result, false)
assert.ok(labAnalysis.codes.includes('NO_THIRD_PARTY_TESTING_FOUND'))
console.log('✓ GreenPan lab evidence remains NO_THIRD_PARTY_TESTING_FOUND (FAQ/LeafScore rejected)')

console.log('\nGreenPan required-evidence matrix routing tests passed.')
