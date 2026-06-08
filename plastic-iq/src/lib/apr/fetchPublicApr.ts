/**
 * Fetch APR public render input for product pages.
 * Published products render from frozen snapshot + mutable commerce links only.
 */

import type { Product } from '../../types'
import type { AprPublicRenderInput } from '../../types/apr'
import { fetchProductPageScore } from '../productScoresApi'
import { fetchProductDescription } from '../productDescriptionApi'
import { fetchWhyThisScore } from '../whyThisScoreApi'
import { fetchNormalizationComponents } from '../normalizationComponentsApi'
import { fetchProductEvidenceDisplayPack, fetchProductSources } from '../productEvidenceApi'
import { assembleAprPublicRenderInput } from './assembleDisplay'
import { loadPublishedDisplaySnapshot } from './publishedBaselineRegistry'
import { mergePublishedRenderPayload } from './publishedRenderPayload'
import { loadCommerceLinksForProduct } from '../commerce/productCommerceLinks'

/** Live assembly — admin preview / unpublished products only. */
export async function fetchLiveAprPublicRenderInput(
  product: Product,
): Promise<AprPublicRenderInput | null> {
  const productId = product.product_id

  const [pageScore, whyThisScore, productDescription, normalizationComponents, evidence, rawSources] =
    await Promise.all([
      fetchProductPageScore(productId).catch(() => null),
      fetchWhyThisScore(productId).catch(() => null),
      fetchProductDescription(productId).catch(() => null),
      fetchNormalizationComponents(productId).catch(() => null),
      fetchProductEvidenceDisplayPack(productId).catch(() => null),
      fetchProductSources(productId).catch(() => []),
    ])

  return assembleAprPublicRenderInput({
    product,
    evidence,
    pageScore,
    whyThisScore,
    productDescription,
    normalizationComponents,
    rawSources,
  })
}

export async function fetchAprPublicRenderInput(
  product: Product,
): Promise<AprPublicRenderInput | null> {
  const snapshot = loadPublishedDisplaySnapshot(product.product_id)
  if (snapshot) {
    const commerceLinks = loadCommerceLinksForProduct(product)
    return mergePublishedRenderPayload(snapshot, commerceLinks)
  }
  return fetchLiveAprPublicRenderInput(product)
}

export { assembleAprPublicRenderInput } from './assembleDisplay'
