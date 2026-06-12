import { useMemo, useState } from 'react'
import type { Agent1ProposedInput, ReviewedComponentInput, ReviewedInputPayload } from '../../types/lockedInput'
import {
  computeReviewChangeSummary,
  initializeReviewDraftFromProposed,
} from '../../lib/lockedInput/reviewGateDraft'
import { saveAgent1ReviewedInput } from '../../lib/lockedInput/lockedInputStore'
import { ReviewedPayloadValidationError } from '../../lib/lockedInput/reviewPayloadValidation'
import {
  CANONICAL_MATERIAL_ID_OPTIONS,
  COMPONENT_ROLE_OPTIONS,
  COMPONENT_STRUCTURE_OPTIONS,
  CONTACT_PATHWAY_OPTIONS,
  LAB_APPLIES_TO_OPTIONS,
  LAB_EVIDENCE_STATUS_OPTIONS,
  PFAS_PTFE_STATUS_OPTIONS,
  PROPRIETARY_STATUS_OPTIONS,
  TRANSPARENCY_BADGE_OPTIONS,
} from '../../lib/lockedInput/reviewGateConstants'

type Props = {
  proposedInput: Agent1ProposedInput
  editable: boolean
  reviewerEmail: string | null
  onSaved: (row: Agent1ProposedInput) => void
  onError: (message: string | null) => void
}

function SelectField({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string
  value: string
  options: readonly string[]
  onChange: (value: string) => void
  disabled?: boolean
}) {
  return (
    <label className="block text-xs">
      <span className="mb-1 block font-semibold text-slate-700">{label}</span>
      <select
        className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </label>
  )
}

function TextField({
  label,
  value,
  onChange,
  disabled,
  mono,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  mono?: boolean
}) {
  return (
    <label className="block text-xs">
      <span className="mb-1 block font-semibold text-slate-700">{label}</span>
      <input
        className={`w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs ${mono ? 'font-mono' : ''}`}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  )
}

