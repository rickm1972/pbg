import { supabase } from './supabaseClient'
import { checkPublishChain } from './publishApi'
import type { PublishStatus } from '../types/agent'

export type GateReviewStatus = 'none' | 'pending_review' | 'approved' | 'rejected' | 'draft' | 'superseded'

export type ProductPipelineGateSnapshot = {
  productId: string
  gate1: GateReviewStatus
  gate2: GateReviewStatus
  gate3: GateReviewStatus
  gate4: PublishStatus | string
  activeEvidenceId: string | null
  activeInputId: string | null
  activeScoreId: string | null
  canPublish: boolean
  publishBlockers: string[]
}

function pickGateStatus(
  pending: boolean,
  approved: boolean,
  rejected: boolean,
): GateReviewStatus {
  if (pending) return 'pending_review'
  if (approved) return 'approved'
  if (rejected) return 'rejected'
  return 'none'
}

export async function fetchProductPipelineSnapshot(
  productId: string,
): Promise<ProductPipelineGateSnapshot> {
  const { data: product, error: productError } = await supabase
    .from('products')
    .select('publish_status, active_evidence_id')
    .eq('product_id', productId)
    .maybeSingle()

  if (productError) throw productError

  const { data: evidenceRows } = await supabase
    .from('product_evidence')
    .select('evidence_id, review_status')
    .eq('product_id', productId)

  const { data: inputRows } = await supabase
    .from('scoring_inputs')
    .select('input_id, review_status, evidence_id')
    .eq('product_id', productId)
    .order('run_timestamp', { ascending: false })

  const { data: scoreRows } = await supabase
    .from('product_scores')
    .select('score_id, review_status, input_id')
    .eq('product_id', productId)
    .order('run_timestamp', { ascending: false })

  const activeEvidenceId = (product?.active_evidence_id as string | null) ?? null

  const evidencePending = (evidenceRows ?? []).some((r) => r.review_status === 'pending_review')
  const evidenceApproved =
    Boolean(activeEvidenceId) ||
    (evidenceRows ?? []).some((r) => r.review_status === 'approved')
  const evidenceRejected = (evidenceRows ?? []).some((r) => r.review_status === 'rejected')

  const inputPending = (inputRows ?? []).some((r) => r.review_status === 'pending_review')
  const approvedInput = (inputRows ?? []).find((r) => r.review_status === 'approved')
  const inputRejected = (inputRows ?? []).some((r) => r.review_status === 'rejected')

  const scorePending = (scoreRows ?? []).some((r) => r.review_status === 'pending_review')
  const approvedScore = (scoreRows ?? []).find((r) => r.review_status === 'approved')
  const scoreRejected = (scoreRows ?? []).some((r) => r.review_status === 'rejected')

  const chain = await checkPublishChain(productId)

  return {
    productId,
    gate1: pickGateStatus(evidencePending, evidenceApproved, evidenceRejected),
    gate2: pickGateStatus(inputPending, Boolean(approvedInput), inputRejected),
    gate3: pickGateStatus(scorePending, Boolean(approvedScore), scoreRejected),
    gate4: (product?.publish_status as string) ?? 'draft',
    activeEvidenceId,
    activeInputId: approvedInput?.input_id ?? null,
    activeScoreId: approvedScore?.score_id ?? null,
    canPublish: chain.canPublish,
    publishBlockers: chain.missingGates,
  }
}

export function gateStatusLabel(status: GateReviewStatus | string): string {
  if (status === 'none') return 'None'
  return status.replace(/_/g, ' ')
}

export function publishStatusLabel(status: string): string {
  return status.replace(/_/g, ' ')
}
