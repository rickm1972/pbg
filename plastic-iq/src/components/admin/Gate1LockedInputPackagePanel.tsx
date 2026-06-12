import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  Agent1LockedInput,
  Agent1ProposedInput,
  Agent1SystemValidation,
} from '../../types/lockedInput'
import {
  METHODOLOGY_VERSION,
  MATERIAL_LOOKUP_VERSION,
} from '../../lib/lockedInput/buildLockedInputPackage'
import {
  checkLockEligibility,
  createLockedInputPackageFromValidation,
  getActiveLockedInputForProduct,
  getLatestAgent1SystemValidationForProposal,
  LockEligibilityError,
} from '../../lib/lockedInput/lockedInputStore'

type Props = {
  proposedInput: Agent1ProposedInput
  authUserEmail: string | null
  onLocked: (row: Agent1LockedInput) => void
  onError: (message: string | null) => void
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === 'locked_for_agent_3'
      ? 'bg-violet-100 text-violet-900'
      : status === 'superseded'
        ? 'bg-slate-100 text-slate-700'
        : 'bg-slate-100 text-slate-800'
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${tone}`}>
      {status}
    </span>
  )
}

export function Gate1LockedInputPackagePanel({
  proposedInput,
  authUserEmail,
  onLocked,
  onError,
}: Props) {
  const [validation, setValidation] = useState<Agent1SystemValidation | null>(null)
  const [activeLock, setActiveLock] = useState<Agent1LockedInput | null>(null)
  const [loading, setLoading] = useState(false)
  const [locking, setLocking] = useState(false)

  const loadState = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true)
    onError(null)
    try {
      const [valRow, lockRow] = await Promise.all([
        getLatestAgent1SystemValidationForProposal(proposedInput.proposed_input_id),
        getActiveLockedInputForProduct(proposedInput.product_id),
      ])
      setValidation(valRow)
      setActiveLock(lockRow)
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to load lock state')
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [proposedInput.proposed_input_id, proposedInput.product_id, onError])

  useEffect(() => {
    void loadState(false)
  }, [loadState, proposedInput.updated_at])

  const eligibility = useMemo(() => {
    if (!proposedInput.reviewed_payload || !validation) {
      return { eligible: false, blockers: ['Reviewed payload and passed validation required'] }
    }
    return checkLockEligibility({ proposed: proposedInput, validation })
  }, [proposedInput, validation])

  const validationPassed = validation?.validation_status === 'passed'
  const canCreateLock =
    validationPassed &&
    eligibility.eligible &&
    !activeLock &&
    Boolean(proposedInput.reviewed_payload)

  async function handleCreateLock() {
    if (!validationPassed) {
      onError('System validation must pass before locking')
      return
    }
    onError(null)
    setLocking(true)
    try {
      const row = await createLockedInputPackageFromValidation({
        proposed_input_id: proposedInput.proposed_input_id,
        validation_id: validation?.validation_id,
        locked_by: authUserEmail,
      })
      setActiveLock(row)
      onLocked(row)
    } catch (err) {
      if (err instanceof LockEligibilityError) {
        onError(err.blockers.join('; ') || err.message)
      } else {
        onError(err instanceof Error ? err.message : 'Failed to create locked package')
      }
    } finally {
      setLocking(false)
    }
  }

  const lockedPayload = activeLock?.locked_payload
  const primaryComponent = lockedPayload?.locked_components?.find(
    (c) => c.locked_component_role === 'primary_food_contact',
  )

  return (
    <section
      className="mt-6 rounded-xl border border-violet-200 bg-violet-50/40 p-4"
      aria-label="Agent 1 locked input package"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-800">
            Agent 1 Locked Input Package
          </p>
          <h4 className="mt-1 text-sm font-semibold text-ink-900">Create immutable Agent 3 input</h4>
          <p className="mt-1 text-xs text-slate-600">
            Locked for Agent 3, but Agent 3 is not wired yet. No score is calculated here.
          </p>
        </div>
        <button
          type="button"
          className="rounded-lg border border-violet-300 bg-white px-3 py-1.5 text-xs text-violet-900"
          disabled={loading}
          onClick={() => void loadState(true)}
        >
          Refresh
        </button>
      </div>

      <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <p className="font-semibold text-slate-800">Version stamps</p>
          <dl className="mt-2 space-y-1 text-slate-700">
            <div className="flex justify-between gap-2">
              <dt>methodology_version</dt>
              <dd className="font-mono">{METHODOLOGY_VERSION}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>material_lookup_version</dt>
              <dd className="font-mono">{MATERIAL_LOOKUP_VERSION}</dd>
            </div>
          </dl>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <p className="font-semibold text-slate-800">Validation status</p>
          <dl className="mt-2 space-y-1 text-slate-700">
            <div className="flex justify-between gap-2">
              <dt>Status</dt>
              <dd>{validation?.validation_status ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>Lock eligible</dt>
              <dd>{eligibility.eligible ? 'Yes' : 'No'}</dd>
            </div>
          </dl>
        </div>
      </div>

      {!eligibility.eligible && eligibility.blockers.length ? (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-semibold text-amber-950">Lock blockers</p>
          <ul className="mt-1 list-disc pl-4 text-xs text-amber-900">
            {eligibility.blockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50/80 p-3 text-xs text-amber-950">
        <strong>Warning:</strong> Creating a locked input package is immutable. Changes require
        superseding and creating a new package.
      </div>

      {activeLock ? (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <StatusBadge status={activeLock.locked_input_status} />
            <span className="text-slate-600">locked_at: {activeLock.locked_at ?? '—'}</span>
            {activeLock.locked_by ? (
              <span className="text-slate-600">locked_by: {activeLock.locked_by}</span>
            ) : null}
          </div>
          <p className="font-mono text-[10px] text-slate-500">
            lock_hash: {activeLock.lock_hash ?? '—'}
          </p>
          <p className="font-mono text-[10px] text-slate-500">
            locked_input_id: {activeLock.locked_input_id}
          </p>
          {lockedPayload ? (
            <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs">
              <p className="font-semibold text-slate-800">Locked package summary (read-only)</p>
              <p className="mt-1 text-slate-700">{lockedPayload.lock_summary}</p>
              <dl className="mt-2 space-y-1 text-slate-700">
                <div className="flex justify-between gap-2">
                  <dt>Score-driving components</dt>
                  <dd>{lockedPayload.locked_components?.length ?? 0}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>Primary canonical ID</dt>
                  <dd className="font-mono">{primaryComponent?.locked_canonical_material_id ?? '—'}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>Resolved taxonomy ID</dt>
                  <dd className="font-mono">
                    {primaryComponent?.locked_resolved_material_taxonomy_id ?? '—'}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>Layer 4A total</dt>
                  <dd>{lockedPayload.locked_layer_4a_total ?? '—'}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>Transparency badge</dt>
                  <dd>{lockedPayload.locked_transparency_badge ?? '—'}</dd>
                </div>
              </dl>
            </div>
          ) : null}
        </div>
      ) : (
        <button
          type="button"
          className="mt-4 rounded-lg border border-violet-400 bg-violet-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
          disabled={!canCreateLock || locking}
          onClick={() => void handleCreateLock()}
        >
          {locking ? 'Creating locked package…' : 'Create locked input package'}
        </button>
      )}

      {loading ? <p className="mt-2 text-xs text-slate-600">Loading…</p> : null}
    </section>
  )
}