function CheckboxField({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-slate-800">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  )
}

export function Gate1HumanReviewGatePanel({
  proposedInput,
  editable,
  reviewerEmail,
  onSaved,
  onError,
}: Props) {
  const [draft, setDraft] = useState<ReviewedInputPayload>(() =>
    initializeReviewDraftFromProposed(
      proposedInput.proposed_payload,
      proposedInput.reviewed_payload,
    ),
  )
  const [reviewNotes, setReviewNotes] = useState(proposedInput.reviewed_payload?.review_notes ?? '')
  const [busy, setBusy] = useState(false)

  const statusLabel = useMemo(() => {
    if (proposedInput.proposal_status === 'reviewed') return 'Reviewed (not validated or locked)'
    return 'Draft — human review required'
  }, [proposedInput.proposal_status])

  function updateComponent(index: number, patch: Partial<ReviewedComponentInput>) {
    setDraft((prev) => {
      const components = [...prev.reviewed_components]
      components[index] = { ...components[index], ...patch }
      return { ...prev, reviewed_components: components }
    })
  }

  async function handleSave() {
    onError(null)
    setBusy(true)
    try {
      const summary = computeReviewChangeSummary(proposedInput.proposed_payload, draft)
      const payload: ReviewedInputPayload = {
        ...draft,
        review_notes: reviewNotes.trim() || null,
        review_change_summary: summary,
      }
      const saved = await saveAgent1ReviewedInput({
        proposed_input_id: proposedInput.proposed_input_id,
        reviewed_payload: payload,
        reviewed_by: reviewerEmail,
        review_notes: reviewNotes.trim() || null,
      })
      onSaved(saved)
    } catch (err) {
      const message =
        err instanceof ReviewedPayloadValidationError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to save human review'
      onError(message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section
      className="mt-6 rounded-xl border border-violet-200 bg-violet-50/40 p-4"
      aria-label="Agent 1 human review gate"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-800">
            Agent 1 Human Review Gate
          </p>
          <h4 className="mt-1 text-sm font-semibold text-ink-900">
            Confirm / correct proposed closed fields
          </h4>
          <p className="mt-1 text-xs text-slate-600">
            {statusLabel}. This is not scoring, system validation, or locking yet.
          </p>
          <p className="mt-1 font-mono text-[10px] text-slate-500">
            proposed_input_id: {proposedInput.proposed_input_id} · status:{' '}
            {proposedInput.proposal_status}
          </p>
          {proposedInput.reviewed_at ? (
            <p className="mt-1 text-[10px] text-slate-600">
              Last reviewed {new Date(proposedInput.reviewed_at).toLocaleString()}
              {proposedInput.reviewed_by ? ` by ${proposedInput.reviewed_by}` : ''}
            </p>
          ) : null}
        </div>
        {editable ? (
          <button
            type="button"
            className="rounded-lg bg-violet-700 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-800 disabled:opacity-50"
            disabled={busy}
            onClick={() => void handleSave()}
          >
            {busy ? 'Saving…' : 'Save human review'}
          </button>
        ) : null}
      </div>

      <div className="mt-4 space-y-4">
        <div>
          <h5 className="text-xs font-semibold uppercase text-slate-700">Reviewed components</h5>
          <div className="mt-2 space-y-4">
            {draft.reviewed_components.map((comp, index) => {
              const proposed = proposedInput.proposed_payload.proposed_components.find(
                (p) => p.proposed_component_id === comp.reviewed_component_id,
              )
              return (
                <div
                  key={comp.reviewed_component_id}
                  className="rounded-lg border border-slate-200 bg-white p-3"
                >
                  <p className="text-xs font-semibold text-ink-900">
                    {comp.reviewed_component_name || comp.reviewed_component_id}
                  </p>
                  {proposed?.proposed_canonical_material_id ? (
                    <p className="mt-1 text-[10px] text-slate-500">
                      Agent 1 proposed canonical:{' '}
                      <span className="font-mono">{proposed.proposed_canonical_material_id}</span>
                    </p>
                  ) : null}
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <TextField
                      label="Component name"
                      value={comp.reviewed_component_name}
                      disabled={!editable}
                      onChange={(v) => updateComponent(index, { reviewed_component_name: v })}
                    />
                    <SelectField
                      label="Role"
                      value={comp.reviewed_component_role}
                      options={COMPONENT_ROLE_OPTIONS}
                      disabled={!editable}
                      onChange={(v) => updateComponent(index, { reviewed_component_role: v })}
                    />
                    <SelectField
                      label="Structure"
                      value={comp.reviewed_component_structure}
                      options={COMPONENT_STRUCTURE_OPTIONS}
                      disabled={!editable}
                      onChange={(v) => updateComponent(index, { reviewed_component_structure: v })}
                    />
                    <SelectField
                      label="Contact pathway"
                      value={comp.reviewed_contact_pathway}
                      options={CONTACT_PATHWAY_OPTIONS}
                      disabled={!editable}
                      onChange={(v) => updateComponent(index, { reviewed_contact_pathway: v })}
                    />
                    <SelectField
                      label="Confirmed canonical material ID"
                      value={comp.confirmed_canonical_material_id ?? ''}
                      options={CANONICAL_MATERIAL_ID_OPTIONS}
                      disabled={!editable}
                      onChange={(v) =>
                        updateComponent(index, { confirmed_canonical_material_id: v || null })
                      }
                    />
                    <TextField
                      label="Reviewer notes"
                      value={comp.reviewer_notes ?? ''}
                      disabled={!editable}
                      onChange={(v) => updateComponent(index, { reviewer_notes: v || null })}
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-4">
                    <CheckboxField
                      label="Primary contact"
                      checked={comp.reviewed_is_primary_contact}
                      disabled={!editable}
                      onChange={(v) => updateComponent(index, { reviewed_is_primary_contact: v })}
                    />
                    <CheckboxField
                      label="Score-driving component"
                      checked={comp.reviewed_is_score_driving}
                      disabled={!editable}
                      onChange={(v) => updateComponent(index, { reviewed_is_score_driving: v })}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <SelectField
            label="Lab evidence status"
            value={draft.reviewed_lab_evidence_status ?? 'none'}
            options={LAB_EVIDENCE_STATUS_OPTIONS}
            disabled={!editable}
            onChange={(v) => setDraft((d) => ({ ...d, reviewed_lab_evidence_status: v }))}
          />
          <SelectField
            label="Lab applies to"
            value={draft.reviewed_lab_applies_to ?? 'unknown'}
            options={LAB_APPLIES_TO_OPTIONS}
            disabled={!editable}
            onChange={(v) => setDraft((d) => ({ ...d, reviewed_lab_applies_to: v }))}
          />
          <CheckboxField
            label="Non-Detect mitigation candidate"
            checked={Boolean(draft.reviewed_non_detect_mitigation_candidate)}
            disabled={!editable}
            onChange={(v) =>
              setDraft((d) => ({ ...d, reviewed_non_detect_mitigation_candidate: v }))
            }
          />
          <SelectField
            label="Proprietary status"
            value={draft.reviewed_proprietary_status ?? 'unknown'}
            options={PROPRIETARY_STATUS_OPTIONS}
            disabled={!editable}
            onChange={(v) => setDraft((d) => ({ ...d, reviewed_proprietary_status: v }))}
          />
          <SelectField
            label="PFAS/PTFE status"
            value={draft.reviewed_pfas_ptfe_status ?? 'unknown'}
            options={PFAS_PTFE_STATUS_OPTIONS}
            disabled={!editable}
            onChange={(v) => setDraft((d) => ({ ...d, reviewed_pfas_ptfe_status: v }))}
          />
          <TextField
            label="Coating family status"
            value={draft.reviewed_coating_family_status ?? ''}
            disabled={!editable}
            onChange={(v) =>
              setDraft((d) => ({ ...d, reviewed_coating_family_status: v || null }))
            }
          />
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <h5 className="text-xs font-semibold uppercase text-slate-700">Use-condition override</h5>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <CheckboxField
              label="Override category defaults"
              checked={Boolean(draft.reviewed_use_condition_override)}
              disabled={!editable}
              onChange={(v) => setDraft((d) => ({ ...d, reviewed_use_condition_override: v }))}
            />
            <TextField
              label="Override reason"
              value={draft.reviewed_use_condition_override_reason ?? ''}
              disabled={!editable}
              onChange={(v) =>
                setDraft((d) => ({ ...d, reviewed_use_condition_override_reason: v || null }))
              }
            />
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <h5 className="text-xs font-semibold uppercase text-slate-700">
            Layer 4A / cap / escalator candidates
          </h5>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <TextField
              label="Layer 4A credit candidates (comma-separated)"
              value={(draft.reviewed_layer_4a_credit_candidates ?? []).join(', ')}
              disabled={!editable}
              onChange={(v) =>
                setDraft((d) => ({
                  ...d,
                  reviewed_layer_4a_credit_candidates: v
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean),
                }))
              }
            />
            <TextField
              label="Layer 4A deduction candidates (comma-separated)"
              value={(draft.reviewed_layer_4a_deduction_candidates ?? []).join(', ')}
              disabled={!editable}
              onChange={(v) =>
                setDraft((d) => ({
                  ...d,
                  reviewed_layer_4a_deduction_candidates: v
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean),
                }))
              }
            />
            <CheckboxField
              label="Cap candidate"
              checked={Boolean(draft.reviewed_cap_flag)}
              disabled={!editable}
              onChange={(v) => setDraft((d) => ({ ...d, reviewed_cap_flag: v }))}
            />
            <TextField
              label="Cap reason"
              value={draft.reviewed_cap_reason ?? ''}
              disabled={!editable}
              onChange={(v) => setDraft((d) => ({ ...d, reviewed_cap_reason: v || null }))}
            />
            <TextField
              label="Escalator candidate"
              value={String(draft.reviewed_escalator_candidate ?? '')}
              disabled={!editable}
              onChange={(v) =>
                setDraft((d) => ({ ...d, reviewed_escalator_candidate: v || null }))
              }
            />
            <TextField
              label="Escalator reason"
              value={draft.reviewed_escalator_reason ?? ''}
              disabled={!editable}
              onChange={(v) =>
                setDraft((d) => ({ ...d, reviewed_escalator_reason: v || null }))
              }
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <SelectField
            label="Transparency badge (display)"
            value={draft.reviewed_transparency_badge ?? ''}
            options={['', ...TRANSPARENCY_BADGE_OPTIONS]}
            disabled={!editable}
            onChange={(v) =>
              setDraft((d) => ({ ...d, reviewed_transparency_badge: v || null }))
            }
          />
          <TextField
            label="Badge basis"
            value={draft.reviewed_badge_basis ?? ''}
            disabled={!editable}
            onChange={(v) => setDraft((d) => ({ ...d, reviewed_badge_basis: v || null }))}
          />
        </div>

        <label className="block text-xs">
          <span className="mb-1 block font-semibold text-slate-700">Review notes</span>
          <textarea
            className="min-h-[72px] w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
            value={reviewNotes}
            disabled={!editable}
            onChange={(e) => setReviewNotes(e.target.value)}
          />
        </label>
      </div>
    </section>
  )
}
