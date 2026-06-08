/**
 * Product-type registry preflight — block unconfigured types before agent scoring.
 */

import { resolveProductTypeConfigFromContext } from './index.mjs'

export const CATEGORY_CONFIG_REQUIRED = 'category config required'

/**
 * @param {{ product?: object, evidence?: object }} ctx
 * @returns {{ ok: true, config: import('./schema.mjs').ProductTypeRegistryConfig } | { ok: false, error: string, code: 'category_config_required', detail: string }}
 */
export function assertProductTypeRegistryConfigured(ctx = {}) {
  const config = resolveProductTypeConfigFromContext(ctx)
  if (!config) {
    const product = ctx.product ?? {}
    const structured = ctx.evidence?.agent_metadata?.structured_evidence ?? ctx.evidence?.structured_evidence
    const identity = structured?.product_identity
    const category = identity?.category ?? product.category ?? '(unknown)'
    const subcategory = identity?.subcategory ?? product.subcategory ?? '(unknown)'
    const productType = identity?.product_type ?? product.product_type ?? '(unknown)'
    return {
      ok: false,
      error: CATEGORY_CONFIG_REQUIRED,
      code: 'category_config_required',
      detail: `${CATEGORY_CONFIG_REQUIRED}: no registry config for category="${category}", subcategory="${subcategory}", product_type="${productType}". Register the type in the product-type registry before running agents.`,
    }
  }
  return { ok: true, config }
}

/**
 * @param {{ product?: object, evidence?: object }} ctx
 * @returns {string | null} blocking error message, or null when configured
 */
export function getProductTypeRegistryPreflightError(ctx = {}) {
  const result = assertProductTypeRegistryConfigured(ctx)
  return result.ok ? null : result.detail
}
