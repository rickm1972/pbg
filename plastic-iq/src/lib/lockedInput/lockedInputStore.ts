/**
 * Phase 1/2 locked-input read/write services.
 * Agent 1 runner persists proposals via scripts/agent1/proposed-input-supabase.mjs.
 */

import { supabase } from '../supabaseClient'
import { hashLockedInputPayload } from './lockHash'
import {
  buildLockedInputPackage,
  checkLockEligibility,
  LockEligibilityError,
} from './buildLockedInputPackage'
import type {
  Agent1LockedInput,
  Agent1ProposedInput,
  Agent1SystemValidation,
  LockedInputPayload,
  LockedInputStatus,
  ProposedInputPayload,
  ProposedInputStatus,
  ReviewedInputPayload,
  SystemValidationPayload,
  ValidationBlocker,
  ValidationStatus,
  ValidationWarning,
} from '../../types/lockedInput'
import { LOCKED_INPUT_SCHEMA_VERSION } from '../../types/lockedInput'
import { validateReviewedPayloadShape } from './reviewPayloadValidation'
import { buildSystemValidation } from './systemValidation'
import {
  assertValidationPayloadHasNoLockedFields,
  validateValidationPayloadShape,
} from './validationPayloadValidation'

export type CreateAgent1ProposedInputDraftParams = {
  product_id: string
  evidence_id: string
  proposed_payload: ProposedInputPayload
  agent1_run_id?: string | null
  created_by?: string | null
  created_by_system?: string
  schema_version?: string
  proposal_status?: ProposedInputStatus
}

export type UpdateAgent1ProposedInputDraftParams = {
  proposed_input_id: string
  proposed_payload?: ProposedInputPayload
  proposal_status?: ProposedInputStatus
  reviewed_payload?: ReviewedInputPayload | null
  reviewed_at?: string | null
  reviewed_by?: string | null
}

export type CreateAgent1SystemValidationParams = {
  product_id: string
  proposed_input_id: string
  validation_payload?: SystemValidationPayload
  validation_status?: ValidationStatus
  blockers?: ValidationBlocker[]
  warnings?: ValidationWarning[]
  schema_version?: string
  validated_at?: string | null
}

export type CreateAgent1LockedInputDraftParams = {
  product_id: string
  proposed_input_id: string
  validation_id?: string | null
  locked_payload: LockedInputPayload
  locked_input_status?: LockedInputStatus
  schema_version?: string
}

export type LockAgent1InputPackageParams = {
  locked_input_id: string
  locked_by?: string | null
  locked_at?: string
}

export type CreateLockedInputPackageFromValidationParams = {
  proposed_input_id: string
  validation_id?: string
  locked_by?: string | null
  /** When true, supersede existing locked_for_agent_3 package for the product. */
  supersede_existing?: boolean
}

export { LockEligibilityError, checkLockEligibility, buildLockedInputPackage }

function nowIso(): string {
  return new Date().toISOString()
}

export async function createAgent1ProposedInputDraft(
  params: CreateAgent1ProposedInputDraftParams,
): Promise<Agent1ProposedInput> {
  const ts = nowIso()
  const row = {
    product_id: params.product_id,
    evidence_id: params.evidence_id,
    agent1_run_id: params.agent1_run_id ?? null,
    schema_version: params.schema_version ?? LOCKED_INPUT_SCHEMA_VERSION,
    proposal_status: params.proposal_status ?? 'draft',
    proposed_payload: params.proposed_payload,
    reviewed_payload: null,
    reviewed_at: null,
    reviewed_by: null,
    created_by_system: params.created_by_system ?? 'system:agent1',
    created_by: params.created_by ?? null,
    created_at: ts,
    updated_at: ts,
  }

  const { data, error } = await supabase
    .from('agent1_proposed_inputs')
    .insert(row)
    .select('*')
    .single()

  if (error) throw error
  return data as Agent1ProposedInput
}

