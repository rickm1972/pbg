/**
 * Gate 4 publish — freeze approved display truth into durable + Supabase snapshots.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Product } from '../../types'
import {
  assertPublishedSnapshotMatchesApprovedTruth,
  buildPublishedSnapshotFromApprovedTruth,
  loadApprovedPublishedScoreTruth,
  type ApprovedPublishedScoreTruth,
} from './approvedPublishedTruth'
import type { PublishedDisplaySnapshotRecord } from './publishedDisplaySnapshot'
import { loadLatestApprovedSnapshotDurable } from './durable/durableSnapshotLoader'
import { saveApprovedSnapshotVersionDurable } from './durable/durableSnapshotWriter.node'
import { listApprovedSnapshotVersionsDurable } from './durable/durableSnapshotLoader'
import {
  upsertActivePublishedSnapshotInDb,
  type PublishedSnapshotProvenance,
} from './publishedSnapshotSupabase'
import { PublishSnapshotCreationError } from './publishedSnapshotErrors'

export type PublishWithSnapshotResult = {
  product_id: string
  snapshot_id: string
  pac_safety_score: number
  tier: string
  already_published: boolean
  snapshot_created: boolean
}

function generateSnapshotId(productId: string): string {
  return `snap-${productId}-${Date.now()}`
}

export async function buildFrozenSnapshotForProduct(
  client: SupabaseClient,
  product: Product,
  options: { published_at?: string; snapshot_id?: string } = {},
): Promise<{
  record: PublishedDisplaySnapshotRecord
  approved: ApprovedPublishedScoreTruth
}> {
  const approved = await loadApprovedPublishedScoreTruth(client, product.product_id)
  const published_at = options.published_at ?? new Date().toISOString()
  const snapshot_id = options.snapshot_id ?? generateSnapshotId(product.product_id)

  const record = await buildPublishedSnapshotFromApprovedTruth(client, product, approved, {
    published_at,
    snapshot_id,
  })
  assertPublishedSnapshotMatchesApprovedTruth(record, approved)
  return { record, approved }
}

export function persistFrozenSnapshotToDurableStore(
  record: PublishedDisplaySnapshotRecord,
  context: {
    source_snapshot_id: string
    approved_by?: string | null
    reason?: 'gate4_publish' | 'snapshot_backfill'
    low_score_publication_review?: import('../../types/apr').LowScorePublicationReview | null
  },
): void {
  const existing = loadLatestApprovedSnapshotDurable(record.product_id)
  if (existing && existing.snapshot_id === record.snapshot_id) {
    return
  }

  const versions = listApprovedSnapshotVersionsDurable(record.product_id)
  const version_sequence = existing
    ? (versions[versions.length - 1]?.meta.version_sequence ?? 0) + 1
    : 1

  saveApprovedSnapshotVersionDurable({
    record,
    meta: {
      snapshot_id: record.snapshot_id,
      product_id: record.product_id,
      version_sequence,
      source_snapshot_id: context.source_snapshot_id,
      reason: context.reason ?? 'gate4_publish',
      override_id: null,
      approved_at: record.published_at,
      approved_by: context.approved_by ?? null,
      low_score_publication_review: context.low_score_publication_review ?? null,
    },
  })
}

export async function freezePublishedDisplaySnapshot(
  client: SupabaseClient,
  product: Product,
  provenance: PublishedSnapshotProvenance,
  options: {
    approved_by?: string | null
    reason?: 'gate4_publish' | 'snapshot_backfill'
    skip_if_active_snapshot?: boolean
  } = {},
): Promise<PublishedDisplaySnapshotRecord> {
  if (options.skip_if_active_snapshot) {
    const existing = loadLatestApprovedSnapshotDurable(product.product_id)
    if (existing) return existing
  }

  const prior = loadLatestApprovedSnapshotDurable(product.product_id)
  const { record, approved } = await buildFrozenSnapshotForProduct(client, product)

  persistFrozenSnapshotToDurableStore(record, {
    source_snapshot_id: prior?.snapshot_id ?? `baseline-${product.product_id}`,
    approved_by: options.approved_by ?? null,
    reason: options.reason ?? 'gate4_publish',
  })

  try {
    await upsertActivePublishedSnapshotInDb(client, record, approved, provenance)
  } catch (err) {
    throw new PublishSnapshotCreationError(
      `Durable snapshot saved but Supabase persist failed: ${err instanceof Error ? err.message : String(err)}`,
    )
  }

  return record
}

export async function loadProductPublishContext(
  client: SupabaseClient,
  productId: string,
): Promise<{
  product: Product
  publish_status: string
  active_evidence_id: string | null
}> {
  const { data, error } = await client
    .from('products')
    .select(
      'product_id, product_name, brand, category, subcategory, description, pac_safety_score, tier, score_basis, primary_material, secondary_material, bpa_free, phthalate_free_claim, amazon_asin, amazon_url, affiliate_link, target_url, walmart_url, other_retailer_label, other_retailer_url, primary_retailer_evidence_url, manufacturer_product_url, manufacturer_lab_results_url, manufacturer_materials_faq_url, agent1_source_notes, image_url, date_added, date_last_updated, active, publish_status, active_evidence_id',
    )
    .eq('product_id', productId)
    .maybeSingle()

  if (error) throw error
  if (!data) throw new PublishSnapshotCreationError(`Product not found: ${productId}`)

  const { publish_status, active_evidence_id, ...productRow } = data
  return {
    product: productRow as Product,
    publish_status: String(publish_status ?? 'draft'),
    active_evidence_id: active_evidence_id ?? null,
  }
}

export async function validatePublishChainRpc(
  client: SupabaseClient,
  productId: string,
): Promise<void> {
  const { error } = await client.rpc('validate_publish_chain', { p_product_id: productId })
  if (error) throw new PublishSnapshotCreationError(error.message)
}

export async function publishProductWithFrozenSnapshot(
  client: SupabaseClient,
  productId: string,
  options: { approved_by?: string | null } = {},
): Promise<PublishWithSnapshotResult> {
  const ctx = await loadProductPublishContext(client, productId)

  if (ctx.publish_status === 'published') {
    const existing = loadLatestApprovedSnapshotDurable(productId)
    if (!existing) {
      throw new PublishSnapshotCreationError(
        `Product ${productId} is published but has no frozen snapshot — run snapshot backfill before serving public page.`,
      )
    }
    return {
      product_id: productId,
      snapshot_id: existing.snapshot_id,
      pac_safety_score: existing.score.pac_safety_score,
      tier: existing.score.tier,
      already_published: true,
      snapshot_created: false,
    }
  }

  await validatePublishChainRpc(client, productId)

  const record = await freezePublishedDisplaySnapshot(
    client,
    ctx.product,
    {
      evidence_id: ctx.active_evidence_id,
    },
    {
      approved_by: options.approved_by ?? null,
      reason: 'gate4_publish',
      skip_if_active_snapshot: false,
    },
  )

  const { error: publishError } = await client.rpc('set_product_published', {
    p_product_id: productId,
  })
  if (publishError) {
    throw new PublishSnapshotCreationError(
      `Snapshot ${record.snapshot_id} was saved but publish_status update failed: ${publishError.message}`,
    )
  }

  return {
    product_id: productId,
    snapshot_id: record.snapshot_id,
    pac_safety_score: record.score.pac_safety_score,
    tier: record.score.tier,
    already_published: false,
    snapshot_created: true,
  }
}
