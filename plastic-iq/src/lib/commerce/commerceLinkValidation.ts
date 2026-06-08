/**
 * Commerce-link validation — blocks wrong-variant / rejected URLs from public CTAs.
 * Does not mutate APR display snapshots or gate truth records.
 */

import type { Product } from '../../types'
import type { ProductEvidence } from '../../types/agent'
import {
  evaluatePublicRetailerCtaEligibility,
} from '../publicRetailerLinks'

export type CommerceLinkValidation = {
  allowed: boolean
  reason: string
}

export function validateCommerceLinkForProduct(
  url: string,
  product: Pick<Product, 'product_name' | 'affiliate_link' | 'amazon_url' | 'target_url' | 'walmart_url' | 'other_retailer_url'> | null,
  evidence?: ProductEvidence | null,
): CommerceLinkValidation {
  const trimmed = url?.trim()
  if (!trimmed) return { allowed: false, reason: 'empty_url' }

  if (product) {
    const eligibility = evaluatePublicRetailerCtaEligibility(trimmed, evidence ?? null, product)
    if (!eligibility.allowed) {
      return { allowed: false, reason: eligibility.reason }
    }
  }

  return { allowed: true, reason: 'valid_commerce_link' }
}
