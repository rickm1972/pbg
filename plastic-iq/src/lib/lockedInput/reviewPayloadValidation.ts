import type { ReviewedComponentInput, ReviewedInputPayload } from '../../types/lockedInput'

export class ReviewedPayloadValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ReviewedPayloadValidationError'
  }
}

export function assertReviewedPayloadHasNoLockedFields(payload: unknown): void {
  const walk = (value: unknown, path = '') => {
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) walk(value[i], `${path}[${i}]`)
      return
    }
    if (value && typeof value === 'object') {
      for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        if (key.startsWith('locked_')) {
          throw new ReviewedPayloadValidationError(
            `reviewed_payload must not contain locked_* field at ${path}.${key}`,
          )
        }
        walk(child, path ? `${path}.${key}` : key)
      }
    }
  }
  walk(payload)
}

export function validateReviewedPayloadShape(payload: ReviewedInputPayload): void {
  assertReviewedPayloadHasNoLockedFields(payload)

  if (!payload.schema_version?.trim()) {
    throw new ReviewedPayloadValidationError('reviewed_payload.schema_version is required')
  }
  if (!Array.isArray(payload.reviewed_components) || payload.reviewed_components.length === 0) {
    throw new ReviewedPayloadValidationError('reviewed_payload.reviewed_components must be non-empty')
  }

  for (const [index, component] of payload.reviewed_components.entries()) {
    validateReviewedComponent(component, index)
  }
}

function validateReviewedComponent(component: ReviewedComponentInput, index: number): void {
  const prefix = `reviewed_components[${index}]`
  if (!component.reviewed_component_id?.trim()) {
    throw new ReviewedPayloadValidationError(`${prefix}.reviewed_component_id is required`)
  }
  if (!component.reviewed_component_role?.trim()) {
    throw new ReviewedPayloadValidationError(`${prefix}.reviewed_component_role is required`)
  }
  if (!component.reviewed_component_structure?.trim()) {
    throw new ReviewedPayloadValidationError(`${prefix}.reviewed_component_structure is required`)
  }
  if (!component.reviewed_contact_pathway?.trim()) {
    throw new ReviewedPayloadValidationError(`${prefix}.reviewed_contact_pathway is required`)
  }
  if (typeof component.reviewed_is_primary_contact !== 'boolean') {
    throw new ReviewedPayloadValidationError(`${prefix}.reviewed_is_primary_contact must be boolean`)
  }
  if (typeof component.reviewed_is_score_driving !== 'boolean') {
    throw new ReviewedPayloadValidationError(`${prefix}.reviewed_is_score_driving must be boolean`)
  }
  const canonical =
    component.confirmed_canonical_material_id ?? component.reviewed_canonical_material_id
  if (canonical == null || !String(canonical).trim()) {
    throw new ReviewedPayloadValidationError(
      `${prefix} must include confirmed_canonical_material_id or reviewed_canonical_material_id`,
    )
  }
}
