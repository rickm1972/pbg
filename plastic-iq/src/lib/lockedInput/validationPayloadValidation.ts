import type { SystemValidationPayload } from '../../types/lockedInput'

export class ValidationPayloadValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationPayloadValidationError'
  }
}

export function assertValidationPayloadHasNoLockedFields(payload: unknown): void {
  const walk = (value: unknown, path = '') => {
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) walk(value[i], `${path}[${i}]`)
      return
    }
    if (value && typeof value === 'object') {
      for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        if (key.startsWith('locked_')) {
          throw new ValidationPayloadValidationError(
            `validation_payload must not contain locked_* field at ${path}.${key}`,
          )
        }
        walk(child, path ? `${path}.${key}` : key)
      }
    }
  }
  walk(payload)
}

export function validateValidationPayloadShape(payload: SystemValidationPayload): void {
  assertValidationPayloadHasNoLockedFields(payload)
  if (!payload.schema_version?.trim()) {
    throw new ValidationPayloadValidationError('validation_payload.schema_version is required')
  }
  if (!Array.isArray(payload.components)) {
    throw new ValidationPayloadValidationError('validation_payload.components must be an array')
  }
}
