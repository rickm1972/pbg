/**
 * Server-side persistence for agent1_proposed_inputs (Agent 1 runner).
 */

import { PROPOSED_PAYLOAD_SCHEMA_VERSION } from './build-proposed-inputs.mjs'

/**
 * Mark prior proposal drafts for this product as superseded.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} productId
 * @param {string} [exceptProposedInputId]
 */
export async function supersedePriorAgent1ProposedInputs(
  supabase,
  productId,
  exceptProposedInputId = null,
) {
  let query = supabase
    .from('agent1_proposed_inputs')
    .update({
      proposal_status: 'superseded',
      updated_at: new Date().toISOString(),
    })
    .eq('product_id', productId)
    .neq('proposal_status', 'superseded')

  if (exceptProposedInputId) {
    query = query.neq('proposed_input_id', exceptProposedInputId)
  }

  const { error } = await query
  if (error) throw new Error(`Failed to supersede prior proposed inputs: ${error.message}`)
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {object} params
 * @param {string} params.product_id
 * @param {string} params.evidence_id
 * @param {object} params.proposed_payload
 * @param {string | null} [params.agent1_run_id]
 * @param {string} [params.created_by_system]
 */
export async function persistAgent1ProposedInputDraft(supabase, params) {
  const ts = new Date().toISOString()
  const row = {
    product_id: params.product_id,
    evidence_id: params.evidence_id,
    agent1_run_id: params.agent1_run_id ?? params.evidence_id,
    schema_version: params.proposed_payload?.schema_version ?? PROPOSED_PAYLOAD_SCHEMA_VERSION,
    proposal_status: 'draft',
    proposed_payload: params.proposed_payload,
    reviewed_payload: null,
    reviewed_at: null,
    reviewed_by: null,
    created_by_system: params.created_by_system ?? 'system:agent1',
    created_by: null,
    created_at: ts,
    updated_at: ts,
  }

  const { data, error } = await supabase
    .from('agent1_proposed_inputs')
    .insert(row)
    .select('*')
    .single()

  if (error) {
    throw new Error(`Failed to insert agent1_proposed_inputs: ${error.message}`)
  }

  await supersedePriorAgent1ProposedInputs(supabase, params.product_id, data.proposed_input_id)
  return data
}

/**
 * Build + persist proposed closed-field draft after evidence save.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {object} params
 * @param {object} params.product
 * @param {object} params.evidence — saved product_evidence row
 */
export async function createProposedInputDraftForEvidence(supabase, { product, evidence }) {
  const { buildProposedInputPayload, assertProposedPayloadHasNoLockedFields } = await import(
    './build-proposed-inputs.mjs'
  )
  const proposed_payload = buildProposedInputPayload({ product, evidence })
  assertProposedPayloadHasNoLockedFields(proposed_payload)
  return persistAgent1ProposedInputDraft(supabase, {
    product_id: product.product_id,
    evidence_id: evidence.evidence_id,
    proposed_payload,
    agent1_run_id: evidence.evidence_id,
  })
}
