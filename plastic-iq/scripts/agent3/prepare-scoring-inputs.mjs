/**
 * Prepare approved Gate 2 scoring_inputs for Agent 3 — trust finalized Layer 4A/Layer 4B.
 */
import { sanitizeEscalatorFlagsForScoring } from '../../src/shared/agent3/escalator-eligibility.mjs'
import {
  applyKnownCeramicNonstickScoringBands,
  isKnownProprietaryCeramicNonstickMaterial,
  LAYER_4A_PROPRIETARY_CHEMISTRY_UNDISCLOSED,
} from '../../src/shared/agent2/proprietary-ceramic-nonstick.mjs'

function alignLayer4aForKnownCeramicProprietary(inputs, evidence) {
  const hasKnownCeramic = (inputs.components ?? []).some((c) =>
    isKnownProprietaryCeramicNonstickMaterial(c.material_id, c, evidence),
  )
  if (!hasKnownCeramic) return inputs

  const negatives = inputs.layer_4a?.negative_adjustments ?? []
  const staleUnknown = negatives.some((n) =>
    /unknown proprietary food-contact coating/i.test(String(n.reason ?? '')),
  )
  if (!staleUnknown && !inputs.layer_4a?.unknown_coating_cap_applies) return inputs

  const kept = negatives.filter(
    (n) => !/unknown proprietary food-contact coating/i.test(String(n.reason ?? '')),
  )
  kept.push({ ...LAYER_4A_PROPRIETARY_CHEMISTRY_UNDISCLOSED })

  inputs.layer_4a = {
    ...inputs.layer_4a,
    negative_adjustments: kept,
    net_adjustment: -3,
    unknown_coating_cap_applies: false,
    proprietary_ceramic_formula_undisclosed: true,
  }
  return inputs
}

/**
 * @param {object} approvedInputs — approved scoring_inputs.inputs from Gate 2
 * @param {object | null} [evidence] — optional approved Gate 1 evidence for escalator context
 */
export function prepareAgent3ScoringInputs(approvedInputs, evidence = null) {
  const inputs = structuredClone(approvedInputs)

  inputs.components = (inputs.components ?? []).map((component) =>
    applyKnownCeramicNonstickScoringBands(
      component,
      evidence,
      inputs.testing_evidence ?? null,
    ),
  )

  alignLayer4aForKnownCeramicProprietary(inputs, evidence)

  inputs.components = sanitizeEscalatorFlagsForScoring(
    inputs.components,
    inputs,
    evidence,
  )

  return inputs
}
