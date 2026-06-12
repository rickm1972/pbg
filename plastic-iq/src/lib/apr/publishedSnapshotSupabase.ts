/**
 * Persist frozen display snapshots to Supabase published_display_snapshots.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  PUBLISHED_DISPLAY_CONTRACT_VERSION,
  type PublishedDisplaySnapshotRecord,
} from './publishedDisplaySnapshot'
import type { ApprovedPublishedScoreTruth } from './approvedPublishedTruth'

export type PublishedSnapshotProvenance = {
  evidence_id?: string | null
  input_id?: string | null
  score_id?: string | null
}

export async function loadActivePublishedSnapshotFromDb(
  client: SupabaseClient,
  productId: string,
): Promise<PublishedDisplaySnapshotRecord | null> {
  const { data, error } = await client
    .from('published_display_snapshots')
    .select('payload')
    .eq('product_id', productId)
    .eq('is_active', true)
    .maybeSingle()

  if (error) {
    if (error.code === 'PGRST205' || /does not exist/i.test(error.message ?? '')) return null
    throw error
  }
  if (!data?.payload || typeof data.payload !== 'object') return null
  return data.payload as PublishedDisplaySnapshotRecord
}

export async function upsertActivePublishedSnapshotInDb(
  client: SupabaseClient,
  record: PublishedDisplaySnapshotRecord,
  approved: ApprovedPublishedScoreTruth,
  provenance: PublishedSnapshotProvenance,
): Promise<void> {
  const { data: existing, error: existingError } = await client
    .from('published_display_snapshots')
    .select('snapshot_id')
    .eq('product_id', record.product_id)
    .eq('is_active', true)
    .maybeSingle()

  if (existingError) {
    if (existingError.code === 'PGRST205' || /does not exist/i.test(existingError.message ?? '')) {
      return
    }
    throw existingError
  }

  if (existing?.snapshot_id) {
    const { error: supersedeError } = await client
      .from('published_display_snapshots')
      .update({ is_active: false, superseded_by: record.snapshot_id })
      .eq('snapshot_id', existing.snapshot_id)
    if (supersedeError) throw supersedeError
  }

  const parent_hashes = {
    evidence_id: provenance.evidence_id ?? null,
    input_id: provenance.input_id ?? approved.input_id,
    score_id: provenance.score_id ?? approved.score_id,
  }

  const dbSnapshotId = globalThis.crypto?.randomUUID?.() ?? record.snapshot_id

  const { error: insertError } = await client.from('published_display_snapshots').insert({
    snapshot_id: dbSnapshotId,
    product_id: record.product_id,
    contract_version: PUBLISHED_DISPLAY_CONTRACT_VERSION,
    content_hash: record.content_hash,
    payload: record,
    parent_hashes,
    published_at: record.published_at,
    is_active: true,
    source_snapshot_id: existing?.snapshot_id ?? record.snapshot_id,
    version_sequence: existing ? undefined : 1,
    reason: 'gate4_publish',
  })

  if (insertError) {
    if (insertError.code === 'PGRST205' || /does not exist/i.test(insertError.message ?? '')) {
      return
    }
    throw insertError
  }
}
