/**
 * Agent 2 V3.0 — normalization entry (orchestrator delegates to one-way pipeline).
 */

import { validateNormalizationOutput } from '../validate.mjs'
import { runAgent2NormalizationPipeline } from './pipeline.mjs'

/**
 * @param {object} product
 * @param {object} evidence
 */
export function normalizeEvidenceDeterministic(product, evidence) {
  const { inputs } = runAgent2NormalizationPipeline(product, evidence)
  return validateNormalizationOutput(inputs, product.product_id, evidence.evidence_id)
}

/** @deprecated LLM path removed — alias for runner compatibility */
export async function normalizeEvidence(product, evidence, _options = {}) {
  return normalizeEvidenceDeterministic(product, evidence)
}