export async function getAgent1ProposedInput(
  proposedInputId: string,
): Promise<Agent1ProposedInput | null> {
  const { data, error } = await supabase
    .from('agent1_proposed_inputs')
    .select('*')
    .eq('proposed_input_id', proposedInputId)
    .maybeSingle()

  if (error) throw error
  return (data as Agent1ProposedInput | null) ?? null
}

/** Latest non-superseded proposed input for an evidence bundle (admin read-only). */
export async function getAgent1ProposedInputByEvidenceId(
  evidenceId: string,
): Promise<Agent1ProposedInput | null> {
  const { data, error } = await supabase
    .from('agent1_proposed_inputs')
    .select('*')
    .eq('evidence_id', evidenceId)
    .neq('proposal_status', 'superseded')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return (data as Agent1ProposedInput | null) ?? null
}

export type SaveAgent1ReviewedInputParams = {
  proposed_input_id: string
  reviewed_payload: ReviewedInputPayload
  reviewed_by?: string | null
  review_notes?: string | null
}

/** Load proposed input draft for human review (non-superseded). */
export async function getAgent1ReviewDraft(
  evidenceId: string,
): Promise<Agent1ProposedInput | null> {
  return getAgent1ProposedInputByEvidenceId(evidenceId)
}

/**
 * Save human-reviewed closed fields. Does not mutate proposed_payload.
 * Sets proposal_status = reviewed. Does not create validation or locked rows.
 */
export async function saveAgent1ReviewedInput(
  params: SaveAgent1ReviewedInputParams,
): Promise<Agent1ProposedInput> {
  validateReviewedPayloadShape(params.reviewed_payload)

  const reviewedAt = new Date().toISOString()
  const payload: ReviewedInputPayload = {
    ...params.reviewed_payload,
    reviewed_at: reviewedAt,
    reviewed_by: params.reviewed_by ?? null,
    review_notes: params.review_notes ?? params.reviewed_payload.review_notes ?? null,
  }

  const { data, error } = await supabase
    .from('agent1_proposed_inputs')
    .update({
      reviewed_payload: payload,
      reviewed_at: reviewedAt,
      reviewed_by: params.reviewed_by ?? null,
      proposal_status: 'reviewed',
      updated_at: reviewedAt,
    })
    .eq('proposed_input_id', params.proposed_input_id)
    .select('*')
    .single()

  if (error) throw error
  return data as Agent1ProposedInput
}

export async function updateAgent1ProposedInputDraft(
  params: UpdateAgent1ProposedInputDraftParams,
): Promise<Agent1ProposedInput> {
  const patch: Record<string, unknown> = { updated_at: nowIso() }
  if (params.proposed_payload !== undefined) patch.proposed_payload = params.proposed_payload
  if (params.proposal_status !== undefined) patch.proposal_status = params.proposal_status
  if (params.reviewed_payload !== undefined) patch.reviewed_payload = params.reviewed_payload
  if (params.reviewed_at !== undefined) patch.reviewed_at = params.reviewed_at
  if (params.reviewed_by !== undefined) patch.reviewed_by = params.reviewed_by

  const { data, error } = await supabase
    .from('agent1_proposed_inputs')
    .update(patch)
    .eq('proposed_input_id', params.proposed_input_id)
    .select('*')
    .single()

  if (error) throw error
  return data as Agent1ProposedInput
}

export async function createAgent1SystemValidation(
  params: CreateAgent1SystemValidationParams,
): Promise<Agent1SystemValidation> {
  const ts = nowIso()
  const row = {
    product_id: params.product_id,
    proposed_input_id: params.proposed_input_id,
    schema_version: params.schema_version ?? LOCKED_INPUT_SCHEMA_VERSION,
    validation_status: params.validation_status ?? 'pending',
    validation_payload: params.validation_payload ?? {
      schema_version: params.schema_version ?? LOCKED_INPUT_SCHEMA_VERSION,
      components: [],
    },
    blockers: params.blockers ?? [],
    warnings: params.warnings ?? [],
    validated_at: params.validated_at ?? null,
    created_at: ts,
    updated_at: ts,
  }

  const { data, error } = await supabase
    .from('agent1_system_validations')
    .insert(row)
    .select('*')
    .single()

  if (error) throw error
  return data as Agent1SystemValidation
}

