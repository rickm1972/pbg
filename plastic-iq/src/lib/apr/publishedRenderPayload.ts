/**
 * Merge frozen published display snapshot with current mutable commerce links.
 */

import type { AprPublicRenderInput } from '../../types/apr'
import type { ProductCommerceLink } from '../commerce/productCommerceLinks'
import { commerceLinksToBuyCta } from '../commerce/productCommerceLinks'
import type { PublishedDisplaySnapshotRecord } from './publishedDisplaySnapshot'
import { assertPublishedSnapshotIntegrity } from './publishedDisplaySnapshot'

export function mergePublishedRenderPayload(
  snapshot: PublishedDisplaySnapshotRecord,
  commerceLinks: ProductCommerceLink[],
): AprPublicRenderInput {
  const integrity = assertPublishedSnapshotIntegrity(snapshot)
  if (!integrity.valid) {
    throw new Error(integrity.reason ?? 'Invalid published display snapshot')
  }

  const tier = snapshot.score.tier ?? 'Good'
  const buy_cta = commerceLinksToBuyCta(commerceLinks, tier)

  return {
    display: {
      ...snapshot.display,
      buy_cta,
    },
    score: { ...snapshot.score },
  }
}

/** Compare render payloads excluding mutable commerce fields. */
export function frozenDisplayFingerprint(input: AprPublicRenderInput): string {
  const { buy_cta: _buy, ...displayRest } = input.display
  return JSON.stringify({ display: displayRest, score: input.score })
}
