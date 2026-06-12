/**
 * All products with frozen published display snapshots (baseline + gate4-published).
 */

import { PUBLISHED_BASELINE_PRODUCT_IDS, PUBLISHED_BASELINE_SLUGS } from './publishedBaselineIds'
import type { ProductTier } from '../../types'

export const PUBLISHED_FROZEN_PRODUCT_IDS = {
  ...PUBLISHED_BASELINE_PRODUCT_IDS,
  hexclad: 'fd05c5fb-19c2-4bc0-9882-ce73a7644ef5',
  greenpan: '860b2128-015b-4d8d-8710-7ad7751ec7c5',
} as const

export type PublishedFrozenProductSlug =
  | (typeof PUBLISHED_BASELINE_SLUGS)[number]
  | 'hexclad'
  | 'greenpan'

export type PublishedFrozenProductSpec = {
  slug: PublishedFrozenProductSlug
  product_id: string
  /** Post-backfill expected frozen score posture for diff-gate / regression tests. */
  expected?: {
    pac_safety_score: number
    tier: ProductTier
    transparency_badge: string
  }
}

export const PUBLISHED_FROZEN_PRODUCT_SPECS: PublishedFrozenProductSpec[] = [
  { slug: 'lodge', product_id: PUBLISHED_FROZEN_PRODUCT_IDS.lodge },
  { slug: 'all-clad', product_id: PUBLISHED_FROZEN_PRODUCT_IDS.allClad },
  { slug: 'caraway', product_id: PUBLISHED_FROZEN_PRODUCT_IDS.caraway },
  { slug: 't-fal', product_id: PUBLISHED_FROZEN_PRODUCT_IDS.tfal },
  {
    slug: 'hexclad',
    product_id: PUBLISHED_FROZEN_PRODUCT_IDS.hexclad,
    expected: {
      pac_safety_score: 78,
      tier: 'Good',
      transparency_badge: 'Documentation Incomplete',
    },
  },
  {
    slug: 'greenpan',
    product_id: PUBLISHED_FROZEN_PRODUCT_IDS.greenpan,
    expected: {
      pac_safety_score: 69,
      tier: 'Caution',
      transparency_badge: 'Material Uncertain',
    },
  },
]

export function listAllFrozenPublishedProductIds(): string[] {
  return PUBLISHED_FROZEN_PRODUCT_SPECS.map((s) => s.product_id)
}

export function bundledApprovedJsonFilename(productId: string): string {
  const spec = PUBLISHED_FROZEN_PRODUCT_SPECS.find((s) => s.product_id === productId)
  return spec ? `${spec.slug}-approved.json` : `${productId}-approved.json`
}

export function frozenProductSpec(productId: string): PublishedFrozenProductSpec | undefined {
  return PUBLISHED_FROZEN_PRODUCT_SPECS.find((s) => s.product_id === productId)
}
