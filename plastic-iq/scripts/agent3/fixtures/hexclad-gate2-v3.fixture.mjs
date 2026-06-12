/**
 * Approved Gate 2 v3 scoring_inputs shape — hybrid proprietary ceramic + lab Non-Detect.
 */
import { runAgent2NormalizationPipeline } from '../../agent2/deterministic/pipeline.mjs'
import { buildGate1ApprovalEligibilityHexCladV7Evidence } from '../../../src/shared/agent1/fixtures/gate1ApprovalEligibilityHexCladV7.fixture.mjs'

const FIXTURE_PRODUCT = {
  product_id: 'fixture-hexclad-gate2-v3',
  product_name: 'HexClad Hybrid Nonstick 10 Inch Frying Pan',
  brand: 'HexClad',
  subcategory: 'Cookware',
}

export function buildHexCladGate2V3ApprovedScoringInputs() {
  const evidence = buildGate1ApprovalEligibilityHexCladV7Evidence()
  evidence.review_status = 'approved'
  evidence.agent_metadata.certifications_verified = []

  const { inputs } = runAgent2NormalizationPipeline(FIXTURE_PRODUCT, evidence)

  const terraBond = inputs.components?.find((c) =>
    /terrabond|proprietary.*coating|valleys/i.test(
      `${c.component_name ?? ''} ${c.material ?? ''}`,
    ),
  )
  if (terraBond) {
    terraBond.escalator_1_triggers = true
    terraBond.escalator_applied = 'escalator_1'
    terraBond.escalator_multiplier = 1.25
  }

  return { inputs, evidence, product: FIXTURE_PRODUCT }
}
