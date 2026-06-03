/**
 * Gate 1: persist human edits to draft / pending_review evidence_version.
 * Rebuilds field_provenance + legacy facts from structured_evidence (Agent 2 source of truth).
 */

import { createClient } from '@supabase/supabase-js'
import { bridgeLegacyFacts } from './bridge-legacy.mjs'
import { buildFieldProvenance } from './field-provenance.mjs'
import { applyCanonicalMappings } from '../src/shared/canonical-taxonomy/map-structured-evidence.mjs'

function supabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
  }
  return createClient(url, key, { auth: { persistSession: false } })
}

/**
 * @param {{
 *   evidence_id: string
 *   structured_evidence: object
 *   field_edit_audit?: Array<{ path: string, prior_value: string | null, new_value: string, edited_by: string, edited_at: string }>
 *   edited_by?: string | null
 * }} params
 */
export async function saveEvidenceDraft(params) {
  const { evidence_id, structured_evidence, field_edit_audit = [], edited_by = null } = params
  if (!evidence_id) throw new Error('evidence_id is required')
  if (!structured_evidence || typeof structured_evidence !== 'object') {
    throw new Error('structured_evidence is required')
  }

  const sb = supabaseAdmin()
  const { data: row, error: loadErr } = await sb
    .from('product_evidence')
    .select('evidence_id, product_id, review_status, sources, facts, agent_metadata')
    .eq('evidence_id', evidence_id)
    .maybeSingle()

  if (loadErr) throw loadErr
  if (!row) throw new Error(`Evidence ${evidence_id} not found`)

  const status = row.review_status
  if (status !== 'draft' && status !== 'pending_review') {
    throw new Error(`Cannot edit evidence in status "${status}"`)
  }

  const sources = row.sources ?? []
  const structured = structured_evidence
  applyCanonicalMappings(structured, sources, { facts: row.facts ?? [] })
  const field_provenance = buildFieldProvenance(structured, sources)
  const facts = bridgeLegacyFacts(structured, sources)

  const priorMeta = row.agent_metadata && typeof row.agent_metadata === 'object' ? row.agent_metadata : {}
  const priorAudit = Array.isArray(priorMeta.field_edit_audit) ? priorMeta.field_edit_audit : []
  const agent_metadata = {
    ...priorMeta,
    structured_evidence: structured,
    field_edit_audit: [...priorAudit, ...field_edit_audit],
  }

  const { data: updated, error: updErr } = await sb
    .from('product_evidence')
    .update({
      facts,
      field_provenance,
      agent_metadata,
      updated_at: new Date().toISOString(),
    })
    .eq('evidence_id', evidence_id)
    .select('*')
    .single()

  if (updErr) throw updErr

  return {
    evidence: updated,
    edited_by,
    field_provenance_keys: Object.keys(field_provenance).length,
    facts_count: facts.length,
  }
}
