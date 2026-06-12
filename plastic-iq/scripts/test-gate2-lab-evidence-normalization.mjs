#!/usr/bin/env node
/**
 * Gate 2 — manufacturer-published lab testing carry-forward + Layer 4A marketing penalty fix.
 * Run: npm run test:gate2-lab-evidence-normalization
 */
import assert from 'node:assert/strict'
import { buildLayer4a } from './agent2/deterministic/layer4a-applicability.mjs'
import { runAgent2NormalizationPipeline } from './agent2/deterministic/pipeline.mjs'
import { stripMarketingLanguageNegative } from './agent2/layer4b-enforce.mjs'
import {
  extractManufacturerPublishedLabTesting,
  hasManufacturerPublishedLabTesting,
  marketingLanguageStripNormalizationNote,
  marketingLanguageStripVerifiedAction,
} from '../src/shared/agent2/manufacturer-lab-testing-evidence.mjs'
import {
  buildGate1ApprovalEligibilityHexCladV7Evidence,
  buildGate1ApprovalEligibilityHexCladV7Structured,
} from '../src/shared/agent1/fixtures/gate1ApprovalEligibilityHexCladV7.fixture.mjs'
import { CERT_VERIFICATION_ABSENT } from '../src/shared/why-this-score-vocabulary.mjs'
import { NONE } from './agent2/why-this-score-vocabulary.mjs'

const evidence = buildGate1ApprovalEligibilityHexCladV7Evidence()
evidence.review_status = 'approved'
evidence.agent_metadata.certifications_verified = []

const product = {
  product_id: 'fixture-hexclad',
  product_name: 'HexClad Hybrid Nonstick 10 Inch Frying Pan',
  brand: 'HexClad',
  subcategory: 'Cookware',
}

// --- Gate 1 lab evidence visible to Gate 2 ---
const lab = extractManufacturerPublishedLabTesting(evidence)
assert.equal(lab.testing_evidence_present, true)
assert.equal(lab.testing_evidence_type, 'manufacturer_published_third_party_lab_result')
assert.equal(lab.testing_lab, 'Light Labs')
assert.equal(lab.testing_result, 'Non-Detect')
assert.ok(lab.tested_analytes.includes('PFOS'))
assert.ok(lab.tested_analytes.includes('PTFE'))
assert.equal(lab.certification, false)
assert.ok(lab.testing_source_url?.includes('hexclad.com'))
console.log('✓ Gate 2 reads Light Labs evidence from approved Gate 1 structured + sources')

// --- Layer 4A: no marketing-language penalty when lab present ---
const structured = buildGate1ApprovalEligibilityHexCladV7Structured()
const components = [
  {
    role: 'primary_food_contact',
    material_id: 'terrabond_proprietary',
    material: 'Unknown proprietary food-contact coating (PROPRIETARY_NAMED)',
    data_confidence: 'manufacturer confirmed',
    contact_intimacy: 1,
  },
  {
    role: 'coating',
    material_id: 'proprietary_named_food_contact',
    material: 'Unknown proprietary food-contact coating (PROPRIETARY_NAMED)',
    data_confidence: 'manufacturer confirmed',
    contact_intimacy: 1,
  },
]
const layer4aBeforeStyle = buildLayer4a(evidence, components, 'cookware')
const negatives = layer4aBeforeStyle.layer_4a.negative_adjustments.map((n) => n.reason)
assert.ok(
  negatives.some((r) =>
    /proprietary food-contact coating chemistry undisclosed|unknown proprietary food-contact coating/i.test(
      r,
    ),
  ),
)
assert.ok(!negatives.some((r) => /marketing language only/i.test(r)))
assert.equal(layer4aBeforeStyle.layer_4a.net_adjustment, -3)
console.log('✓ Layer 4A: -3 proprietary uncertainty only; no marketing-language -2')

// --- Full pipeline ---
const { inputs, whyThisScore } = runAgent2NormalizationPipeline(product, evidence)
assert.equal(inputs.testing_evidence?.testing_evidence_present, true)
assert.equal(inputs.testing_evidence?.testing_lab, 'Light Labs')
assert.ok(hasManufacturerPublishedLabTesting(evidence))

