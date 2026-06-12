/**
 * Phase 6.7 — Agent 3 locked-output persistence (agent3_locked_outputs only).
 */
import { supabase } from '../supabaseClient'
import type {
  Agent3LockedOutputDisplayPayload,
  Agent3LockedOutputMathBreakdown,
  Agent3LockedOutputReviewStatus,
  Agent3LockedOutputRow,
  Agent3LockedOutputScorePayload,
} from '../../types/agent3LockedOutput'
import {
  METHODOLOGY_VERSION,
  MATERIAL_LOOKUP_VERSION,
} from '../lockedInput/buildLockedInputPackage'
import { pickLatestAgent3OutputPerLockedInput } from '../lockedPipeline/activeRowSemantics'

export { METHODOLOGY_VERSION, MATERIAL_LOOKUP_VERSION }

export type CreateAgent3LockedOutputParams = {
  product_id: string
  locked_input_id: string
  lock_hash: string
  score_payload: Agent3LockedOutputScorePayload
  math_breakdown: Agent3LockedOutputMathBreakdown
  display_payload?: Agent3LockedOutputDisplayPayload | null
  review_status?: Agent3LockedOutputReviewStatus
  created_by_system?: string
  supersedes_output_id?: string | null
}

function nowIso(): string {
  return new Date().toISOString()
}

export async function createAgent3LockedOutput(
  params: CreateAgent3LockedOutputParams,
): Promise<Agent3LockedOutputRow> {
  const ts = nowIso()
  const row = {
    product_id: params.product_id,
    locked_input_id: params.locked_input_id,
    lock_hash: params.lock_hash,
    input_source: 'locked_input_package' as const,
    methodology_version: METHODOLOGY_VERSION,
    material_lookup_version: MATERIAL_LOOKUP_VERSION,
    score_payload: params.score_payload,
    math_breakdown: params.math_breakdown,
    display_payload: params.display_payload ?? null,
    review_status: params.review_status ?? 'pending_review',
    created_by_system: params.created_by_system ?? 'system:agent3-locked-input',
    created_at: ts,
    updated_at: ts,
    reviewed_at: null,
    reviewed_by: null,
    review_notes: null,
    supersedes_output_id: params.supersedes_output_id ?? null,
    superseded_by_output_id: null,
  }

  const { data, error } = await supabase
    .from('agent3_locked_outputs')
    .insert(row)
    .select('*')
    .single()

  if (error) throw error
  const created = data as Agent3LockedOutputRow

  const { data: priors, error: priorError } = await supabase
    .from('agent3_locked_outputs')
    .select('locked_output_id')
    .eq('locked_input_id', params.locked_input_id)
    .neq('locked_output_id', created.locked_output_id)
    .neq('review_status', 'superseded')

  if (priorError) throw priorError
  for (const prior of priors ?? []) {
    await supersedeAgent3LockedOutput({
      locked_output_id: prior.locked_output_id,
      superseded_by_output_id: created.locked_output_id,
    })
  }

  return created
}

export async function getLatestAgent3LockedOutputForLockedInput(
  lockedInputId: string,
): Promise<Agent3LockedOutputRow | null> {
  const { data, error } = await supabase
    .from('agent3_locked_outputs')
    .select('*')
    .eq('locked_input_id', lockedInputId)
    .neq('review_status', 'superseded')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return (data as Agent3LockedOutputRow | null) ?? null
}

export async function getAgent3LockedOutputForReview(
  lockedOutputId: string,
): Promise<Agent3LockedOutputRow | null> {
  const { data, error } = await supabase
    .from('agent3_locked_outputs')
    .select('*')
    .eq('locked_output_id', lockedOutputId)
    .maybeSingle()

  if (error) throw error
  return (data as Agent3LockedOutputRow | null) ?? null
}

export async function getLatestAgent3LockedOutputForProduct(
  productId: string,
): Promise<Agent3LockedOutputRow | null> {
  const { data, error } = await supabase
    .from('agent3_locked_outputs')
    .select('*')
    .eq('product_id', productId)
    .neq('review_status', 'superseded')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return (data as Agent3LockedOutputRow | null) ?? null
}

export async function listPendingAgent3LockedOutputs(): Promise<Agent3LockedOutputRow[]> {
  const { data, error } = await supabase
    .from('agent3_locked_outputs')
    .select('*')
    .in('review_status', ['draft', 'pending_review'])
    .order('created_at', { ascending: false })

  if (error) throw error
  return pickLatestAgent3OutputPerLockedInput((data ?? []) as Agent3LockedOutputRow[])
}

export async function supersedeAgent3LockedOutput(params: {
  locked_output_id: string
  superseded_by_output_id: string
}): Promise<void> {
  const ts = nowIso()
  const { error } = await supabase
    .from('agent3_locked_outputs')
    .update({
      review_status: 'superseded',
      superseded_by_output_id: params.superseded_by_output_id,
      updated_at: ts,
    })
    .eq('locked_output_id', params.locked_output_id)

  if (error) throw error
}

export async function updateAgent3LockedOutputReviewStatus(params: {
  locked_output_id: string
  review_status: 'approved' | 'rejected' | 'pending_review' | 'draft'
  reviewed_by?: string | null
  review_notes?: string | null
}): Promise<Agent3LockedOutputRow> {
  const ts = nowIso()
  const { data, error } = await supabase
    .from('agent3_locked_outputs')
    .update({
      review_status: params.review_status,
      reviewed_by: params.reviewed_by ?? null,
      review_notes: params.review_notes ?? null,
      reviewed_at: ts,
      updated_at: ts,
    })
    .eq('locked_output_id', params.locked_output_id)
    .select('*')
    .single()

  if (error) throw error
  return data as Agent3LockedOutputRow
}
