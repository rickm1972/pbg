import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { setPipelineFocus } from '../../lib/adminPipelineNav'
import {
  fetchEvidenceSummaryForInput,
  fetchScoringInputVersionsForProduct,
} from '../../lib/scoringInputsVersionApi'
import type { ProductPipelineRow, ScoringInputRow } from '../../types/agent'
import { PipelineStatusBar } from './PipelineStatusBar'
import {
  getNormalizationWarnings,
  NormalizationReadOnlyBody,
} from './gate2NormalizationDisplay'

type Props = {
  product: ProductPipelineRow
  scoringInput: ScoringInputRow
  busy: boolean
  showRejectNotes: boolean
  rejectNotes: string
  onRejectNotesChange: (v: string) => void
  onApprove: () => void
  onRejectOpen: () => void
  onRejectCancel: () => void
  onRejectConfirm: () => void
  onRerun?: () => void
  onNavigateToGate1?: (productId: string) => void
}

export function Gate2NormalizationReviewPanel({
  product,
  scoringInput: initialInput,
  busy,
  showRejectNotes,
  rejectNotes,
  onRejectNotesChange,
  onApprove,
  onRejectOpen,
  onRejectCancel,
  onRejectConfirm,
  onRerun,
  onNavigateToGate1,
}: Props) {
  const [scoringInput, setScoringInput] = useState(initialInput)
  const [versions, setVersions] = useState<ScoringInputRow[]>([])
  const [viewingId, setViewingId] = useState<string | null>(null)
  const [tab, setTab] = useState<'review' | 'history'>('review')
  const [warningsAcked, setWarningsAcked] = useState(false)
  const [evidenceSummary, setEvidenceSummary] = useState<{
    bundle_version: number
    review_status: string
  } | null>(null)

  useEffect(() => {
    setScoringInput(initialInput)
    setViewingId(null)
    setWarningsAcked(false)
    setTab('review')
  }, [initialInput.input_id])

  useEffect(() => {
    let cancelled = false
    fetchScoringInputVersionsForProduct(product.product_id)
      .then((rows) => {
        if (!cancelled) setVersions(rows)
      })
      .catch(() => {
        if (!cancelled) setVersions([])
      })
    return () => {
      cancelled = true
    }
  }, [product.product_id, scoringInput.input_id])

  const displayInput = useMemo(() => {
    if (!viewingId || viewingId === scoringInput.input_id) return scoringInput
    return versions.find((v) => v.input_id === viewingId) ?? scoringInput
  }, [scoringInput, viewingId, versions])

  const inputs = displayInput.inputs
  const editable = displayInput.review_status === 'pending_review'
  const warnings = getNormalizationWarnings(displayInput, inputs)
  const activeInputId =
    versions.find((v) => v.review_status === 'approved')?.input_id ?? null

  useEffect(() => {
    let cancelled = false
    fetchEvidenceSummaryForInput(displayInput.evidence_id)
      .then((row) => {
        if (!cancelled && row) {
          setEvidenceSummary({
            bundle_version: row.bundle_version,
            review_status: row.review_status,
          })
        }
      })
      .catch(() => {
        if (!cancelled) setEvidenceSummary(null)
      })
    return () => {
      cancelled = true
    }
  }, [displayInput.evidence_id])

  const canApprove =
    editable &&
    (warnings.length === 0 || warningsAcked) &&
    (!inputs.flagged_missing_fields?.length || warningsAcked)

  function openGate1() {
    if (onNavigateToGate1) {
      onNavigateToGate1(product.product_id)
      return
    }
    setPipelineFocus('agent1', product.product_id)
    window.location.reload()
  }

  return (
    <article className="max-h-[80dvh] overflow-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-card md:p-6">
      <header className="border-b border-slate-100 pb-4">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-700">
          Gate 2 · Normalization review
        </p>
        <h3 className="text-lg font-semibold text-ink-900">{product.product_name}</h3>
        <p className="mt-2 text-xs text-slate-500">
          Algorithm {displayInput.algorithm_version} · run{' '}
          {new Date(displayInput.run_timestamp).toLocaleString()} ·{' '}
          {displayInput.review_status.replace(/_/g, ' ')}
        </p>
      </header>

      <div className="mt-4">
        <PipelineStatusBar productId={product.product_id} refreshKey={displayInput.input_id} />
      </div>

      <div className="mt-4 flex gap-2 border-b border-slate-100">
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
          activeInputId={activeInputId}
          selectedId={viewingId ?? scoringInput.input_id}
          onSelect={(id) => {
            setViewingId(id)
            setTab('review')
          }}
        />
      ) : null}

      {tab === 'review' ? (
        <>
          <section className="mt-4 rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-sm">
            <p className="text-xs font-semibold uppercase text-slate-500">Derived from evidence</p>
            <p className="mt-1 text-slate-800">
              Evidence version v{evidenceSummary?.bundle_version ?? '—'} (
              {evidenceSummary?.review_status?.replace(/_/g, ' ') ?? 'loading…'})
            </p>
            <button
              type="button"
              onClick={openGate1}
              className="mt-2 text-xs font-semibold text-violet-800 underline hover:text-violet-950"
            >
              View Gate 1 evidence review →
            </button>
          </section>

          {warnings.length > 0 ? (
            <section className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
              <h4 className="text-sm font-semibold text-amber-950">Validation warnings</h4>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900">
                {warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
              {editable ? (
                <label className="mt-3 flex items-start gap-2 text-sm text-amber-950">
                  <input
                    type="checkbox"
                    checked={warningsAcked}
                    onChange={(e) => setWarningsAcked(e.target.checked)}
                    className="mt-0.5 h-4 w-4"
                  />
                  <span>I have reviewed these warnings before approving.</span>
                </label>
              ) : null}
            </section>
          ) : null}

          {!editable ? (
            <p className="mt-4 text-sm text-slate-600">
              Read-only normalization view. Only pending_review versions can be approved or
              rejected.
            </p>
          ) : null}

          <p className="mt-4 text-xs text-slate-500">
            Display is read-only — normalization is deterministic from approved evidence. You are
            confirming the output matches expectations.
          </p>

          <NormalizationReadOnlyBody scoringInput={displayInput} inputs={inputs} />

          <footer className="sticky bottom-0 mt-6 flex flex-wrap gap-2 border-t border-slate-100 bg-white pt-4">
            {editable ? (
              <>
                <button
                  type="button"
                  disabled={busy || !canApprove}
                  onClick={onApprove}
                  title={!canApprove ? 'Acknowledge warnings before approving' : undefined}
                  className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
                >
                  Approve normalization
                </button>
                <button
                  type="button"
                  disabled={busy || showRejectNotes}
                  onClick={onRejectOpen}
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-800 hover:bg-red-100 disabled:opacity-60"
                >
                  Reject
                </button>
              </>
            ) : null}
            {onRerun ? (
              <button
                type="button"
                disabled={busy}
                onClick={onRerun}
                className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-900 hover:bg-violet-100 disabled:opacity-60"
              >
                Re-run Agent 2
              </button>
            ) : null}
          </footer>

          {showRejectNotes && editable ? (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50/50 p-4">
              <label className="block text-xs font-semibold text-red-900">Rejection reason</label>
              <textarea
                value={rejectNotes}
                onChange={(e) => onRejectNotesChange(e.target.value)}
                rows={4}
                className="mt-2 w-full rounded-xl border border-red-200 bg-white px-3 py-2 text-sm"
              />
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={onRejectConfirm}
                  className="rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white"
                >
                  Confirm reject
                </button>
                <button type="button" onClick={onRejectCancel} className="rounded-xl border px-4 py-2 text-sm">
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
        </>
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
        active ? 'border-ink-900 text-ink-900' : 'border-transparent text-slate-500'
      }`}
    >
      {children}
    </button>
  )
}

function VersionHistoryList({
  versions,
  activeInputId,
  selectedId,
  onSelect,
}: {
  versions: ScoringInputRow[]
  activeInputId: string | null
  selectedId: string
  onSelect: (id: string) => void
}) {
  return (
    <ul className="mt-4 space-y-2">
      {versions.map((v) => (
        <li key={v.input_id}>
          <button
            type="button"
            onClick={() => onSelect(v.input_id)}
            className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${
              v.input_id === selectedId ? 'border-ink-900 bg-slate-50' : 'border-slate-200'
            }`}
          >
            <span className="font-semibold">{v.review_status.replace(/_/g, ' ')}</span>
            {v.input_id === activeInputId && v.review_status === 'approved' ? (
              <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-900">
                active approved
              </span>
            ) : null}
            <span className="mt-1 block text-xs text-slate-500">
              {new Date(v.run_timestamp).toLocaleString()}
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}
