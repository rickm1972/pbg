export function validateNormalizationOutput(parsed, productId, evidenceId) {
  const errors = []

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Normalization output is not an object')
  }

  if (parsed.product_id && parsed.product_id !== productId) {
    errors.push(`product_id mismatch: ${parsed.product_id} vs ${productId}`)
  }
  if (parsed.evidence_id && parsed.evidence_id !== evidenceId) {
    errors.push(`evidence_id mismatch: ${parsed.evidence_id} vs ${evidenceId}`)
  }
  if (!Array.isArray(parsed.components) || parsed.components.length === 0) {
    errors.push('components must be a non-empty array')
  }
  if (!parsed.layer_4a || typeof parsed.layer_4a !== 'object') {
    errors.push('layer_4a is required')
  }
  if (!Array.isArray(parsed.layer_4a_positive_reasoning)) {
    errors.push('layer_4a_positive_reasoning must be an array')
  }
  if (!parsed.layer_4b || typeof parsed.layer_4b !== 'object') {
    errors.push('layer_4b is required')
  }
  if (typeof parsed.human_review_required !== 'boolean') {
    errors.push('human_review_required must be boolean')
  }

  if (errors.length) {
    throw new Error(`Normalization JSON validation failed: ${errors.join('; ')}`)
  }

  parsed.product_id = productId
  parsed.evidence_id = evidenceId
  return parsed
}
