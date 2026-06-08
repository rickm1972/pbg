/**
 * Step 6 — Layer 4B transparency badge (reads Step 3 components + Step 4 layer_4a only).
 */

import { enforceLayer4b } from '../layer4b-enforce.mjs'
import { getStructuredEvidence } from './schema-input.mjs'

/**
 * @param {object[]} inferredComponents — Step 3 output
 * @param {object} layer4a — Step 4 layer_4a object
 * @param {object} [evidence] — Gate 1 packet (transparency_assessment)
 */
export function runLayer4bStep(inferredComponents, layer4a, evidence) {
  const structured = evidence ? getStructuredEvidence(evidence) : null
  const result = enforceLayer4b(
    {
      components: inferredComponents,
      layer_4a: layer4a,
    },
    { gate1TransparencyAssessment: structured?.transparency_assessment ?? null },
  )
  return result.layer_4b
}
