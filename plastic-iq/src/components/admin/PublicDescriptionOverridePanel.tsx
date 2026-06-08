import { useCallback, useEffect, useState } from 'react'
import type { DescriptionOverrideState } from '../../lib/apr/descriptionOverride'
import {
  approveDescriptionOverrideViaApi,
  fetchDescriptionOverrideState,
  rejectDescriptionOverrideViaApi,
  saveDescriptionOverrideDraftViaApi,
  submitDescriptionOverrideForReviewViaApi,
} from '../../lib/apr/descriptionOverrideApi'
import { buildApprovedLowScoreReview } from '../../lib/apr/fixtures/lowScoreReview'
import { NEGATIVE_SCORE_PUBLICATION_GATE } from '../../lib/apr/negativeScoreGate'

type Props = {
  productId: string
  reviewerId?: string | null
}

export function PublicDescriptionOverridePanel({ productId, reviewerId }: Props) {
  const [state, setState] = useState<DescriptionOverrideState | null>(null)
  const [draftText, setDraftText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const next = await fetchDescriptionOverrideState(productId)
    setState(next)
    setDraftText(next.active_override?.proposed_override_text ?? '')
  }, [productId])

  useEffect(() => {
    refresh().catch((err: unknown) =>
      setError(err instanceof Error ? err.message : String(err)),
    )
  }, [refresh])

  async function runAction(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      await action()
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  if (!state) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-sm text-slate-600">
        Loading description override state…
      </div>
    )
  }

  const hasSnapshot = Boolean(state.current_snapshot_id)
  const validationFailures = state.active_override?.validation?.failures ?? []

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-amber-800">
        Public Description Override
      </div>
      <p className="mt-2 text-xs leading-relaxed text-amber-900/90">
        Product detail pages use the approved frozen display snapshot. Agent 2 generated description
        is the default. Overrides require validation and approval before appearing publicly.
      </p>

      {!hasSnapshot ? (
        <p className="mt-3 text-sm text-amber-900">
          No published display snapshot for this product. Override workflow requires a frozen snapshot.
        </p>
      ) : (
        <>
          <div className="mt-3 grid gap-3">
            <label className="block text-xs font-semibold text-slate-700">
              Current snapshot description (public default)
              <textarea
                readOnly
                value={state.current_snapshot_description ?? ''}
                rows={4}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
              />
            </label>

            <div className="text-xs text-slate-600">
              Status:{' '}
              <span className="font-semibold text-slate-800">{state.status}</span>
              {state.active_override?.status === 'rejected' ? (
                <span className="ml-2 text-red-700">(rejected — public page unchanged)</span>
              ) : null}
            </div>

            <label className="block text-xs font-semibold text-slate-700">
              Draft override text
              <textarea
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                rows={5}
                placeholder="Enter neutral public product-detail wording…"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
              />
            </label>

            {validationFailures.length > 0 ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                <div className="font-semibold">Validation / Phase 4.5 language gate failures</div>
                <ul className="mt-1 list-disc pl-4">
                  {validationFailures.map((f) => (
                    <li key={`${f.check_id}-${f.path}`}>{f.message}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {error ? <p className="text-xs text-red-700">{error}</p> : null}
            {message ? <p className="text-xs text-green-800">{message}</p> : null}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || !draftText.trim()}
              onClick={() =>
                runAction(async () => {
                  await saveDescriptionOverrideDraftViaApi({
                    product_id: productId,
                    proposed_override_text: draftText,
                    created_by: reviewerId ?? null,
                  })
                  setMessage('Draft saved. Public page unchanged until explicit approval.')
                })
              }
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
            >
              Save draft
            </button>
            <button
              type="button"
              disabled={busy || !state.active_override || state.active_override.status !== 'draft'}
              onClick={() =>
                runAction(async () => {
                  if (!state.active_override) return
                  await submitDescriptionOverrideForReviewViaApi(state.active_override.override_id)
                  setMessage('Submitted for review. Public page unchanged.')
                })
              }
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
            >
              Submit for review
            </button>
            <button
              type="button"
              disabled={
                busy ||
                !state.active_override ||
                (state.active_override.status !== 'pending_review' &&
                  state.active_override.status !== 'draft')
              }
              onClick={() =>
                runAction(async () => {
                  if (!state.active_override) return
                  const score = state.pac_safety_score ?? 100
                  const needsLowScoreReview =
                    score < NEGATIVE_SCORE_PUBLICATION_GATE.threshold
                  const result = await approveDescriptionOverrideViaApi(
                    state.active_override.override_id,
                    {
                      reviewer_id: reviewerId ?? 'admin',
                      low_score_publication_review: needsLowScoreReview
                        ? buildApprovedLowScoreReview({
                            score,
                            primary_score_driving_concern: 'Admin-approved override',
                          })
                        : null,
                    },
                  )
                  setMessage(
                    result.bundled_synced
                      ? `Override approved — snapshot ${result.new_snapshot_id} is now public. Hard-refresh the product page to see it.`
                      : `Override approved (${result.new_snapshot_id}) but bundled sync failed — run npm run sync:bundled-durable and refresh.`,
                  )
                })
              }
              className="rounded-xl bg-ink-900 px-3 py-2 text-xs font-semibold text-white hover:bg-ink-700 disabled:opacity-50"
            >
              Approve override (creates new snapshot)
            </button>
            <button
              type="button"
              disabled={
                busy ||
                !state.active_override ||
                (state.active_override.status !== 'pending_review' &&
                  state.active_override.status !== 'draft')
              }
              onClick={() =>
                runAction(async () => {
                  if (!state.active_override) return
                  await rejectDescriptionOverrideViaApi(
                    state.active_override.override_id,
                    reviewerId ?? 'admin',
                    'Rejected in admin editor',
                  )
                  setMessage('Override rejected. Public page unchanged.')
                })
              }
              className="rounded-xl border border-red-300 bg-white px-3 py-2 text-xs font-semibold text-red-800 hover:bg-red-50 disabled:opacity-50"
            >
              Reject
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-600">
            Saving normal product fields below does not publish an override. Approval is explicit and
            creates a new immutable snapshot version.
          </p>
        </>
      )}
    </div>
  )
}
