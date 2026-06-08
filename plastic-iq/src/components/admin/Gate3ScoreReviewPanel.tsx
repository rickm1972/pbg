import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { colorForTier } from '../../lib/score'
import { buildScoreMathBreakdown } from '../../lib/scoreMathBreakdown'
import { setPipelineFocus } from '../../lib/adminPipelineNav'
import {
  fetchProductScoreVersionsForProduct,
  fetchScoringInputSummaryForScore,
} from '../../lib/productScoresVersionApi'
import type { ProductPipelineRow, ProductScoreRow, NormalizationLayer4a } from '../../types/agent'
import type { ProductTier } from '../../types'
import { Layer4aBreakdown } from './Layer4aBreakdown'
import { PipelineStatusBar } from './PipelineStatusBar'
import { ScoreMathBreakdownPanel } from './ScoreMathBreakdownPanel'
import { Gate2Section } from './gate2NormalizationDisplay'
import { WhyThisScoreAdmin } from '../WhyThisScoreAdmin'
import type { WhyThisScoreFields } from '../../lib/whyThisScoreApi'

type Props = {
  product: ProductPipelineRow
  score: ProductScoreRow
  layer4a?: NormalizationLayer4a
  busy: boolean
  showRejectNotes: boolean
  rejectNotes: string
  onRejectNotesChange: (v: string) => void
  onApprove: () => void
  onRejectOpen: () => void
  onRejectCancel: () => void
  onRejectConfirm: () => void
  onRerun?: () => void
  onNavigateToGate2?: (productId: string) => void
  scoreMathContext?: {
    layer4b?: import('../../types/agent').NormalizationLayer4b
    normalizationComponents?: import('../../types/agent').NormalizationComponent[]
    whyThisScoreFields?: WhyThisScoreFields | null
    layer4aVerified?: import('../../lib/scoreMathBreakdown').Layer4aVerifiedRow[]
  }
}

