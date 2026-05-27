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
  try {
    const { inputs } = runAgent2NormalizationPipeline(product, evidence)
    return validateNormalizationOutput(inputs, product.product_id, evidence.evidence_id)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const missing =
      message.match(/Unknown material_id:\s*([a-z0-9_]+)/i) ||
      message.match(/Missing material taxonomy entry:\s*([a-z0-9_]+)/i)
    if (!missing) throw err
    const missingId = missing[1]
    return {
      product_id: product.product_id,
      evidence_id: evidence.evidence_id,
      components: [],
      layer_4a: null,
      layer_4a_positive_reasoning: [],
      layer_4b: null,
      human_review_required: true,
      human_review_reason:
        `Cannot score this product. Missing material taxonomy entry: ${missingId}. ` +
        'Add the material to the taxonomy and re-run Agent 2.',
      status: 'taxonomy_expansion_required',
      flagged_materials: [missingId],
      normalization_metadata: {
        agent_version: null,
        algorithm_version: null,
        run_timestamp: new Date().toISOString(),
        model: 'deterministic-v3',
        normalization_mode: 'deterministic-pipeline',
        pipeline_steps: ['component-extract', 'taxonomy-lookup'],
      },
      normalization_notes: `taxonomy_expansion_required: missing material ${missingId}.`,
      component_extraction_log: [],
      normalization_enforcement: null,
      is_formulation_product: false,
      product_category_default: null,
    }
  }
}

/** @deprecated LLM path removed — alias for runner compatibility */
export async function normalizeEvidence(product, evidence, _options = {}) {
  return normalizeEvidenceDeterministic(product, evidence)
}
