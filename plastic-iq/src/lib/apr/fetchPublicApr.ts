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
import { supabase } from '../supabaseClient'
import { PublishedSnapshotMissingError } from './publishedSnapshotErrors'

export { PublishedSnapshotMissingError } from './publishedSnapshotErrors'

async function fetchApprovedScoreReviewTimestamp(productId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('product_scores')
    .select('review_timestamp, run_timestamp')
    .eq('product_id', productId)
    .eq('review_status', 'approved')
    .order('run_timestamp', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) return null
  const ts = data.review_timestamp ?? data.run_timestamp
  return typeof ts === 'string' && ts.trim() ? ts.trim() : null
}

/** Live assembly — admin preview / unpublished products only. */
export async function fetchLiveAprPublicRenderInput(
  product: Product,
): Promise<AprPublicRenderInput | null> {
  const productId = product.product_id

  const [pageScore, whyThisScore, productDescription, normalizationComponents, evidence, rawSources, reviewedAt] =
    await Promise.all([
      fetchProductPageScore(productId).catch(() => null),
      fetchWhyThisScore(productId).catch(() => null),
      fetchProductDescription(productId).catch(() => null),
      fetchNormalizationComponents(productId).catch(() => null),
      fetchProductEvidenceDisplayPack(productId).catch(() => null),
      fetchProductSources(productId).catch(() => []),
      fetchApprovedScoreReviewTimestamp(productId).catch(() => null),
    ])

  const assembled = await assembleAprPublicRenderInput({
    product,
    evidence,
    pageScore,
    whyThisScore,
    productDescription,
    normalizationComponents,
    rawSources,
  })

  if (!assembled) return null
  return {
    ...assembled,
    review_meta: { reviewed_at: reviewedAt },
  }
}

/**
 * Public product page render — published catalog products must use frozen snapshots only.
 * Live assembly is for admin preview / unpublished products (fetchLiveAprPublicRenderInput).
 */
export async function fetchAprPublicRenderInput(
  product: Product | null,
): Promise<AprPublicRenderInput | null> {
  if (!product?.product_id) return null

  const snapshot = loadPublishedDisplaySnapshot(product.product_id)
  if (!snapshot) {
    throw new PublishedSnapshotMissingError(product.product_id)
  }

  const commerceLinks = loadCommerceLinksForProduct(product)
  return mergePublishedRenderPayload(snapshot, commerceLinks)
}

export { assembleAprPublicRenderInput } from './assembleDisplay'