export function Gate3ScoreReviewPanel({
  product,
  score: initialScore,
  layer4a,
  busy,
  showRejectNotes,
  rejectNotes,
  onRejectNotesChange,
  onApprove,
  onRejectOpen,
  onRejectCancel,
  onRejectConfirm,
  onRerun,
  onNavigateToGate2,
  scoreMathContext,
}: Props) {
  const [score, setScore] = useState(initialScore)
  const [versions, setVersions] = useState<ProductScoreRow[]>([])
  const [viewingId, setViewingId] = useState<string | null>(null)
  const [tab, setTab] = useState<'review' | 'history'>('review')
  const [inputSummary, setInputSummary] = useState<{
    review_status: string
    run_timestamp: string
  } | null>(null)

  useEffect(() => {
    setScore(initialScore)
    setViewingId(null)
    setTab('review')
  }, [initialScore.score_id])

  useEffect(() => {
    let cancelled = false
    fetchProductScoreVersionsForProduct(product.product_id)
      .then((rows) => {
        if (!cancelled) setVersions(rows)
      })
      .catch(() => {
        if (!cancelled) setVersions([])
      })
    return () => {
      cancelled = true
    }
  }, [product.product_id, score.score_id])

  const displayScore = useMemo(() => {
    if (!viewingId || viewingId === score.score_id) return score
    return versions.find((v) => v.score_id === viewingId) ?? score
  }, [score, viewingId, versions])

  const editable = displayScore.review_status === 'pending_review'
  const activeScoreId =
    versions.find((v) => v.review_status === 'approved')?.score_id ?? null
  const tierStyles = colorForTier(displayScore.tier as ProductTier)
  const components = displayScore.component_nprs?.components ?? []

  const scoreMathBreakdown = useMemo(
    () =>
      buildScoreMathBreakdown(displayScore, {
        layer4a,
        layer4b: scoreMathContext?.layer4b,
        layer4aVerified: scoreMathContext?.layer4aVerified,
        normalizationComponents: scoreMathContext?.normalizationComponents,
      }),
    [
      displayScore,
      layer4a,
      scoreMathContext?.layer4b,
      scoreMathContext?.layer4aVerified,
      scoreMathContext?.normalizationComponents,
    ],
  )

  useEffect(() => {
    if (!displayScore.input_id) return
    let cancelled = false
    fetchScoringInputSummaryForScore(displayScore.input_id)
      .then((row) => {
        if (!cancelled && row) {
          setInputSummary({
            review_status: row.review_status,
            run_timestamp: row.run_timestamp,
          })
        }
      })
      .catch(() => {
        if (!cancelled) setInputSummary(null)
      })
    return () => {
      cancelled = true
    }
  }, [displayScore.input_id])

  function openGate2() {
    if (onNavigateToGate2) {
      onNavigateToGate2(product.product_id)
      return
    }
    setPipelineFocus('agent2', product.product_id)
    window.location.reload()
  }

  return (
    <article className="max-h-[80dvh] overflow-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-card md:p-6">
      <header className="border-b border-slate-100 pb-4">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-700">
          Gate 3 · Score review
        </p>
        <h3 className="text-lg font-semibold text-ink-900">{product.product_name}</h3>
        <p className="mt-2 text-xs text-slate-500">
          Run {new Date(displayScore.run_timestamp).toLocaleString()} ·{' '}
          {displayScore.review_status.replace(/_/g, ' ')}
        </p>
      </header>

      <div className="mt-4">
        <PipelineStatusBar productId={product.product_id} refreshKey={displayScore.score_id} />
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
        <ul className="mt-4 space-y-2">
          {versions.map((v) => (
            <li key={v.score_id}>
              <button
                type="button"
                onClick={() => {
                  setViewingId(v.score_id)
                  setTab('review')
                }}
                className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${
                  v.score_id === (viewingId ?? score.score_id)
                    ? 'border-ink-900 bg-slate-50'
                    : 'border-slate-200'
                }`}
              >
                <span className="font-semibold">{v.review_status.replace(/_/g, ' ')}</span>
                {v.score_id === activeScoreId && v.review_status === 'approved' ? (
                  <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-900">
                    active approved
                  </span>
                ) : null}
                <span className="mt-1 block text-xs text-slate-500">
                  PAC {v.pac_safety_score} · {v.tier} ·{' '}
                  {new Date(v.run_timestamp).toLocaleString()}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {tab === 'review' ? (
        <>
          <section className="mt-4 rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-sm">
            <p className="text-xs font-semibold uppercase text-slate-500">Derived from normalization</p>
            <p className="mt-1 text-slate-800">
              scoring_inputs {displayScore.input_id?.slice(0, 8) ?? '—'}… (
              {inputSummary?.review_status?.replace(/_/g, ' ') ?? 'loading…'})
            </p>
            <button
              type="button"
              onClick={openGate2}
              className="mt-2 text-xs font-semibold text-violet-800 underline"
            >
              View Gate 2 normalization review →
            </button>
          </section>

          {!editable ? (
            <p className="mt-4 text-sm text-slate-600">
              Read-only score view. Scoring is pure deterministic math on approved normalization.
            </p>
          ) : null}

          <section className="mt-6 grid gap-4 sm:grid-cols-2">
            <MetricCard label="PAC Safety Score" value={String(displayScore.pac_safety_score)} large />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tier</p>
              <p className={`mt-1 text-xl font-semibold ${tierStyles.text}`}>{displayScore.tier}</p>
            </div>
            <MetricCard
              label="Confidence range"
              value={displayScore.displayed_confidence_range ?? '—'}
            />
            <MetricCard
              label="Transparency badge"
              value={displayScore.transparency_badge ?? '—'}
            />
            <MetricCard
              label="Weighted NPR"
              value={
                displayScore.weighted_npr != null && Number.isFinite(Number(displayScore.weighted_npr))
                  ? Number(displayScore.weighted_npr).toFixed(4)
                  : '—'
              }
            />
            {displayScore.escalator_applied ? (
              <MetricCard label="Escalator applied" value={displayScore.escalator_applied} />
            ) : null}
          </section>

          <ScoreMathBreakdownPanel breakdown={scoreMathBreakdown} />

          {scoreMathContext?.whyThisScoreFields ? (
            <Gate2Section title="Why this score (structured)">
              <WhyThisScoreAdmin
                fields={scoreMathContext.whyThisScoreFields}
                className="mt-2 border-0 p-0 shadow-none"
              />
            </Gate2Section>
          ) : null}

          {layer4a ? (
            <Layer4aBreakdown layer4a={layer4a} />
          ) : (
            <section className="mt-6">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Layer 4A net adjustment
              </h4>
              <p className="mt-2 text-sm text-slate-700">
                <strong className="tabular-nums">{displayScore.layer_4a_net}</strong>
              </p>
            </section>
          )}

          <section className="mt-6">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Component NPRs
            </h4>
            <ul className="mt-2 space-y-2">
              {components.map((c, i) => (
                <li
                  key={`${c.component_name}-${i}`}
                  className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-sm"
                >
                  <p className="font-semibold text-ink-900">{String(c.component_name)}</p>
                  <p className="mt-1 tabular-nums text-slate-700">
                    NPR {Number(c.final_npr).toFixed(4)} · CI {Number(c.contact_intimacy)} · hazard{' '}
                    {Number(c.material_hazard)} · migration {Number(c.adjusted_migration_potential)}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          <footer className="sticky bottom-0 mt-6 flex flex-wrap gap-2 border-t border-slate-100 bg-white pt-4">
            {editable ? (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={onApprove}
                  className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  Approve score
                </button>
                <button
                  type="button"
                  disabled={busy || showRejectNotes}
                  onClick={onRejectOpen}
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-800"
                >
                  Reject
                </button>
              </>
            ) : onRerun ? (
              <button
                type="button"
                disabled={busy}
                onClick={onRerun}
                className="rounded-xl bg-ink-900 px-4 py-2 text-sm font-semibold text-white"
              >
                Re-run Agent 3
              </button>
            ) : null}
          </footer>

          {showRejectNotes && editable ? (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50/50 p-4">
              <textarea
                value={rejectNotes}
                onChange={(e) => onRejectNotesChange(e.target.value)}
                rows={4}
                className="w-full rounded-xl border px-3 py-2 text-sm"
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

function MetricCard({
  label,
  value,
  large,
}: {
  label: string
  value: string
  large?: boolean
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 font-semibold text-ink-900 ${large ? 'text-3xl tabular-nums' : 'text-sm'}`}>
        {value}
      </p>
    </div>
  )
}