export async function getAgent1SystemValidation(
  validationId: string,
): Promise<Agent1SystemValidation | null> {
  const { data, error } = await supabase
    .from('agent1_system_validations')
    .select('*')
    .eq('validation_id', validationId)
    .maybeSingle()

  if (error) throw error
  return (data as Agent1SystemValidation | null) ?? null
}

/** Latest validation row for a proposed input draft (non-superseded). */
export async function getLatestAgent1SystemValidationForProposal(
  proposedInputId: string,
): Promise<Agent1SystemValidation | null> {
  const { data, error } = await supabase
    .from('agent1_system_validations')
    .select('*')
    .eq('proposed_input_id', proposedInputId)
    .neq('validation_status', 'superseded')
    .order('validated_at', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return (data as Agent1SystemValidation | null) ?? null
}

/**
 * Run system validation on human-reviewed closed fields.
 * Creates agent1_system_validations row; does not create locked inputs or scores.
 */
export async function validateAgent1ReviewedInput(
  proposedInputId: string,
): Promise<Agent1SystemValidation> {
  const proposed = await getAgent1ProposedInput(proposedInputId)
  if (!proposed) {
    throw new Error(`agent1_proposed_inputs row not found: ${proposedInputId}`)
  }
  if (!proposed.reviewed_payload) {
    throw new Error('reviewed_payload is required before system validation')
  }

  validateReviewedPayloadShape(proposed.reviewed_payload)

  const result = buildSystemValidation({
    reviewed_payload: proposed.reviewed_payload,
    product: {
      product_id: proposed.product_id,
      category: proposed.reviewed_payload.product_context?.category ?? null,
      subcategory: proposed.reviewed_payload.product_context?.subcategory ?? null,
      product_name: proposed.reviewed_payload.product_context?.product_name ?? null,
    },
    proposed_input_id: proposed.proposed_input_id,
    evidence_id: proposed.evidence_id,
  })

  validateValidationPayloadShape(result.validation_payload)
  assertValidationPayloadHasNoLockedFields(result.validation_payload)

  return createAgent1SystemValidation({
    product_id: proposed.product_id,
    proposed_input_id: proposed.proposed_input_id,
    validation_payload: result.validation_payload,
    validation_status: result.validation_status as ValidationStatus,
    blockers: result.blockers,
    warnings: result.warnings,
    schema_version: result.validation_payload.schema_version,
    validated_at: result.validated_at,
  })
}

export async function createLockedInputPackageFromValidation(
  params: CreateLockedInputPackageFromValidationParams,
): Promise<Agent1LockedInput> {
  const proposed = await getAgent1ProposedInput(params.proposed_input_id)
  if (!proposed) {
    throw new Error(`agent1_proposed_inputs row not found: ${params.proposed_input_id}`)
  }

  const validation = params.validation_id
    ? await getAgent1SystemValidation(params.validation_id)
    : await getLatestAgent1SystemValidationForProposal(params.proposed_input_id)

  if (!validation) {
    throw new Error('agent1_system_validations row required before locking')
  }

  const lockedAt = nowIso()
  const lockedPayload = buildLockedInputPackage({
    proposed,
    validation,
    locked_by: params.locked_by ?? null,
    locked_at: lockedAt,
  })

  const existingActive = await getActiveLockedInputForProduct(proposed.product_id)
  if (existingActive && !params.supersede_existing) {
    throw new LockEligibilityError(
      `Active locked package already exists (${existingActive.locked_input_id}). Pass supersede_existing=true to supersede.`,
      ['ACTIVE_LOCK_EXISTS'],
    )
  }

  const draft = await createAgent1LockedInputDraft({
    product_id: proposed.product_id,
    proposed_input_id: proposed.proposed_input_id,
    validation_id: validation.validation_id,
    locked_payload: lockedPayload,
    locked_input_status: 'draft',
  })

  if (existingActive && params.supersede_existing) {
    await supersedeLockedInputPackage(existingActive.locked_input_id, draft.locked_input_id)
  }

  return lockAgent1InputPackage({
    locked_input_id: draft.locked_input_id,
    locked_by: params.locked_by ?? null,
    locked_at: lockedAt,
  })
}

/** Active locked_for_agent_3 package for a product (Phase 5). */
export async function getActiveLockedInputForProduct(
  productId: string,
): Promise<Agent1LockedInput | null> {
  return getLockedInputForProduct(productId)
}

export async function createAgent1LockedInputDraft(
  params: CreateAgent1LockedInputDraftParams,
): Promise<Agent1LockedInput> {
  const ts = nowIso()
  const row = {
    product_id: params.product_id,
    proposed_input_id: params.proposed_input_id,
    validation_id: params.validation_id ?? null,
    schema_version: params.schema_version ?? LOCKED_INPUT_SCHEMA_VERSION,
    locked_input_status: params.locked_input_status ?? 'draft',
    locked_payload: params.locked_payload,
    lock_hash: null,
    locked_at: null,
    locked_by: null,
    superseded_by: null,
    created_at: ts,
    updated_at: ts,
  }

  const { data, error } = await supabase
    .from('agent1_locked_inputs')
    .insert(row)
    .select('*')
    .single()

  if (error) throw error
  return data as Agent1LockedInput
}

export async function lockAgent1InputPackage(
  params: LockAgent1InputPackageParams,
): Promise<Agent1LockedInput> {
  const existing = await getAgent1LockedInputById(params.locked_input_id)
  if (!existing) {
    throw new Error(`agent1_locked_inputs row not found: ${params.locked_input_id}`)
  }

  const lockedAt = params.locked_at ?? nowIso()
  const payloadWithMeta: LockedInputPayload = {
    ...existing.locked_payload,
    locked_input_package_id: existing.locked_input_id,
    locked_at: lockedAt,
    locked_by: params.locked_by ?? null,
  }
  const lockHash = hashLockedInputPayload(payloadWithMeta)

  const { data, error } = await supabase
    .from('agent1_locked_inputs')
    .update({
      locked_input_status: 'locked_for_agent_3',
      locked_payload: payloadWithMeta,
      lock_hash: lockHash,
      locked_at: lockedAt,
      locked_by: params.locked_by ?? null,
      updated_at: lockedAt,
    })
    .eq('locked_input_id', params.locked_input_id)
    .select('*')
    .single()

  if (error) throw error
  return data as Agent1LockedInput
}

export async function getAgent1LockedInputById(
  lockedInputId: string,
): Promise<Agent1LockedInput | null> {
  const { data, error } = await supabase
    .from('agent1_locked_inputs')
    .select('*')
    .eq('locked_input_id', lockedInputId)
    .maybeSingle()

  if (error) throw error
  return (data as Agent1LockedInput | null) ?? null
}

export async function getLockedInputForProduct(
  productId: string,
): Promise<Agent1LockedInput | null> {
  const { data, error } = await supabase
    .from('agent1_locked_inputs')
    .select('*')
    .eq('product_id', productId)
    .eq('locked_input_status', 'locked_for_agent_3')
    .order('locked_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return (data as Agent1LockedInput | null) ?? null
}

/** Future Agent 3 read entry point — returns active locked package only. */
export async function getLockedInputForAgent3(
  productId: string,
): Promise<Agent1LockedInput | null> {
  return getLockedInputForProduct(productId)
}

export async function supersedeLockedInputPackage(
  lockedInputId: string,
  supersededByLockedInputId: string,
): Promise<Agent1LockedInput> {
  const ts = nowIso()
  const { data, error } = await supabase
    .from('agent1_locked_inputs')
    .update({
      locked_input_status: 'superseded',
      superseded_by: supersededByLockedInputId,
      updated_at: ts,
    })
    .eq('locked_input_id', lockedInputId)
    .select('*')
    .single()

  if (error) throw error
  return data as Agent1LockedInput
}
