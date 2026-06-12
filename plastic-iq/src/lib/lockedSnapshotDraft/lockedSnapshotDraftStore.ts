/**
 * Phase 8 — locked_snapshot_drafts persistence (isolated from published_display_snapshots).
 */
import { supabase } from '../supabaseClient'
import { pickLatestDraftPerLockedAudit } from '../lockedPipeline/activeRowSemantics'
import type {
  LockedSnapshotDraftAuditSummary,
  LockedSnapshotDraftPayload,
  LockedSnapshotDraftRow,
  LockedSnapshotDraftStatus,
} from '../../types/lockedSnapshotDraft'

export type CreateLockedSnapshotDraftParams = {
  product_id: string
  locked_input_id: string
  locked_output_id: string
  locked_audit_id: string
  lock_hash: string
  methodology_version: string
  material_lookup_version: string
  snapshot_payload: LockedSnapshotDraftPayload
  display_payload: Record<string, unknown>
  score_payload: Record<string, unknown>
  math_breakdown: Record<string, unknown>
  audit_summary: LockedSnapshotDraftAuditSummary
  draft_status?: LockedSnapshotDraftStatus
  created_by_system?: string
  supersedes_draft_id?: string | null
}

function nowIso(): string {
  return new Date().toISOString()
}

export { pickLatestDraftPerLockedAudit } from '../lockedPipeline/activeRowSemantics'

export async function createLockedSnapshotDraft(
  params: CreateLockedSnapshotDraftParams,
): Promise<LockedSnapshotDraftRow> {
  const ts = nowIso()
  const prior = await getLatestLockedSnapshotDraftForAudit(params.locked_audit_id)

  const row = {
    product_id: params.product_id,
    locked_input_id: params.locked_input_id,
    locked_output_id: params.locked_output_id,
    locked_audit_id: params.locked_audit_id,
    lock_hash: params.lock_hash,
    input_source: 'agent4_locked_audit' as const,
    methodology_version: params.methodology_version,
    material_lookup_version: params.material_lookup_version,
    snapshot_payload: params.snapshot_payload,
    display_payload: params.display_payload,
    score_payload: params.score_payload,
    math_breakdown: params.math_breakdown,
    audit_summary: params.audit_summary,
    draft_status: params.draft_status ?? 'draft',
    created_by_system: params.created_by_system ?? 'system:locked-snapshot-draft',
    created_at: ts,
    updated_at: ts,
    reviewed_at: null,
    reviewed_by: null,
    review_notes: null,
    supersedes_draft_id: prior?.locked_snapshot_draft_id ?? params.supersedes_draft_id ?? null,
    superseded_by_draft_id: null,
  }

  const { data, error } = await supabase
    .from('locked_snapshot_drafts')
    .insert(row)
    .select('*')
    .single()

  if (error) throw error
  const created = data as LockedSnapshotDraftRow

  const { data: priors, error: priorError } = await supabase
    .from('locked_snapshot_drafts')
    .select('locked_snapshot_draft_id')
    .eq('locked_audit_id', params.locked_audit_id)
    .neq('locked_snapshot_draft_id', created.locked_snapshot_draft_id)
    .neq('draft_status', 'superseded')

  if (priorError) throw priorError
  for (const p of priors ?? []) {
    await supersedeLockedSnapshotDraft({
      locked_snapshot_draft_id: p.locked_snapshot_draft_id,
      superseded_by_draft_id: created.locked_snapshot_draft_id,
    })
  }

  return created
}

export async function getLockedSnapshotDraftForReview(
  draftId: string,
): Promise<LockedSnapshotDraftRow | null> {
  const { data, error } = await supabase
    .from('locked_snapshot_drafts')
    .select('*')
    .eq('locked_snapshot_draft_id', draftId)
    .maybeSingle()
  if (error) throw error
  return (data as LockedSnapshotDraftRow | null) ?? null
}

export async function getLatestLockedSnapshotDraftForAudit(
  lockedAuditId: string,
): Promise<LockedSnapshotDraftRow | null> {
  const { data, error } = await supabase
    .from('locked_snapshot_drafts')
    .select('*')
    .eq('locked_audit_id', lockedAuditId)
    .neq('draft_status', 'superseded')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return (data as LockedSnapshotDraftRow | null) ?? null
}

export async function getLatestLockedSnapshotDraftForProduct(
  productId: string,
): Promise<LockedSnapshotDraftRow | null> {
  const { data, error } = await supabase
    .from('locked_snapshot_drafts')
    .select('*')
    .eq('product_id', productId)
    .neq('draft_status', 'superseded')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return (data as LockedSnapshotDraftRow | null) ?? null
}

export async function listReviewableLockedSnapshotDrafts(): Promise<LockedSnapshotDraftRow[]> {
  const { data, error } = await supabase
    .from('locked_snapshot_drafts')
    .select('*')
    .in('draft_status', ['draft', 'ready_for_review', 'approved_for_future_publish'])
    .order('created_at', { ascending: false })
  if (error) throw error
  return pickLatestDraftPerLockedAudit((data ?? []) as LockedSnapshotDraftRow[])
}

export async function supersedeLockedSnapshotDraft(params: {
  locked_snapshot_draft_id: string
  superseded_by_draft_id: string
}): Promise<void> {
  const ts = nowIso()
  const { error } = await supabase
    .from('locked_snapshot_drafts')
    .update({
      draft_status: 'superseded',
      superseded_by_draft_id: params.superseded_by_draft_id,
      updated_at: ts,
    })
    .eq('locked_snapshot_draft_id', params.locked_snapshot_draft_id)
  if (error) throw error
}

export async function updateLockedSnapshotDraftReviewStatus(params: {
  locked_snapshot_draft_id: string
  draft_status: 'ready_for_review' | 'approved_for_future_publish' | 'rejected' | 'draft'
  reviewed_by?: string | null
  review_notes?: string | null
}): Promise<LockedSnapshotDraftRow> {
  const ts = nowIso()
  const { data, error } = await supabase
    .from('locked_snapshot_drafts')
    .update({
      draft_status: params.draft_status,
      reviewed_by: params.reviewed_by ?? null,
      review_notes: params.review_notes ?? null,
      reviewed_at: ts,
      updated_at: ts,
    })
    .eq('locked_snapshot_draft_id', params.locked_snapshot_draft_id)
    .select('*')
    .single()
  if (error) throw error
  return data as LockedSnapshotDraftRow
}
