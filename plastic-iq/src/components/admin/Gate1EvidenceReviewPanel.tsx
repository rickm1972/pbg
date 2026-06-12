import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  confidenceBadgeClass,
  formatAgent1ApiUsage,
  getStructuredEvidence,
  getWarnings,
} from '../../lib/agent1Review'
import { buildFieldProvenance } from '../../lib/evidenceFieldProvenance'
import {
  applyFieldValueEdit,
  appendFieldEditAudit,
  canEditEvidenceVersion,
  extractReviewFieldRows,
  getApprovalBlockers,
  getFieldEditAudit,
  groupFieldsBySource,
  isLegacyEvidenceBundle,
  sourceLabelForUrl,
  type ReviewFieldRow,
} from '../../lib/evidenceVersionFields'
import {
  fetchEvidenceVersionsForProduct,
  fetchProductReviewIdentity,
  saveEvidenceDraftRemote,
  type ProductReviewIdentity,
} from '../../lib/evidenceVersionApi'
import {
  ensureCanonicalMappingsOnStructured,
  getCanonicalApprovalBlockers,
} from '../../lib/canonicalEvidenceMapping'
import { PipelineStatusBar } from './PipelineStatusBar'
import { Gate1CanonicalMappingsPanel } from './Gate1CanonicalMappingsPanel'
import { Gate1SourcesReviewedPanel } from './Gate1SourcesReviewedPanel'
import { Gate1RequiredEvidenceChecklist } from './Gate1RequiredEvidenceChecklist'
import { Gate1OutOfScopeSafetySignals } from './Gate1OutOfScopeSafetySignals'
import { Gate1RequiredCheckResultsPanel } from './Gate1RequiredCheckResultsPanel'
import { applyRequiredEvidenceValidation } from '../../lib/requiredEvidenceValidation'
import {
  listScoreDrivingReviewAcknowledgments,
  resolveLiveRequiredEvidenceValidation,
} from '../../lib/gate1ApprovalEligibility'
import {
  canonicalReviewKey,
  listCanonicalReviewFieldKeys,
} from '../../lib/gate1CanonicalReviewKeys'
import { TAXONOMY_EXPANSION_REQUIRED } from '../../lib/canonicalEvidenceMapping'
import { Gate1DecisionSummary } from './Gate1DecisionSummary'
import { Gate1HumanReviewGatePanel } from './Gate1HumanReviewGatePanel'
import { Gate1SystemValidationPanel } from './Gate1SystemValidationPanel'
import { Gate1LockedInputPackagePanel } from './Gate1LockedInputPackagePanel'
import { getAgent1ProposedInputByEvidenceId } from '../../lib/lockedInput'
import type { Agent1ProposedInput } from '../../types/lockedInput'
import type {
  AgentMetadata,
  CanonicalMappingsPayload,
  ProductEvidence,
  ProductPipelineRow,
  StructuredEvidencePayload,
} from '../../types/agent'

type Props = {
  product: ProductPipelineRow
  evidence: ProductEvidence
  authUserEmail: string | null
  busy: boolean
  showRejectNotes: boolean
  rejectNotes: string
  onRejectNotesChange: (v: string) => void
  onApprove: () => void
  onRejectOpen: () => void
  onRejectCancel: () => void
  onRejectConfirm: () => void
  onRerun?: () => void
  onEvidenceSaved: (evidence: ProductEvidence) => void
}

const IDENTITY_MISMATCH_REASON =
  'Product identity mismatch — wrong product in evidence packet.'

