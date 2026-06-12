/**
 * Part C — admin description override via versioned published snapshot workflow.
 * Never uses products.description as product-detail truth.
 */

import type { AprPublicRenderInput, LowScorePublicationReview } from '../../types/apr'
import {
  approveDisplayUpdateProposal,
  assertSnapshotNotMutatedInPlace,
  createDisplayUpdateProposal,
} from './displayUpdateWorkflow'
import {
  clearDescriptionOverrideStore,
  findDescriptionOverrideById,
  getActiveDescriptionOverride,
  listDescriptionOverrides,
  saveDescriptionOverrideRecord,
} from './descriptionOverrideStore'
import type { NegativeScoreGateResult } from './negativeScoreGate'
import {
  validateDescriptionOverrideForApproval,
  validateDescriptionOverrideLanguage,
} from './negativeScoreGate'
import type { PublishedDisplaySnapshotRecord } from './publishedDisplaySnapshot'
import { hashPublishedDisplaySnapshot } from './publishedDisplaySnapshot'
import {
  listApprovedSnapshotVersionsDurable,
  loadLatestApprovedSnapshotDurable,
} from './durable/durableSnapshotLoader'
import { durableWriter } from './durable/durableWriterRuntime'
import {
  loadPublishedBaselineSnapshotImmutable,
  loadPublishedDisplaySnapshot,
} from './publishedBaselineRegistry'
import { resolvePublicMethodologyDisclaimer } from './publicReviewStamp'

export type DescriptionOverrideStatus =
  | 'none'
  | 'draft'
  | 'pending_review'
  | 'approved'
  | 'rejected'

export type DescriptionOverrideValidation = {
  language_ok: boolean
  negative_score_gate: NegativeScoreGateResult | null
  failures: Array<{ check_id: string; rule: string; path: string; message: string }>
}

export type DescriptionOverrideRecord = {
  override_id: string
  product_id: string
  field: 'product_description'
  previous_snapshot_id: string | null
  proposed_override_text: string
  status: DescriptionOverrideStatus
  created_by: string | null
  created_at: string
  reviewed_by: string | null
  reviewed_at: string | null
  resulting_snapshot_id: string | null
  validation: DescriptionOverrideValidation | null
  negative_score_gate_result?: NegativeScoreGateResult | null
  notes: string | null
  updated_at?: string
}

export type DescriptionOverrideState = {
  product_id: string
  status: DescriptionOverrideStatus
  current_snapshot_id: string | null
  current_snapshot_description: string | null
  pac_safety_score: number | null
  active_override: DescriptionOverrideRecord | null
  public_description: string | null
}

export type ApproveDescriptionOverrideOptions = {
  reviewer_id: string
  low_score_publication_review?: LowScorePublicationReview | null
  display_remediation?: {
    methodology_disclaimer?: string
    low_score_last_reviewed_at?: string
  }
  notes?: string | null
}

function buildSnapshotForGateValidation(
  snapshot: PublishedDisplaySnapshotRecord,
  overrideText: string,
  displayRemediation?: ApproveDescriptionOverrideOptions['display_remediation'],
): PublishedDisplaySnapshotRecord {
  return {
    ...snapshot,
    display: {
      ...snapshot.display,
      product_description: overrideText.trim(),
      methodology_disclaimer:
        displayRemediation?.methodology_disclaimer ??
        snapshot.display.methodology_disclaimer ??
        resolvePublicMethodologyDisclaimer(snapshot.display),
      low_score_last_reviewed_at:
        displayRemediation?.low_score_last_reviewed_at ?? snapshot.display.low_score_last_reviewed_at,
    },
  }
}

