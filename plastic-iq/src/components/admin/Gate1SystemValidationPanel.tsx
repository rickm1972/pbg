import { useCallback, useEffect, useState } from 'react'
import type { Agent1ProposedInput, Agent1SystemValidation } from '../../types/lockedInput'
import {
  getLatestAgent1SystemValidationForProposal,
  validateAgent1ReviewedInput,
} from '../../lib/lockedInput/lockedInputStore'

type Props = {
  proposedInput: Agent1ProposedInput
  onValidated: (row: Agent1SystemValidation) => void
  onError: (message: string | null) => void
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === 'passed'
      ? 'bg-emerald-100 text-emerald-900'
      : status === 'failed'
        ? 'bg-red-100 text-red-900'
        : 'bg-slate-100 text-slate-800'
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${tone}`}>
      {status}
    </span>
  )
}

export function Gate1SystemValidationPanel({ proposedInput, onValidated, onError }: Props) {
  const [validation, setValidation] = useState<Agent1SystemValidation | null>(null)
  const [loading, setLoading] = useState(false)
  const [running, setRunning] = useState(false)

  const loadLatest = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true)
    onError(null)
    try {
      const row = await getLatestAgent1SystemValidationForProposal(proposedInput.proposed_input_id)
      setValidation(row)
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to load validation')
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [proposedInput.proposed_input_id, onError])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const row = await getLatestAgent1SystemValidationForProposal(proposedInput.proposed_input_id)
        if (!cancelled) setValidation(row)
      } catch {
        /* initial load best-effort */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [proposedInput.proposed_input_id, proposedInput.updated_at])

  async function handleRunValidation() {
    if (!proposedInput.reviewed_payload) {
      onError('Save human review (reviewed_payload) before running system validation')
      return
    }
    onError(null)
    setRunning(true)
    try {
      const row = await validateAgent1ReviewedInput(proposedInput.proposed_input_id)
      setValidation(row)
      onValidated(row)
    } catch (err) {
      onError(err instanceof Error ? err.message : 'System validation failed')
    } finally {
      setRunning(false)
    }
  }

  const payload = validation?.validation_payload
  const primaryLookup = payload?.material_lookups?.find(
    (m) => m.reviewed_component_role === 'primary_food_contact',
  )
  const primaryMitigation = payload?.non_detect_mitigation?.find(
    (m) => m.reviewed_component_id === primaryLookup?.reviewed_component_id,
  )
  const primaryUse = payload?.use_conditions?.find(
    (u) => u.reviewed_component_id === primaryLookup?.reviewed_component_id,
  )
  const escalatorDetail = payload?.escalator_validation_detail as
    | { escalator_multiplier?: number }
    | undefined
  const badgeDetail = payload?.transparency_badge_validation_detail as
    | { reviewed_transparency_badge?: string; validated_transparency_badge?: string }
    | undefined

  const hasReviewed = Boolean(proposedInput.reviewed_payload)

  return (
    <section
      className="mt-6 rounded-xl border border-sky-200 bg-sky-50/40 p-4"
      aria-label="Agent 1 system validation"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-800">
            Agent 1 System Validation
          </p>
          <h4 className="mt-1 text-sm font-semibold text-ink-900">Validate reviewed closed fields</h4>
          <p className="mt-1 text-xs text-slate-600">
            Validated, not locked. No score, no Agent 3 package, no publish.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-lg border border-sky-300 bg-white px-3 py-1.5 text-xs font-semibold text-sky-900 disabled:opacity-50"
            disabled={!hasReviewed || running}
            onClick={() => void handleRunValidation()}
          >
            {running ? 'Validating…' : 'Run system validation'}
          </button>
          <button
            type="button"
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700"
            disabled={loading}
            onClick={() => void loadLatest(true)}
          >
            Refresh
          </button>
        </div>
      </div>

      {!hasReviewed ? (
        <p className="mt-3 text-xs text-amber-800">
          Human review required first — save reviewed_payload in the Human Review Gate above.
        </p>
      ) : null}

      {validation ? (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <StatusBadge status={validation.validation_status} />
            <span className="text-slate-600">
              validated_at: {validation.validated_at ?? validation.created_at}
            </span>
            <span className="font-mono text-[10px] text-slate-500">
              validation_id: {validation.validation_id}
            </span>
          </div>

          {validation.blockers?.length ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-xs font-semibold text-red-950">Blockers</p>
              <ul className="mt-1 list-disc pl-4 text-xs text-red-900">
                {validation.blockers.map((b) => (
                  <li key={b.code}>{b.message}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {validation.warnings?.length ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-semibold text-amber-950">Warnings</p>
              <ul className="mt-1 list-disc pl-4 text-xs text-amber-900">
                {validation.warnings.map((w) => (
                  <li key={w.code}>{w.message}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {payload ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs">
                <p className="font-semibold text-slate-800">Material lookup (primary)</p>
                <dl className="mt-2 space-y-1 text-slate-700">
                  <div className="flex justify-between gap-2">
                    <dt>Status</dt>
                    <dd>{primaryLookup?.canonical_material_lookup_status ?? '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt>Hazard</dt>
                    <dd>{primaryLookup?.material_hazard_value ?? '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt>Base migration</dt>
                    <dd>{primaryLookup?.base_migration_value ?? '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt>Adjusted migration</dt>
                    <dd>{primaryLookup?.adjusted_migration_value ?? '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt>Mitigation factor</dt>
                    <dd>{primaryMitigation?.mitigation_factor ?? '—'}</dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs">
                <p className="font-semibold text-slate-800">Use conditions (primary)</p>
                <dl className="mt-2 space-y-1 text-slate-700">
                  <div className="flex justify-between gap-2">
                    <dt>Contact intimacy</dt>
                    <dd>{primaryUse?.final_contact_intimacy ?? '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt>Severity</dt>
                    <dd>{primaryUse?.final_exposure_severity ?? '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt>Duration</dt>
                    <dd>{primaryUse?.final_exposure_duration ?? '—'}</dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs">
                <p className="font-semibold text-slate-800">Layer 4A / cap / escalator</p>
                <dl className="mt-2 space-y-1 text-slate-700">
                  <div className="flex justify-between gap-2">
                    <dt>Layer 4A total</dt>
                    <dd>{payload.layer_4a_total_validated ?? '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt>Unknown coating cap</dt>
                    <dd>{String(payload.unknown_coating_cap_validation ?? '—')}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt>Escalator multiplier</dt>
                    <dd>{escalatorDetail?.escalator_multiplier ?? '—'}</dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs">
                <p className="font-semibold text-slate-800">Transparency badge</p>
                <dl className="mt-2 space-y-1 text-slate-700">
                  <div className="flex justify-between gap-2">
                    <dt>Reviewed</dt>
                    <dd>{badgeDetail?.reviewed_transparency_badge ?? '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt>Validated</dt>
                    <dd>{badgeDetail?.validated_transparency_badge ?? '—'}</dd>
                  </div>
                </dl>
              </div>
            </div>
          ) : null}

          {payload?.unresolved_canonical_material_ids?.length ? (
            <p className="text-xs text-amber-900">
              Unresolved canonical IDs: {payload.unresolved_canonical_material_ids.join(', ')}
            </p>
          ) : null}

          {payload?.material_lookup_sync_notes?.length ? (
            <p className="text-[10px] text-slate-500">{payload.material_lookup_sync_notes.join(' ')}</p>
          ) : null}

          <p className="text-xs text-slate-600">{payload?.validation_summary}</p>
        </div>
      ) : loading ? (
        <p className="mt-3 text-xs text-slate-600">Loading validation…</p>
      ) : (
        <p className="mt-3 text-xs text-slate-600">No validation record yet.</p>
      )}
    </section>
  )
}