export function Gate1EvidenceReviewPanel({
  product,
  evidence: initialEvidence,
  authUserEmail,
  busy,
  showRejectNotes,
  rejectNotes,
  onRejectNotesChange,
  onApprove,
  onRejectOpen,
  onRejectCancel,
  onRejectConfirm,
  onRerun,
  onEvidenceSaved,
}: Props) {
  const [evidence, setEvidence] = useState(initialEvidence)
  const [identity, setIdentity] = useState<ProductReviewIdentity | null>(null)
  const [versions, setVersions] = useState<ProductEvidence[]>([])
  const [tab, setTab] = useState<'review' | 'history'>('review')
  const [viewingId, setViewingId] = useState<string | null>(null)
  const [editingPath, setEditingPath] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [confirmedPaths, setConfirmedPaths] = useState<Set<string>>(() => new Set())
  const [warningsAcked, setWarningsAcked] = useState(false)
  const [requiredReviewsAcked, setRequiredReviewsAcked] = useState(false)
  const [canonicalConfirmedKeys, setCanonicalConfirmedKeys] = useState<Set<string>>(
    () => new Set(),
  )
  const [canonicalEditedKeys, setCanonicalEditedKeys] = useState<Set<string>>(() => new Set())
  const [canonicalRejectedKeys, setCanonicalRejectedKeys] = useState<Set<string>>(() => new Set())
  const [saveBusy, setSaveBusy] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [proposedInput, setProposedInput] = useState<Agent1ProposedInput | null>(null)

  useEffect(() => {
    setViewingId(null)
    setEditingPath(null)
    setConfirmedPaths(new Set())
    setWarningsAcked(false)
    setCanonicalConfirmedKeys(new Set())
    setCanonicalEditedKeys(new Set())
    setCanonicalRejectedKeys(new Set())
    setTab('review')

    const meta = initialEvidence.agent_metadata ?? {}
    const structured = getStructuredEvidence(meta)
    if (structured && !isLegacyEvidenceBundle(initialEvidence)) {
      const clone = JSON.parse(JSON.stringify(structured)) as StructuredEvidencePayload
      ensureCanonicalMappingsOnStructured(clone, initialEvidence.sources ?? [], initialEvidence.facts ?? [], {
        agent_metadata: initialEvidence.agent_metadata ?? { warnings: [] },
      })
      setEvidence({
        ...initialEvidence,
        agent_metadata: { ...meta, structured_evidence: clone },
      })
      return
    }
    setEvidence(initialEvidence)
  }, [initialEvidence.evidence_id])

  useEffect(() => {
    let cancelled = false
    fetchProductReviewIdentity(product.product_id)
      .then((row) => {
        if (!cancelled) setIdentity(row)
      })
      .catch(() => {
        if (!cancelled) setIdentity(null)
      })
    return () => {
      cancelled = true
    }
  }, [product.product_id])

  useEffect(() => {
    let cancelled = false
    fetchEvidenceVersionsForProduct(product.product_id)
      .then((rows) => {
        if (!cancelled) setVersions(rows)
      })
      .catch(() => {
        if (!cancelled) setVersions([])
      })
    return () => {
      cancelled = true
    }
  }, [product.product_id, evidence.evidence_id, evidence.updated_at])

  const displayEvidence = useMemo(() => {
    if (!viewingId || viewingId === evidence.evidence_id) return evidence
    return versions.find((v) => v.evidence_id === viewingId) ?? evidence
  }, [evidence, viewingId, versions])

  useEffect(() => {
    let cancelled = false
    void getAgent1ProposedInputByEvidenceId(displayEvidence.evidence_id)
      .then((row) => {
        if (!cancelled) setProposedInput(row)
      })
      .catch(() => {
        if (!cancelled) setProposedInput(null)
      })
    return () => {
      cancelled = true
    }
  }, [displayEvidence.evidence_id])

  const structuredForReview = useMemo(
    () => getStructuredEvidence(displayEvidence.agent_metadata ?? {}),
    [displayEvidence],
  )

  const canonicalMappings = structuredForReview?.canonical_mappings ?? null

  const requiredEvidenceValidation = useMemo(
    () =>
      resolveLiveRequiredEvidenceValidation(
        structuredForReview,
        displayEvidence.sources ?? [],
        displayEvidence.facts ?? [],
      ),
    [structuredForReview, displayEvidence.sources, displayEvidence.facts],
  )
  const requiredReviewAckItems = useMemo(
    () => listScoreDrivingReviewAcknowledgments(requiredEvidenceValidation),
    [requiredEvidenceValidation],
  )
  const requiredCheckResults = structuredForReview?.required_check_results ?? null

  const handleCanonicalUpdate = useCallback(
    (fieldKey: string, canonicalId: string, subKey?: string) => {
      setEvidence((prev) => {
        const meta = prev.agent_metadata ?? {}
        const structured = getStructuredEvidence(meta)
        if (!structured) return prev
        const clone = JSON.parse(JSON.stringify(structured)) as StructuredEvidencePayload
        const mappings: CanonicalMappingsPayload = {
          ...(clone.canonical_mappings ?? { schema_version: '3.5' }),
        }
        if (fieldKey === 'safety_claim_ids' && subKey) {
          const row = mappings.safety_claim_ids?.[subKey]
          if (row) {
            mappings.safety_claim_ids = {
              ...mappings.safety_claim_ids,
              [subKey]: { ...row, canonical_id: canonicalId },
            }
          }
        } else if (fieldKey === 'regulatory_flag_ids' && subKey != null) {
          const idx = Number(subKey)
          const flags = [...(mappings.regulatory_flag_ids ?? [])]
          if (flags[idx]) flags[idx] = { ...flags[idx], canonical_id: canonicalId }
          mappings.regulatory_flag_ids = flags
        } else if (fieldKey === 'primary_contact_material_id' && mappings.primary_contact_material_id) {
          mappings.primary_contact_material_id = {
            ...mappings.primary_contact_material_id,
            canonical_id: canonicalId,
          }
        } else if (fieldKey === 'substrate_material_id' && mappings.substrate_material_id) {
          mappings.substrate_material_id = {
            ...mappings.substrate_material_id,
            canonical_id: canonicalId,
          }
        } else if (fieldKey === 'coating_modifier_id' && mappings.coating_modifier_id) {
          mappings.coating_modifier_id = {
            ...mappings.coating_modifier_id,
            canonical_id: canonicalId,
          }
        } else if (fieldKey === 'pfas_status_id' && mappings.pfas_status_id) {
          mappings.pfas_status_id = { ...mappings.pfas_status_id, canonical_id: canonicalId }
        }
        mappings.blockers = getCanonicalApprovalBlockers(mappings, {
          subcategory: clone.product_identity?.subcategory,
        })
        clone.canonical_mappings = mappings
        applyRequiredEvidenceValidation(clone, prev.sources ?? [], { facts: prev.facts ?? [] })
        const rk = canonicalReviewKey(fieldKey, subKey)
        setCanonicalEditedKeys((prev) => new Set(prev).add(rk))
        return {
          ...prev,
          agent_metadata: { ...meta, structured_evidence: clone },
        }
      })
    },
    [],
  )

  const handleConfirmCanonicalKey = useCallback((key: string) => {
    setCanonicalConfirmedKeys((prev) => new Set(prev).add(key))
    setCanonicalRejectedKeys((prev) => {
      const next = new Set(prev)
      next.delete(key)
      return next
    })
  }, [])

  const handleRejectCanonicalKey = useCallback(
    (key: string) => {
      setCanonicalRejectedKeys((prev) => new Set(prev).add(key))
      const [fieldKey, subKey] = key.includes(':') ? key.split(':') : [key, undefined]
      handleCanonicalUpdate(fieldKey, TAXONOMY_EXPANSION_REQUIRED, subKey)
    },
    [handleCanonicalUpdate],
  )

  const editable = canEditEvidenceVersion(displayEvidence)
  const legacy = isLegacyEvidenceBundle(displayEvidence)
  const structured = getStructuredEvidence(displayEvidence.agent_metadata ?? {})
  const warnings = getWarnings(displayEvidence.agent_metadata ?? {})
  const threshold = displayEvidence.agent_metadata?.minimum_threshold
  const apiUsageLine = formatAgent1ApiUsage(displayEvidence.agent_metadata?.api_usage)

  const fieldRows = useMemo(() => extractReviewFieldRows(displayEvidence), [displayEvidence])
  const sourceGroups = useMemo(
    () => groupFieldsBySource(fieldRows, displayEvidence.sources ?? []),
    [fieldRows, displayEvidence.sources],
  )

  const allConfirmed = useMemo(() => {
    if (legacy || !editable) return true
    const editablePaths = fieldRows.filter((r) => r.editable).map((r) => r.path)
    if (editablePaths.length === 0) return true
    return editablePaths.every((p) => confirmedPaths.has(p))
  }, [legacy, editable, fieldRows, confirmedPaths])

  const canonicalReviewKeys = useMemo(
    () => listCanonicalReviewFieldKeys(canonicalMappings),
    [canonicalMappings],
  )

  const canonicalReviewConfirmed = useMemo(() => {
    if (legacy || !editable || canonicalReviewKeys.length === 0) return true
    return canonicalReviewKeys.every(
      (k) => canonicalConfirmedKeys.has(k) && !canonicalRejectedKeys.has(k),
    )
  }, [legacy, editable, canonicalReviewKeys, canonicalConfirmedKeys, canonicalRejectedKeys])

  const approvalBlockers = getApprovalBlockers({
    evidence: displayEvidence,
    warningsAcknowledged: warnings.length === 0 || warningsAcked,
    requiredEvidenceReviewsAcknowledged:
      requiredReviewAckItems.length === 0 || requiredReviewsAcked,
    allFieldsConfirmed: allConfirmed,
    canonicalReviewConfirmed,
  })

  const activeEvidenceId = identity?.active_evidence_id ?? product.active_evidence_id ?? null

  const handleStartEdit = (row: ReviewFieldRow) => {
    setEditingPath(row.path)
    setEditValue(row.value)
  }

  const handleConfirmField = (path: string) => {
    setConfirmedPaths((prev) => new Set(prev).add(path))
    setEditingPath(null)
  }

  const applyLocalStructuredEdit = useCallback(
    (path: string, newValue: string, priorValue: string) => {
      const baseStructured = getStructuredEvidence(displayEvidence.agent_metadata ?? {})
      if (!baseStructured) return
      const nextStructured = applyFieldValueEdit(baseStructured, path, newValue)
      const nextProvenance = buildFieldProvenance(nextStructured, displayEvidence.sources ?? [])
      const editor = authUserEmail ?? 'admin'
      const auditEntry = {
        path,
        prior_value: priorValue,
        new_value: newValue,
        edited_by: editor,
        edited_at: new Date().toISOString(),
      }
      const nextMeta = appendFieldEditAudit(
        displayEvidence.agent_metadata ?? {},
        auditEntry,
      ) as AgentMetadata

      if (displayEvidence.evidence_id === evidence.evidence_id) {
        setEvidence((prev) => ({
          ...prev,
          agent_metadata: { ...nextMeta, structured_evidence: nextStructured },
          field_provenance: nextProvenance,
        }))
      }
      setConfirmedPaths((prev) => new Set(prev).add(path))
      setEditingPath(null)
      return { nextStructured, auditEntry }
    },
    [displayEvidence, evidence.evidence_id, authUserEmail],
  )

  const handleSaveDraft = async () => {
    const draftStructured = getStructuredEvidence(displayEvidence.agent_metadata ?? {})
    if (!draftStructured || !editable) return
    setSaveError(null)
    setSaveBusy(true)
    try {
      const saved = await saveEvidenceDraftRemote({
        evidence_id: displayEvidence.evidence_id,
        structured_evidence: draftStructured as unknown as Record<string, unknown>,
        field_edit_audit: getFieldEditAudit(displayEvidence.agent_metadata ?? {}),
        edited_by: authUserEmail,
      })
      setEvidence(saved)
      onEvidenceSaved(saved)
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Save draft failed')
    } finally {
      setSaveBusy(false)
    }
  }

  const handleCommitEdit = (row: ReviewFieldRow) => {
    if (!getStructuredEvidence(displayEvidence.agent_metadata ?? {}) || !row.editable) return
    const result = applyLocalStructuredEdit(row.path, editValue, row.value)
    if (!result) return
    void (async () => {
      setSaveBusy(true)
      setSaveError(null)
      try {
        const saved = await saveEvidenceDraftRemote({
          evidence_id: displayEvidence.evidence_id,
          structured_evidence: result.nextStructured as unknown as Record<string, unknown>,
          field_edit_audit: [result.auditEntry],
          edited_by: authUserEmail,
        })
        setEvidence(saved)
        onEvidenceSaved(saved)
      } catch (e: unknown) {
        setSaveError(e instanceof Error ? e.message : 'Failed to persist field edit')
      } finally {
        setSaveBusy(false)
      }
    })()
  }

  const identityCard = (
    <section className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Product identity
      </h4>
      <div className="mt-3 flex flex-wrap gap-4">
        {identity?.image_url ? (
          <img
            src={identity.image_url}
            alt=""
            className="h-24 w-24 rounded-lg border border-slate-200 object-cover bg-white"
          />
        ) : null}
        <dl className="grid flex-1 gap-2 text-sm text-slate-800 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-slate-500">Brand</dt>
            <dd className="font-medium">{identity?.brand ?? product.brand ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Product name</dt>
            <dd className="font-medium">{identity?.product_name ?? product.product_name}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">
              {structured?.product_identity?.manufacturer_context_sku
                ? 'Retailer SKU'
                : 'ASIN / SKU'}
            </dt>
            <dd>
              {identity?.amazon_asin ??
                structured?.product_identity?.sku_or_model ??
                '—'}
            </dd>
          </div>
          {structured?.product_identity?.manufacturer_context_sku ? (
            <div>
              <dt className="text-xs text-slate-500">Manufacturer / context model</dt>
              <dd className="text-slate-700">
                {structured.product_identity.manufacturer_context_sku}
                <span className="ml-1 text-xs text-slate-500">(comparable SKU, not primary)</span>
              </dd>
            </div>
          ) : null}
          <div>
            <dt className="text-xs text-slate-500">Variant / subcategory</dt>
            <dd>
              {structured?.product_identity?.subcategory ??
                identity?.subcategory ??
                product.subcategory ??
                '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Category</dt>
            <dd>{identity?.category ?? product.category ?? '—'}</dd>
          </div>
        </dl>
      </div>
      {editable ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            onRejectNotesChange(IDENTITY_MISMATCH_REASON)
            onRejectOpen()
          }}
          className="mt-3 text-xs font-semibold text-red-800 underline hover:text-red-950"
        >
          Flag wrong product (reject)
        </button>
      ) : null}
    </section>
  )

  return (
    <article className="flex max-h-[80dvh] flex-col rounded-2xl border border-slate-200 bg-white shadow-card">
      <header className="shrink-0 border-b border-slate-100 p-4 pb-4 md:px-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-700">
              Gate 1 · Evidence version review
            </p>
            <h3 className="text-lg font-semibold text-ink-900">{product.product_name}</h3>
          </div>
          <StatusBadge status={displayEvidence.review_status} />
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Bundle v{displayEvidence.bundle_version} · {displayEvidence.algorithm_version} ·{' '}
          {displayEvidence.review_status === 'pending_review' && displayEvidence.pending_review_at
            ? `submitted ${new Date(displayEvidence.pending_review_at).toLocaleString()}`
            : displayEvidence.approved_at
              ? `approved ${new Date(displayEvidence.approved_at).toLocaleString()}`
              : `updated ${new Date(displayEvidence.updated_at).toLocaleString()}`}
        </p>
        {apiUsageLine ? (
          <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700 ring-1 ring-slate-200">
            <span className="font-semibold text-ink-900">Last run API usage:</span> {apiUsageLine}
          </p>
        ) : null}
      </header>

      <div className="shrink-0 px-4 md:px-6">
        <PipelineStatusBar productId={product.product_id} refreshKey={displayEvidence.evidence_id} />
      </div>

      <div className="mx-4 flex shrink-0 gap-2 border-b border-slate-100 md:mx-6">
        <TabButton active={tab === 'review'} onClick={() => setTab('review')}>
          Review
        </TabButton>
        <TabButton active={tab === 'history'} onClick={() => setTab('history')}>
          Version history ({versions.length})
        </TabButton>
      </div>

      {tab === 'history' ? (
        <VersionHistoryList
          versions={versions}
          activeEvidenceId={activeEvidenceId}
          selectedId={viewingId ?? evidence.evidence_id}
          onSelect={(id) => {
            setViewingId(id)
            const row = versions.find((v) => v.evidence_id === id)
            if (row && id !== evidence.evidence_id) {
              setTab('review')
            }
          }}
        />
      ) : null}

      {tab === 'review' ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6">
          {legacy ? (
            <div
              role="alert"
              className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
            >
              This evidence_version was created under the legacy architecture. To review with full
              per-field provenance, re-run Agent 1 for this product.
            </div>
          ) : null}

          <Gate1DecisionSummary
            product={product}
            evidence={displayEvidence}
            validation={requiredEvidenceValidation}
            approvalBlockers={approvalBlockers}
            legacy={legacy}
            proposedInput={proposedInput}
          />

          {!legacy && proposedInput ? (
            <Gate1HumanReviewGatePanel
              key={`${proposedInput.proposed_input_id}-${proposedInput.updated_at ?? proposedInput.created_at}`}
              proposedInput={proposedInput}
              editable={editable}
              reviewerEmail={authUserEmail}
              onSaved={(row) => setProposedInput(row)}
              onError={(message) => setSaveError(message)}
            />
          ) : null}

          {!legacy && proposedInput ? (
            <>
              <Gate1SystemValidationPanel
                key={`validation-${proposedInput.proposed_input_id}`}
                proposedInput={proposedInput}
                onValidated={() => {}}
                onError={(message) => setSaveError(message)}
              />
              <Gate1LockedInputPackagePanel
                key={`locked-${proposedInput.proposed_input_id}`}
                proposedInput={proposedInput}
                authUserEmail={authUserEmail}
                onLocked={() => {}}
                onError={(message) => setSaveError(message)}
              />
            </>
          ) : null}

          {!editable && viewingId && viewingId !== initialEvidence.evidence_id ? (
            <p className="mt-4 text-sm text-slate-600">
              Viewing historical version (read-only). Return to the current draft or pending packet
              to edit.
            </p>
          ) : null}

          {!legacy ? (
            <div className="mt-4">
              <Gate1OutOfScopeSafetySignals
                signals={structuredForReview?.out_of_scope_safety_signals}
                transparencyAssessment={structuredForReview?.transparency_assessment}
              />
            </div>
          ) : null}

          {warnings.length > 0 ||
          requiredReviewAckItems.length > 0 ||
          (requiredEvidenceValidation?.summary?.non_score_gaps ?? 0) > 0 ? (
            <section className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
              <h4 className="text-sm font-semibold text-amber-950">
                PAC validation warnings / acknowledgment
              </h4>
              <p className="mt-1 text-xs text-amber-900">
                Score-blocking gaps are listed in the decision summary and checklist. Non-score
                items below must be acknowledged before approval when shown.
              </p>
              {warnings.length > 0 ? (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900">
                  {warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              ) : null}
              {requiredReviewAckItems.length > 0 ? (
                <div className="mt-3 rounded-lg border border-amber-200 bg-white/80 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-950">
                    Required evidence review (acknowledgment)
                  </p>
                  <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-amber-950">
                    {requiredReviewAckItems.map((item) => (
                      <li key={item.id}>
                        <span className="font-medium">{item.label}</span>
                        {item.detail ? (
                          <p className="mt-0.5 text-xs text-amber-900">{item.detail}</p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                  {editable ? (
                    <label className="mt-3 flex items-start gap-2 text-sm text-amber-950">
                      <input
                        type="checkbox"
                        checked={requiredReviewsAcked}
                        onChange={(e) => setRequiredReviewsAcked(e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-amber-400"
                      />
                      <span>
                        I acknowledge the proprietary / undisclosed coating review and accept
                        Documentation Incomplete / Material Uncertain for downstream Gates.
                      </span>
                    </label>
                  ) : null}
                </div>
              ) : null}
              {(requiredEvidenceValidation?.summary?.non_score_gaps ?? 0) > 0 ? (
                <p className="mt-2 text-xs text-amber-900">
                  Non-score matrix gaps: {requiredEvidenceValidation?.summary?.non_score_gaps} (see
                  checklist — warnings only, not approval blockers unless marked blocker).
                </p>
              ) : null}
              {editable && warnings.length > 0 ? (
                <label className="mt-3 flex items-start gap-2 text-sm text-amber-950">
                  <input
                    type="checkbox"
                    checked={warningsAcked}
                    onChange={(e) => setWarningsAcked(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-amber-400"
                  />
                  <span>I have reviewed these warnings and resolved or accepted them.</span>
                </label>
              ) : null}
            </section>
          ) : null}

          {threshold && !requiredEvidenceValidation ? (
            <section className="mt-4 rounded-xl border border-slate-200 bg-slate-50/50 p-3">
              <p
                className={`text-sm font-semibold ${threshold.met ? 'text-emerald-800' : 'text-red-800'}`}
              >
                {threshold.met ? 'Minimum threshold: all checks passed' : 'Minimum threshold: gaps remain'}
              </p>
              <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                {Object.entries(threshold.checks ?? {}).map(([key, ok]) => (
                  <li
                    key={key}
                    className={`rounded-lg px-2 py-1 text-xs ${ok ? 'bg-emerald-50 text-emerald-900' : 'bg-red-50 text-red-900'}`}
                  >
                    {ok ? '✓' : '✗'} {key.replace(/_/g, ' ')}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <div className="mt-4">{identityCard}</div>

          {!legacy ? <Gate1SourcesReviewedPanel evidence={displayEvidence} /> : null}

          {!legacy ? <Gate1RequiredEvidenceChecklist validation={requiredEvidenceValidation} /> : null}

          {!legacy ? (
            <Gate1RequiredCheckResultsPanel
              results={requiredCheckResults}
              canonicalMappings={canonicalMappings}
            />
          ) : null}

          {!legacy ? (
            <div className="mt-4">
              <Gate1CanonicalMappingsPanel
                mappings={canonicalMappings}
                sources={displayEvidence.sources ?? []}
                structuredForContradictions={structuredForReview}
                editable={editable && !legacy}
                confirmedKeys={canonicalConfirmedKeys}
                editedKeys={canonicalEditedKeys}
                rejectedKeys={canonicalRejectedKeys}
                onConfirmKey={handleConfirmCanonicalKey}
                onRejectKey={handleRejectCanonicalKey}
                onUpdateMapping={handleCanonicalUpdate}
              />
            </div>
          ) : null}

          {saveError ? (
            <p className="mt-3 text-sm text-red-800" role="alert">
              {saveError}
            </p>
          ) : null}

          {!legacy && sourceGroups.length > 0 ? (
            <details className="mt-4 rounded-xl border border-slate-200 bg-slate-50/50">
              <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-800">
                Raw extraction by source / audit detail
              </summary>
              <p className="border-t border-slate-200 px-4 py-2 text-xs text-slate-600">
                Agent 2 consumes canonical IDs only. Raw extraction is shown for audit and editing
                support — not the primary approval surface. Confirming fields here is optional when
                the Phase 3.6 matrix is complete.
              </p>
              <div className="space-y-4 border-t border-slate-200 p-4">
                {sourceGroups.map((group) => (
                  <section
                    key={group.sourceUrl || 'unattributed'}
                    className="rounded-xl border border-slate-100 bg-white"
                  >
                    {group.sourceUrl ? (
                      <a
                        href={group.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="block rounded-t-xl bg-slate-50 px-4 py-2 text-sm font-semibold text-ink-900 underline decoration-slate-300 underline-offset-2 hover:decoration-ink-900"
                      >
                        Source: {sourceLabelForUrl(group.sourceUrl, displayEvidence.sources ?? [])}
                      </a>
                    ) : (
                      <p className="rounded-t-xl bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700">
                        {group.sourceTitle}
                      </p>
                    )}
                    <ul className="divide-y divide-slate-100">
                      {group.fields.map((row) => (
                        <FieldRowEditor
                          key={row.path}
                          row={row}
                          editable={editable && !legacy}
                          confirmed={confirmedPaths.has(row.path)}
                          isEditing={editingPath === row.path}
                          editValue={editValue}
                          onEditValueChange={setEditValue}
                          onStartEdit={() => handleStartEdit(row)}
                          onCancelEdit={() => setEditingPath(null)}
                          onConfirm={() => handleConfirmField(row.path)}
                          onCommitEdit={() => handleCommitEdit(row)}
                          busy={busy || saveBusy}
                        />
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            </details>
          ) : null}

          <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Publishing unavailable until Gates 1–3 are approved. See pipeline status above.
          </p>
        </div>
      ) : null}

      {tab === 'review' ? (
          <footer className="shrink-0 flex flex-wrap gap-2 border-t border-slate-200 bg-white p-4 md:px-6">
            {editable ? (
              <>
                <button
                  type="button"
                  disabled={busy || saveBusy || !structured}
                  onClick={() => void handleSaveDraft()}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
                >
                  {saveBusy ? 'Saving…' : 'Save draft'}
                </button>
                <button
                  type="button"
                  disabled={busy || saveBusy || !approvalBlockers.canApprove}
                  onClick={onApprove}
                  title={approvalBlockers.reasons.join(' · ')}
                  className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
                >
                  Approve
                </button>
              </>
            ) : (
              <p className="text-sm text-slate-600">
                Approved evidence is read-only. Select a draft or pending_review version in history
                to edit.
              </p>
            )}
            {editable ? (
              <button
                type="button"
                disabled={busy || saveBusy}
                onClick={onRejectOpen}
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-800 hover:bg-red-100 disabled:opacity-60"
              >
                Reject
              </button>
            ) : null}
            {onRerun ? (
              <button
                type="button"
                disabled={busy || saveBusy}
                onClick={onRerun}
                className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-900 hover:bg-violet-100 disabled:opacity-60"
              >
                Re-run Agent 1
              </button>
            ) : null}
          </footer>
      ) : null}

      {tab === 'review' && showRejectNotes ? (
            <div className="shrink-0 border-t border-red-100 bg-red-50/50 p-4 md:px-6">
              <label className="block text-xs font-semibold text-red-900">Rejection reason</label>
              <textarea
                value={rejectNotes}
                onChange={(e) => onRejectNotesChange(e.target.value)}
                rows={4}
                placeholder="Why is this evidence packet being rejected?"
                className="mt-2 w-full rounded-xl border border-red-200 bg-white px-3 py-2 text-sm"
              />
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={onRejectConfirm}
                  className="rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-60"
                >
                  Confirm reject
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={onRejectCancel}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </div>
      ) : null}
    </article>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border-b-2 px-3 py-2 text-sm font-semibold ${
        active
          ? 'border-ink-900 text-ink-900'
          : 'border-transparent text-slate-500 hover:text-slate-800'
      }`}
    >
      {children}
    </button>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    approved: 'bg-emerald-100 text-emerald-900 ring-emerald-200',
    pending_review: 'bg-amber-100 text-amber-900 ring-amber-200',
    draft: 'bg-slate-100 text-slate-800 ring-slate-200',
    rejected: 'bg-red-100 text-red-900 ring-red-200',
    superseded: 'bg-slate-100 text-slate-600 ring-slate-200',
  }
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${styles[status] ?? 'bg-slate-100 text-slate-700 ring-slate-200'}`}
    >
      {status.replace(/_/g, ' ')}
    </span>
  )
}

function VersionHistoryList({
  versions,
  activeEvidenceId,
  selectedId,
  onSelect,
}: {
  versions: ProductEvidence[]
  activeEvidenceId: string | null
  selectedId: string
  onSelect: (evidenceId: string) => void
}) {
  if (versions.length === 0) {
    return <p className="mt-4 text-sm text-slate-600">No evidence versions recorded.</p>
  }

  return (
    <ul className="mt-4 space-y-2">
      {versions.map((v) => {
        const isActive = v.evidence_id === activeEvidenceId && v.review_status === 'approved'
        const isSelected = v.evidence_id === selectedId
        return (
          <li key={v.evidence_id}>
            <button
              type="button"
              onClick={() => onSelect(v.evidence_id)}
              className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${
                isSelected
                  ? 'border-ink-900 bg-slate-50'
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <span className="font-semibold text-ink-900">v{v.bundle_version}</span>
              <span className="ml-2 text-xs text-slate-600">{v.review_status.replace(/_/g, ' ')}</span>
              {isActive ? (
                <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-900">
                  active approved
                </span>
              ) : null}
              <span className="mt-1 block text-xs text-slate-500">
                {v.reviewed_at
                  ? `Reviewed ${new Date(v.reviewed_at).toLocaleString()}`
                  : v.pending_review_at
                    ? `Pending ${new Date(v.pending_review_at).toLocaleString()}`
                    : new Date(v.created_at).toLocaleString()}
                {v.reviewed_by ? ` · ${v.reviewed_by}` : ''}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function FieldRowEditor({
  row,
  editable,
  confirmed,
  isEditing,
  editValue,
  onEditValueChange,
  onStartEdit,
  onCancelEdit,
  onConfirm,
  onCommitEdit,
  busy,
}: {
  row: ReviewFieldRow
  editable: boolean
  confirmed: boolean
  isEditing: boolean
  editValue: string
  onEditValueChange: (v: string) => void
  onStartEdit: () => void
  onCancelEdit: () => void
  onConfirm: () => void
  onCommitEdit: () => void
  busy: boolean
}) {
  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-sm font-semibold text-ink-900">{row.label}</p>
        {row.confidence ? (
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${confidenceBadgeClass(row.confidence)}`}
          >
            {row.confidence}
          </span>
        ) : null}
      </div>
      {isEditing ? (
        <textarea
          value={editValue}
          onChange={(e) => onEditValueChange(e.target.value)}
          rows={2}
          className="mt-2 w-full rounded-lg border border-slate-200 px-2 py-1 text-sm"
        />
      ) : (
        <p className="mt-1 text-sm text-slate-800">{row.value || '—'}</p>
      )}
      {row.quote ? (
        <blockquote className="mt-2 border-l-2 border-slate-200 pl-3 text-xs italic text-slate-600">
          &ldquo;{row.quote}&rdquo;
        </blockquote>
      ) : (
        <p className="mt-1 text-xs text-slate-400">No source quote on record</p>
      )}
      {editable ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {isEditing ? (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={onCommitEdit}
                className="rounded-lg bg-ink-900 px-3 py-1 text-xs font-semibold text-white hover:bg-ink-700 disabled:opacity-60"
              >
                Save edit
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={onCancelEdit}
                className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={onStartEdit}
                className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
              >
                Edit
              </button>
              <button
                type="button"
                disabled={busy || confirmed}
                onClick={onConfirm}
                className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-900 hover:bg-emerald-100 disabled:opacity-60"
              >
                {confirmed ? 'Confirmed' : 'Confirm'}
              </button>
            </>
          )}
        </div>
      ) : null}
    </li>
  )
}
