/**
 * Agent 2 V3.0 — one-way normalization pipeline.
 * Each step reads only the previous step's output. No step mutates earlier outputs.
 *
 * 1. component-extract.mjs
 * 2. taxonomy-lookup.mjs
 * 3. normalize-enforce.mjs (scoring fields only)
 * 4. layer4a-step.mjs
 * 5. why-this-score-map.mjs
 * 6. layer4b-step.mjs
 * 7. product-description-generate.mjs
 */

import { AGENT_VERSION, ALGORITHM_VERSION } from '../version.mjs'
import { buildWhyThisScoreOptions } from '../why-this-score-map.mjs'
import { applyServerInferenceRules } from '../normalize-enforce.mjs'
import { assertCanonicalMappingsReady } from './canonical-gate.mjs'
import { extractComponents } from './component-extract.mjs'
import { deriveForeseeableUse, deriveIntendedUse, deriveProductCategory } from './category.mjs'
import { runLayer4bStep } from './layer4b-step.mjs'
import { runLayer4aStep } from './layer4a-step.mjs'
import { enrichComponentsFromTaxonomy } from './taxonomy-lookup.mjs'
import { buildFormulationPathway } from './scoring-fields.mjs'
import {
  runProductDescriptionStep,
  PRODUCT_DESCRIPTION_GENERATOR_VERSION,
} from './product-description-generate.mjs'
import {
  cosmeticProductDescriptionWarningMessage,
  isProductDescriptionScoreBlocking,
} from '../../../src/shared/agent2/output-contract.mjs'

/**
 * @param {object} product
 * @param {object} evidence
 */
export function runAgent2NormalizationPipeline(product, evidence) {
  const runTimestamp = new Date().toISOString()
  const category = deriveProductCategory(evidence, product)

  assertCanonicalMappingsReady(evidence, product)

  const step1 = extractComponents(evidence, product)
  const step2 = enrichComponentsFromTaxonomy(step1.components, {
    category,
    isFormulation: step1.isFormulation,
  })

  const pipelineCtx = {
    product_category_default: category,
    subcategory: product.subcategory,
  }
  const step3 = applyServerInferenceRules(step2, pipelineCtx)

  const step4 = runLayer4aStep(evidence, step3.components, category)

  const formulation_pathway = buildFormulationPathway(step3.components, step1.isFormulation)

  const step6 = runLayer4bStep(step3.components, step4.layer_4a, evidence)

  const inputs = {
    product_id: product.product_id,
    evidence_id: evidence.evidence_id,
    normalization_metadata: {
      agent_version: AGENT_VERSION,
      algorithm_version: ALGORITHM_VERSION,
      run_timestamp: runTimestamp,
      model: 'deterministic-v3',
      normalization_mode: 'deterministic-pipeline',
      pipeline_steps: [
        'component-extract',
        'taxonomy-lookup',
        'server-inference',
        'layer4a',
        'why-this-score',
        'layer4b',
        'product-description',
      ],
    },
    is_formulation_product: step1.isFormulation,
    product_category_default: category,
    normal_intended_use: deriveIntendedUse(evidence),
    common_foreseeable_use: deriveForeseeableUse(evidence, category),
    components: step3.components,
    formulation_pathway,
    layer_4a_positive_reasoning: step4.layer_4a_positive_reasoning,
    layer_4a: step4.layer_4a,
    layer_4a_verified: step4.layer_4a_verified,
    layer_4b: step6,
    human_review_required: step4.human_review_required,
    human_review_reason: step4.human_review_reason,
    normalization_notes: [
      'Agent 2 V3.0 one-way pipeline: extract → taxonomy → inference → Layer 4A → Why This Score → Layer 4B.',
      step4.layer4a_notes,
    ]
      .filter(Boolean)
      .join(' '),
    component_extraction_log: step1.extraction_log,
    normalization_enforcement: step3.normalization_enforcement,
  }

  const whyThisScore = buildWhyThisScoreOptions(evidence, inputs)

  const descResult = runProductDescriptionStep({
    product,
    evidence,
    inputs,
    whyThisScore,
  })

  inputs.product_description = descResult.product_description ?? null
  inputs.product_description_status = descResult.product_description_status
  if (descResult.description_word_count != null) {
    inputs.description_word_count = descResult.description_word_count
  }
  if (descResult.product_description_warnings?.length) {
    inputs.product_description_warnings = descResult.product_description_warnings
  }
  if (descResult.flagged_missing_fields?.length) {
    inputs.flagged_missing_fields = [
      ...(inputs.flagged_missing_fields ?? []),
      ...descResult.flagged_missing_fields,
    ]
  }
  inputs.normalization_metadata.description_generator_version =
    descResult.description_generator_version ?? PRODUCT_DESCRIPTION_GENERATOR_VERSION

  if (descResult.product_description_status !== 'generated') {
    const warningNote = cosmeticProductDescriptionWarningMessage(
      descResult.flagged_missing_fields,
    )
    inputs.normalization_notes = [inputs.normalization_notes, `product_description: ${warningNote}`]
      .filter(Boolean)
      .join(' ')
    if (!isProductDescriptionScoreBlocking()) {
      // Cosmetic copy failure — scoring inputs still valid; do not set blocking status.
    } else if (descResult.human_review_reason) {
      inputs.human_review_required = true
      inputs.human_review_reason = descResult.human_review_reason
    }
  }

  return { inputs, whyThisScore }
}
