/**
 * Step 4 — Layer 4A applicability + server enforcement (single step output).
 * Reads inferred components + evidence. Does not modify components.
 */

import { enforceLayer4a } from '../layer4a-enforce.mjs'
import { stripMarketingLanguageNegative } from '../layer4b-enforce.mjs'
import { marketingLanguageStripNormalizationNote } from '../../../src/shared/agent2/manufacturer-lab-testing-evidence.mjs'
import { buildLayer4a, requiresHumanReview } from './layer4a-applicability.mjs'

/**
 * @param {object} evidence
 * @param {object[]} inferredComponents — Step 3 output
 * @param {string} category
 */
export function runLayer4aStep(evidence, inferredComponents, category) {
  const built = buildLayer4a(evidence, inferredComponents, category)
  const review = requiresHumanReview(evidence, inferredComponents, category)

  let layer4aPacket = {
    layer_4a_positive_reasoning: built.layer_4a_positive_reasoning,
    layer_4a: built.layer_4a,
    human_review_required: review.human_review_required,
    human_review_reason: review.human_review_reason,
  }

  const afterEnforce = enforceLayer4a({
    layer_4a_positive_reasoning: layer4aPacket.layer_4a_positive_reasoning,
    layer_4a: layer4aPacket.layer_4a,
    components: inferredComponents,
    normalization_notes: '',
  })

  layer4aPacket = {
    layer_4a_positive_reasoning: afterEnforce.layer_4a_positive_reasoning,
    layer_4a: afterEnforce.layer_4a,
    layer_4a_verified: afterEnforce.layer_4a_verified,
    human_review_required: review.human_review_required,
    human_review_reason: review.human_review_reason,
    layer4a_notes: afterEnforce.normalization_notes ?? '',
  }

  const stripCtx = {
    layer_4a: layer4aPacket.layer_4a,
    layer_4a_verified: layer4aPacket.layer_4a_verified,
    components: inferredComponents,
    evidence,
  }
  const { inputs: stripped, stripped: didStrip } = stripMarketingLanguageNegative(stripCtx)
  if (stripped.layer_4a) {
    layer4aPacket.layer_4a = stripped.layer_4a
    layer4aPacket.layer_4a_verified = stripped.layer_4a_verified ?? layer4aPacket.layer_4a_verified
  }
  if (didStrip) {
    layer4aPacket.layer4a_notes = [
      layer4aPacket.layer4a_notes,
      marketingLanguageStripNormalizationNote(evidence),
    ]
      .filter(Boolean)
      .join(' ')
  }

  return layer4aPacket
}
