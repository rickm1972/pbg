/**
 * Phase 7 — Agent 4 locked-audit persistence (agent4_locked_audits only).
 */
import { supabase } from '../supabaseClient'
import type {
  Agent4ConsistencyCheck,
  Agent4AuditIssue,
  Agent4LockedAuditPayload,
  Agent4LockedAuditRow,
  Agent4LockedAuditStatus,
} from '../../types/agent4LockedAudit'
import { pickLatestAgent4AuditPerLockedOutput } from '../lockedPipeline/activeRowSemantics'

export type CreateAgent4LockedAuditParams = {
  product_id: string
  locked_output_id: string
  locked_input_id: string
  lock_hash: string
  methodology_version: string
  material_lookup_version: string
  audit_status: Agent4LockedAuditStatus
  audit_payload: Agent4LockedAuditPayload
  blockers: Agent4AuditIssue[]
  warnings: Agent4AuditIssue[]
  consistency_checks: Agent4ConsistencyCheck[]
  created_by_system?: string
  supersedes_audit_id?: string | null
}

function nowIso(): string {
  return new Date().toISOString()
}

/** One review-queue row per product: keep newest audit (rows must be newest-first). */
export function pickLatestAuditsPerProduct(rows: Agent4LockedAuditRow[]): Agent4LockedAuditRow[] {
  const latestByProduct = new Map<string, Agent4LockedAuditRow>()
  for (const row of rows) {
    if (!latestByProduct.has(row.product_id)) {
      latestByProduct.set(row.product_id, row)
    }
  }
  return [...latestByProduct.values()]
}

export async function createAgent4LockedAudit(
  params: CreateAgent4LockedAuditParams,
): Promise<Agent4LockedAuditRow> {
  const ts = nowIso()
  const row = {
    product_id: params.product_id,
    locked_output_id: params.locked_output_id,
    locked_input_id: params.locked_input_id,
    lock_hash: params.lock_hash,
    input_source: 'agent3_locked_output' as const,
    methodology_version: params.methodology_version,
    material_lookup_version: params.material_lookup_version,
    audit_status: params.audit_status,
    audit_payload: params.audit_payload,
    blockers: params.blockers,
    warnings: params.warnings,
    consistency_checks: params.consistency_checks,
    created_by_system: params.created_by_system ?? 'system:agent4-locked-audit',
    created_at: ts,
    updated_at: ts,
    reviewed_at: null,
    reviewed_by: null,
    review_notes: null,
    supersedes_audit_id: params.supersedes_audit_id ?? null,
    superseded_by_audit_id: null,
  }

  const { data, error } = await supabase
    .from('agent4_locked_audits')
    .insert(row)
    .select('*')
    .single()

  if (error) throw error
  const created = data as Agent4LockedAuditRow

  const { data: priors, error: priorError } = await supabase
    .from('agent4_locked_audits')
    .select('locked_audit_id, audit_status')
    .eq('locked_output_id', params.locked_output_id)
    .neq('locked_audit_id', created.locked_audit_id)
    .neq('audit_status', 'superseded')

  if (priorError) throw priorError
  for (const prior of priors ?? []) {
    await supersedeAgent4LockedAudit({
      locked_audit_id: prior.locked_audit_id,
      superseded_by_audit_id: created.locked_audit_id,
    })
  }

  return created
}

export async function getAgent4LockedAuditForReview(
  lockedAuditId: string,
): Promise<Agent4LockedAuditRow | null> {
  const { data, error } = await supabase
    .from('agent4_locked_audits')
    .select('*')
    .eq('locked_audit_id', lockedAuditId)
    .maybeSingle()

  if (error) throw error
  return (data as Agent4LockedAuditRow | null) ?? null
}

export async function getLatestAgent4LockedAuditForOutput(
  lockedOutputId: string,
): Promise<Agent4LockedAuditRow | null> {
  const { data, error } = await supabase
    .from('agent4_locked_audits')
    .select('*')
    .eq('locked_output_id', lockedOutputId)
    .neq('audit_status', 'superseded')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return (data as Agent4LockedAuditRow | null) ?? null
}

export async function getLatestAgent4LockedAuditForProduct(
  productId: string,
): Promise<Agent4LockedAuditRow | null> {
  const { data, error } = await supabase
    .from('agent4_locked_audits')
    .select('*')
    .eq('product_id', productId)
    .neq('audit_status', 'superseded')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return (data as Agent4LockedAuditRow | null) ?? null
}

export async function listReviewableAgent4LockedAudits(): Promise<Agent4LockedAuditRow[]> {
  const { data, error } = await supabase
    .from('agent4_locked_audits')
    .select('*')
    .in('audit_status', ['passed', 'failed', 'pending_review', 'draft'])
    .order('created_at', { ascending: false })

  if (error) throw error
  return pickLatestAgent4AuditPerLockedOutput((data ?? []) as Agent4LockedAuditRow[])
}

export async function supersedeAgent4LockedAudit(params: {
  locked_audit_id: string
  superseded_by_audit_id: string
}): Promise<void> {
  const ts = nowIso()
  const { error } = await supabase
    .from('agent4_locked_audits')
    .update({
      audit_status: 'superseded',
      superseded_by_audit_id: params.superseded_by_audit_id,
      updated_at: ts,
    })
    .eq('locked_audit_id', params.locked_audit_id)

  if (error) throw error
}

export async function updateAgent4LockedAuditReviewStatus(params: {
  locked_audit_id: string
  audit_status: 'rejected' | 'pending_review'
  reviewed_by?: string | null
  review_notes?: string | null
}): Promise<Agent4LockedAuditRow> {
  const ts = nowIso()
  const { data, error } = await supabase
    .from('agent4_locked_audits')
    .update({
      audit_status: params.audit_status,
      reviewed_by: params.reviewed_by ?? null,
      review_notes: params.review_notes ?? null,
      reviewed_at: ts,
      updated_at: ts,
    })
    .eq('locked_audit_id', params.locked_audit_id)
    .select('*')
    .single()

  if (error) throw error
  return data as Agent4LockedAuditRow
}
