#!/usr/bin/env node
/**
 * Gate 3 PFAS/PTFE escalator eligibility.
 * Run: npm run test:gate3-escalator-eligibility
 */
import assert from 'node:assert/strict'
import {
  escalator1Eligible,
  isPfasPtfeFamilyMaterial,
} from '../src/shared/agent3/escalator-eligibility.mjs'
import { buildGate1ApprovalEligibilityHexCladV7Evidence } from '../src/shared/agent1/fixtures/gate1ApprovalEligibilityHexCladV7.fixture.mjs'

const evidence = buildGate1ApprovalEligibilityHexCladV7Evidence()
const terraBond = {
  component_name: 'Cooking Surface — TerraBond™ Ceramic Nonstick Coating (valleys)',
  material: 'TerraBond™ proprietary ceramic nonstick coating in surface valleys',
  material_id: 'terrabond_proprietary',
  escalator_1_triggers: true,
}
const inputs = {
  testing_evidence: {
    testing_evidence_present: true,
    testing_evidence_type: 'manufacturer_published_third_party_lab_result',
    testing_result: 'Non-Detect',
    tested_analytes: ['PFAS', 'PTFE', 'PFOA'],
  },
}

assert.equal(isPfasPtfeFamilyMaterial(terraBond), false)
assert.equal(escalator1Eligible(terraBond, inputs, evidence), false)
console.log('✓ proprietary ceramic + Non-Detect blocks PFAS/PTFE escalator')

const ptfe = {
  component_name: 'Cooking Surface (PTFE nonstick)',
  material: 'PTFE nonstick coating',
  material_id: 'ptfe_nonstick_titanium_reinforced',
  escalator_1_triggers: true,
}
assert.equal(isPfasPtfeFamilyMaterial(ptfe), true)
assert.equal(
  escalator1Eligible(ptfe, {
    canonical_mappings: { pfas_status_id: { canonical_id: 'pfas_present_disclosed' } },
  }, null),
  true,
)
console.log('✓ confirmed PTFE cookware still eligible for escalator_1')

console.log('\nAll Gate 3 escalator eligibility tests passed.')