const pipelineNegatives = (inputs.layer_4a?.negative_adjustments ?? []).map((n) => n.reason)
assert.ok(!pipelineNegatives.some((r) => /marketing language only/i.test(r)))
assert.ok(
  pipelineNegatives.some((r) =>
    /proprietary food-contact coating chemistry undisclosed/i.test(r),
  ),
)
assert.equal(inputs.layer_4a?.net_adjustment, -3)
assert.equal(inputs.layer_4a?.unknown_coating_cap_applies, false)
const coating = inputs.components.find((c) => /terrabond|valleys/i.test(`${c.component_name} ${c.material}`))
assert.equal(coating?.material_hazard, 0.35)
assert.equal(coating?.adjusted_migration_potential, 0.22)

const certs = whyThisScore.certifications_options.filter((o) => o !== NONE)
assert.ok(certs.includes(CERT_VERIFICATION_ABSENT))
assert.ok(certs.some((c) => /Manufacturer-published third-party lab testing/i.test(c)))
assert.ok(!certs.some((c) => /Light Labs certified/i.test(c)))
console.log('✓ certifications & testing separates no certification from lab testing')

const desc = inputs.product_description ?? ''
assert.ok(/Non-Detect|Light Labs/i.test(desc))
assert.ok(/not disclosed|proprietary/i.test(desc))
assert.ok(!/cannot verify the safety of the materials in direct food contact/i.test(desc))
assert.ok(!/undisclosed full chemistry/i.test(desc))
assert.ok(!/key food-contact chemistry is not fully disclosed/i.test(desc))
assert.ok(!/transparency badge/i.test(desc))
assert.ok(!/\bproprietary proprietary\b/i.test(desc))
assert.ok(/cooking-surface valleys/i.test(desc))
assert.ok(/available lab evidence/i.test(desc))
console.log('✓ product description is concise — lab testing + proprietary uncertainty without repetition')

// --- Strip reason references lab evidence, not full disclosure ---
const stripNote = marketingLanguageStripNormalizationNote(evidence)
assert.ok(/manufacturer-published third-party lab testing/i.test(stripNote))
assert.ok(!/fully discloses materials/i.test(stripNote))
const stripAction = marketingLanguageStripVerifiedAction(evidence)
assert.ok(/manufacturer-published third-party lab testing|proprietary chemistry uncertainty/i.test(stripAction))
assert.ok(!/materials fully disclosed/i.test(stripAction))

const { inputs: strippedOut, stripped } = stripMarketingLanguageNegative({
  evidence,
  layer_4a: {
    negative_adjustments: [
      { reason: 'Unknown proprietary food-contact coating', value: -3 },
      { reason: 'Marketing language only, no verifiable claims', value: -2 },
    ],
    positive_adjustments: [],
    net_adjustment: -5,
  },
  components: [],
})
assert.equal(stripped, true)
assert.equal(strippedOut.layer_4a.net_adjustment, -3)
assert.ok(
  strippedOut.layer_4a_verified?.some((v) =>
    /manufacturer-published third-party lab testing/i.test(v.action_taken ?? ''),
  ),
)
console.log('✓ marketing-only strip reason cites lab evidence, not full disclosure')

assert.ok(inputs.components?.some((c) => /terrabond|proprietary/i.test(c.material_id ?? c.material ?? '')))
assert.equal(inputs.layer_4a?.unknown_coating_cap_applies, false)
console.log('✓ hybrid/coated taxonomy intact — ceramic base band, no unknown cap, no inert shortcut')

// Gate 3 handoff proof
assert.equal(inputs.testing_evidence.testing_evidence_type, 'manufacturer_published_third_party_lab_result')
assert.equal(inputs.testing_evidence.certification, false)
assert.ok(inputs.testing_evidence.tested_analytes?.length > 0)
console.log('✓ Gate 3 scoring input receives structured testing_evidence on inputs')

console.log('\nAll Gate 2 lab evidence normalization tests passed.')