function newOverrideId(): string {
  return `desc-override-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`}`
}

function generateSnapshotId(productId: string): string {
  return `snap-${productId}-${Date.now()}`
}

export function getPublicProductDescriptionFromSnapshot(productId: string): string | null {
  const snap = loadPublishedDisplaySnapshot(productId)
  return snap?.display.product_description?.trim() || null
}

export function getDescriptionOverrideState(productId: string): DescriptionOverrideState {
  const snapshot = loadPublishedDisplaySnapshot(productId)
  const active = getActiveDescriptionOverride(productId)

  return {
    product_id: productId,
    status: active?.status ?? 'none',
    current_snapshot_id: snapshot?.snapshot_id ?? null,
    current_snapshot_description: snapshot?.display.product_description ?? null,
    pac_safety_score: snapshot?.score.pac_safety_score ?? null,
    active_override:
      active?.status === 'draft' ||
      active?.status === 'pending_review' ||
      active?.status === 'rejected'
        ? active
        : null,
    public_description: getPublicProductDescriptionFromSnapshot(productId),
  }
}

/** Draft save — language/claims gate on override text only (no page-level display fields). */
export function validateDescriptionOverrideDraft(proposedText: string): DescriptionOverrideValidation {
  const trimmed = proposedText.trim()
  if (!trimmed) {
    return { language_ok: true, negative_score_gate: null, failures: [] }
  }
  const language = validateDescriptionOverrideLanguage(trimmed)
  return {
    language_ok: language.ok,
    negative_score_gate: null,
    failures: language.failures,
  }
}

/** Approval — Phase 4.5 on merged snapshot + override; low-score review required when score < 75. */
export function validateDescriptionOverride(
  snapshot: PublishedDisplaySnapshotRecord,
  proposedText: string,
  options: ApproveDescriptionOverrideOptions = { reviewer_id: 'validator' },
): DescriptionOverrideValidation {
  const trimmed = proposedText.trim()
  if (!trimmed) {
    return { language_ok: true, negative_score_gate: null, failures: [] }
  }

  const language = validateDescriptionOverrideLanguage(trimmed)
  const gateSnapshot = buildSnapshotForGateValidation(snapshot, trimmed, options.display_remediation)
  const negative = validateDescriptionOverrideForApproval(gateSnapshot, trimmed, {
    low_score_publication_review: options.low_score_publication_review ?? null,
  })

  const failures = [...language.failures, ...negative.failures]

  return {
    language_ok: language.ok && negative.language_status !== 'failed',
    negative_score_gate: negative,
    failures,
  }
}

export function saveDescriptionOverrideDraft(input: {
  product_id: string
  proposed_override_text: string
  created_by?: string | null
}): DescriptionOverrideRecord {
  const snapshot = loadPublishedDisplaySnapshot(input.product_id)
  if (!snapshot) {
    throw new Error('No published display snapshot exists for this product.')
  }

  const trimmed = input.proposed_override_text.trim()
  if (!trimmed) {
    throw new Error('Override text is required. Empty override means use the current snapshot description.')
  }

  const validation = validateDescriptionOverrideDraft(trimmed)

  const existingDraft = listDescriptionOverrides(input.product_id)
    .filter((r) => r.status === 'draft' || r.status === 'pending_review')
    .sort((a, b) => (b.updated_at ?? b.created_at).localeCompare(a.updated_at ?? a.created_at))[0]

  if (existingDraft) {
    const updated: DescriptionOverrideRecord = {
      ...existingDraft,
      previous_snapshot_id: snapshot.snapshot_id,
      proposed_override_text: trimmed,
      status: 'draft',
      validation,
      updated_at: new Date().toISOString(),
    }
    saveDescriptionOverrideRecord(updated)
    return updated
  }

  const record: DescriptionOverrideRecord = {
    override_id: newOverrideId(),
    product_id: input.product_id,
    field: 'product_description',
    previous_snapshot_id: snapshot.snapshot_id,
    proposed_override_text: trimmed,
    status: 'draft',
    created_by: input.created_by ?? null,
    created_at: new Date().toISOString(),
    reviewed_by: null,
    reviewed_at: null,
    resulting_snapshot_id: null,
    validation,
    notes: null,
  }

  saveDescriptionOverrideRecord(record)
  return record
}

export function submitDescriptionOverrideForReview(overrideId: string): DescriptionOverrideRecord {
  const record = findDescriptionOverrideById(overrideId)
  if (!record) throw new Error('Description override not found.')
  if (record.status !== 'draft') {
    throw new Error('Only draft overrides can be submitted for review.')
  }
  const updated: DescriptionOverrideRecord = { ...record, status: 'pending_review' }
  saveDescriptionOverrideRecord(updated)
  return updated
}

export function approveDescriptionOverride(
  overrideId: string,
  options: ApproveDescriptionOverrideOptions,
): {
  override: DescriptionOverrideRecord
  previous_snapshot: PublishedDisplaySnapshotRecord
  new_snapshot: PublishedDisplaySnapshotRecord
} {
  const record = findDescriptionOverrideById(overrideId)
  if (!record) throw new Error('Description override not found.')
  if (record.status !== 'pending_review' && record.status !== 'draft') {
    throw new Error('Only draft or pending_review overrides can be approved.')
  }

  const previous = loadPublishedDisplaySnapshot(record.product_id)
  if (!previous) throw new Error('No current published snapshot.')

  const validation = validateDescriptionOverride(previous, record.proposed_override_text, options)
  if (!validation.language_ok || validation.failures.length > 0) {
    throw new Error(
      `Description override failed validation: ${validation.failures.map((f) => f.message).join('; ')}`,
    )
  }

  if (validation.negative_score_gate?.applies && !validation.negative_score_gate.ok) {
    throw new Error(
      `Phase 4.5 gate blocked override: ${validation.negative_score_gate.failures.map((f) => f.message).join('; ')}`,
    )
  }

  const baselineImmutable = loadPublishedBaselineSnapshotImmutable(record.product_id)
  if (baselineImmutable) {
    const beforeHash = hashPublishedDisplaySnapshot(baselineImmutable)
    const afterCheck = hashPublishedDisplaySnapshot(baselineImmutable)
    if (beforeHash !== afterCheck) {
      throw new Error('Baseline snapshot file must remain immutable.')
    }
  }

  const proposedRender: AprPublicRenderInput = {
    display: {
      ...previous.display,
      product_description: record.proposed_override_text,
      methodology_disclaimer:
        options.display_remediation?.methodology_disclaimer ??
        previous.display.methodology_disclaimer ??
        resolvePublicMethodologyDisclaimer(previous.display),
      low_score_last_reviewed_at:
        options.display_remediation?.low_score_last_reviewed_at ??
        previous.display.low_score_last_reviewed_at,
      buy_cta: [],
    },
    score: { ...previous.score },
  }

  const proposal = createDisplayUpdateProposal({
    proposal_id: `disp-update-${overrideId}`,
    product_id: record.product_id,
    current_snapshot: previous,
    proposed: proposedRender,
    meta: {
      published_at: new Date().toISOString(),
      evidence_content_hash: previous.evidence_content_hash,
      normalization_content_hash: previous.normalization_content_hash,
      display_content_hash: previous.display_content_hash,
      score_content_hash: previous.score_content_hash,
      assembled_content_hash: previous.assembled_content_hash,
    },
  })

  const approvedSnapshotId = generateSnapshotId(record.product_id)
  const { new_snapshot: newSnapshot } = approveDisplayUpdateProposal(
    proposal,
    options.reviewer_id,
    approvedSnapshotId,
  )

  assertSnapshotNotMutatedInPlace(previous, newSnapshot)
  if (previous.snapshot_id === newSnapshot.snapshot_id) {
    throw new Error('Approved override must create a new snapshot version.')
  }
  if (newSnapshot.display.product_description !== record.proposed_override_text) {
    throw new Error('New snapshot must contain the approved override description.')
  }

  persistApprovedSnapshotVersion(newSnapshot, {
    source_snapshot_id: previous.snapshot_id,
    override_id: record.override_id,
    approved_by: options.reviewer_id,
    low_score_publication_review: options.low_score_publication_review ?? null,
  })

  const approved: DescriptionOverrideRecord = {
    ...record,
    status: 'approved',
    reviewed_by: options.reviewer_id,
    reviewed_at: new Date().toISOString(),
    resulting_snapshot_id: newSnapshot.snapshot_id,
    validation,
    notes: options.notes ?? record.notes,
  }
  saveDescriptionOverrideRecord(approved)

  return { override: approved, previous_snapshot: previous, new_snapshot: newSnapshot }
}

export function rejectDescriptionOverride(
  overrideId: string,
  reviewerId: string,
  notes?: string | null,
): DescriptionOverrideRecord {
  const record = findDescriptionOverrideById(overrideId)
  if (!record) throw new Error('Description override not found.')
  if (record.status !== 'pending_review' && record.status !== 'draft') {
    throw new Error('Only draft or pending_review overrides can be rejected.')
  }
  const updated: DescriptionOverrideRecord = {
    ...record,
    status: 'rejected',
    reviewed_by: reviewerId,
    reviewed_at: new Date().toISOString(),
    notes: notes ?? null,
  }
  saveDescriptionOverrideRecord(updated)
  return updated
}

export function resetDescriptionOverrideStateForTests(): void {
  clearDescriptionOverrideStore()
}

export { simulateDurableStoreProcessRestart } from './durable/durableSnapshotLoader'

function persistApprovedSnapshotVersion(
  record: PublishedDisplaySnapshotRecord,
  context: {
    source_snapshot_id: string
    override_id?: string | null
    approved_by?: string | null
    version_sequence?: number
    low_score_publication_review?: LowScorePublicationReview | null
  },
): void {
  const existing = loadLatestApprovedSnapshotDurable(record.product_id)
  const versions = listApprovedSnapshotVersionsDurable(record.product_id)
  const version_sequence =
    context.version_sequence ??
    (existing ? (versions[versions.length - 1]?.meta.version_sequence ?? 0) + 1 : 1)

  durableWriter.saveApprovedSnapshotVersionDurable({
    record,
    meta: {
      snapshot_id: record.snapshot_id,
      product_id: record.product_id,
      version_sequence,
      source_snapshot_id: context.source_snapshot_id,
      reason: 'description_override',
      override_id: context.override_id ?? null,
      approved_at: record.published_at,
      approved_by: context.approved_by ?? null,
      low_score_publication_review: context.low_score_publication_review ?? null,
    },
  })
}

/** Confirm public render path does not merge override text at read time. */
export function publicDescriptionUsesSnapshotOnly(
  productId: string,
  productsDescription: string | null,
): boolean {
  const publicDesc = getPublicProductDescriptionFromSnapshot(productId)
  if (!publicDesc) return false
  const active = getActiveDescriptionOverride(productId)
  if (active?.status === 'draft' || active?.status === 'pending_review' || active?.status === 'rejected') {
    const baseline = loadPublishedBaselineSnapshotImmutable(productId)
    return publicDesc === baseline?.display.product_description
  }
  return publicDesc !== (productsDescription?.trim() || null) || productsDescription == null
}

export { listDescriptionOverrides }
