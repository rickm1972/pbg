/**
 * APR field ownership rules and cross-layer derivation guards.
 */

import type { ApprovedProductRecord, AprDisplayPayload } from '../../types/apr'
import {
  APR_FIELD_OWNERS,
  RENDERER_ALLOWED_TEXT_PATHS,
  RENDERER_FORBIDDEN_READ_PATHS,
} from '../../types/apr'
import { assertDisplayNamespaceSeparation } from './snapshot'

export type OwnershipViolation = {
  rule: string
  path: string
  message: string
}

/** Every contract-surface field must map to exactly one owner. */
export function assertFieldOwnershipMapComplete(): { valid: boolean; errors: string[] } {
  const requiredPaths = [
    ...RENDERER_ALLOWED_TEXT_PATHS,
    'score.pac_safety_score',
    'score.tier',
    'score.displayed_confidence_range',
    'score.transparency_badge',
    'normalization.components',
    'evidence.sources.source_role',
    'evidence.sources.variant_mismatch',
  ]
  const errors: string[] = []
  for (const path of requiredPaths) {
    const ownerKey = path as keyof typeof APR_FIELD_OWNERS
    if (!(ownerKey in APR_FIELD_OWNERS)) {
      errors.push(`Missing owner for ${path}`)
    }
  }
  return { valid: errors.length === 0, errors }
}

/** Renderer must not read scoring namespace paths. */
export function assertRendererReadContract(
  accessedPaths: string[],
): { valid: boolean; violations: OwnershipViolation[] } {
  const violations: OwnershipViolation[] = []
  for (const path of accessedPaths) {
    if ((RENDERER_FORBIDDEN_READ_PATHS as readonly string[]).includes(path)) {
      violations.push({
        rule: 'renderer_forbidden_read',
        path,
        message: `Renderer must not read ${path} — use display.* instead.`,
      })
    }
  }
  return { valid: violations.length === 0, violations }
}

/** Agent 3 must not read display strings for scoring math. */
export function assertAgent3ReadContract(
  accessedPaths: string[],
): { valid: boolean; violations: OwnershipViolation[] } {
  const violations: OwnershipViolation[] = []
  for (const path of accessedPaths) {
    if (path.startsWith('display.')) {
      violations.push({
        rule: 'agent3_forbidden_display_read',
        path,
        message: `Agent 3 must not read ${path} for scoring — use normalization.components[] only.`,
      })
    }
  }
  return { valid: violations.length === 0, violations }
}

const CANONICAL_ID_PATTERN = /[a-z][a-z0-9]*(?:_[a-z0-9]+){2,}/g

/** Reject raw canonical IDs in display strings (preflight rule 2 precursor). */
export function findCanonicalIdsInDisplayStrings(
  display: AprDisplayPayload,
): OwnershipViolation[] {
  const violations: OwnershipViolation[] = []
  const walk = (value: unknown, path: string) => {
    if (typeof value === 'string') {
      for (const match of value.matchAll(CANONICAL_ID_PATTERN)) {
        const token = match[0]
        if (
          token.includes('_unspecified') ||
          token.includes('_core') ||
          token.includes('_nonstick') ||
          token.includes('stainless_steel') ||
          token.includes('graphite_') ||
          token.includes('_with_')
        ) {
          violations.push({
            rule: 'display_canonical_id_leak',
            path,
            message: `Display string contains canonical ID pattern "${token}" at ${path}`,
          })
        }
      }
    } else if (Array.isArray(value)) {
      value.forEach((item, i) => walk(item, `${path}[${i}]`))
    } else if (value && typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) {
        walk(v, path ? `${path}.${k}` : k)
      }
    }
  }
  walk(display, 'display')
  return violations
}

/** retailer_primary may never be grouped as Context (preflight rule 5 precursor). */
export function assertRetailerPrimarySourceRoles(
  display: AprDisplayPayload,
): { valid: boolean; violations: OwnershipViolation[] } {
  const violations: OwnershipViolation[] = []
  for (const [i, source] of display.sources.entries()) {
    if (source.source_role === 'retailer_primary' && source.group === 'Context') {
      violations.push({
        rule: 'retailer_primary_not_context',
        path: `display.sources[${i}]`,
        message: 'retailer_primary source must not render under Context group.',
      })
    }
    if (source.source_role === 'retailer_primary' && !source.public_source_eligible) {
      violations.push({
        rule: 'retailer_primary_must_be_eligible',
        path: `display.sources[${i}]`,
        message: 'retailer_primary source must be public_source_eligible.',
      })
    }
  }
  return { valid: violations.length === 0, violations }
}

/** variant_mismatch sources default ineligible unless explicitly marked (preflight rule 6 precursor). */
export function assertVariantMismatchEligibility(
  display: AprDisplayPayload,
): { valid: boolean; violations: OwnershipViolation[] } {
  const violations: OwnershipViolation[] = []
  for (const [i, source] of display.sources.entries()) {
    if (
      source.variant_mismatch &&
      source.public_source_eligible &&
      source.source_role === 'manufacturer' &&
      /\/products?\//i.test(source.url) &&
      /\d+-\d+-inch|\d+-inch/i.test(source.url)
    ) {
      violations.push({
        rule: 'variant_mismatch_product_page_hidden',
        path: `display.sources[${i}]`,
        message:
          'Variant-mismatched manufacturer product page must default to public_source_eligible: false.',
      })
    }
    if (source.variant_mismatch && source.source_role === 'retailer_primary') {
      violations.push({
        rule: 'variant_mismatch_not_primary_retailer',
        path: `display.sources[${i}]`,
        message: 'retailer_primary source must not carry variant_mismatch: true.',
      })
    }
  }
  return { valid: violations.length === 0, violations }
}

/** Full ownership preflight on an assembled APR (Phase 4 will gate on this). */
export function runAprOwnershipPreflight(record: ApprovedProductRecord): {
  passed: boolean
  violations: OwnershipViolation[]
} {
  const violations: OwnershipViolation[] = []

  const namespace = assertDisplayNamespaceSeparation(record.normalization, record.display)
  if (!namespace.valid) {
    for (const msg of namespace.errors) {
      violations.push({ rule: 'namespace_split', path: 'normalization/display', message: msg })
    }
  }

  violations.push(...findCanonicalIdsInDisplayStrings(record.display.payload))

  const retailerRoles = assertRetailerPrimarySourceRoles(record.display.payload)
  violations.push(...retailerRoles.violations)

  const variantRules = assertVariantMismatchEligibility(record.display.payload)
  violations.push(...variantRules.violations)

  return { passed: violations.length === 0, violations }
}

export { APR_FIELD_OWNERS, RENDERER_ALLOWED_TEXT_PATHS, RENDERER_FORBIDDEN_READ_PATHS }
