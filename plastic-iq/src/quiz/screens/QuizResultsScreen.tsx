import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { patchQuizResponse } from '../../lib/quizResponsesApi'
import { shareQuizInvite } from '../shareQuiz'
import {
  computeQuizScore,
  countScoredYesAnswers,
  tierForScore,
  topScoredYesItems,
} from '../quizModel'
import { getFirstName, getResponseId, getScoredAnswers } from '../quizStorage'
import {
  QuizCard,
  QuizHeader,
  QuizPage,
  QuizShareButton,
  QuizShell,
} from '../ui'

const SUPPORTING_TAIL =
  " PlasticBegone is building the safer alternatives — we'll share them when ready."

function takeawayHeader(firstName: string | null, deductionCount: number): string {
  if (deductionCount === 0) {
    return firstName
      ? `${firstName}, your kitchen is in great shape.`
      : 'Your kitchen is in great shape.'
  }
  return firstName
    ? `${firstName}, here's what's pulling your score down the most.`
    : "Here's what's pulling your score down the most."
}

function takeawaySupportingLine(deductionCount: number): string {
  if (deductionCount === 0) {
    return `You're already doing what most people aren't.${SUPPORTING_TAIL}`
  }
  if (deductionCount === 1) {
    return `Swapping this one would raise your score the most.${SUPPORTING_TAIL}`
  }
  if (deductionCount === 2) {
    return `Swapping these two would raise your score the most.${SUPPORTING_TAIL}`
  }
  return `Swapping these three would raise your score the most.${SUPPORTING_TAIL}`
}

export function QuizResultsScreen() {
  const navigate = useNavigate()
  const responseId = getResponseId()
  const scoredAnswers = useMemo(() => getScoredAnswers(), [])
  const score = useMemo(() => computeQuizScore(scoredAnswers), [scoredAnswers])
  const result = useMemo(() => tierForScore(score), [score])
  const firstName = getFirstName()
  const deductionCount = useMemo(() => countScoredYesAnswers(scoredAnswers), [scoredAnswers])
  const topItems = useMemo(() => topScoredYesItems(scoredAnswers, 3), [scoredAnswers])
  const [sharing, setSharing] = useState(false)

  const scoreEyebrow = firstName
    ? `${firstName}, your kitchen scored:`
    : 'Your kitchen scored:'

  useEffect(() => {
    if (!responseId) navigate('/', { replace: true })
  }, [responseId, navigate])

  useEffect(() => {
    if (!responseId) return
    void patchQuizResponse(responseId, {
      completed_at: new Date().toISOString(),
      final_score: score,
      tier: result.tier,
      letter_grade: result.letterGrade,
      scored_answers: scoredAnswers as unknown as Record<string, unknown>,
    })
  }, [responseId, score, result.tier, result.letterGrade, scoredAnswers])

  async function share() {
    if (sharing) return
    setSharing(true)
    try {
      const outcome = await shareQuizInvite()
      if (outcome === 'copied') {
        alert(
          'Share link copied. You can paste it into a text or email — or use the email draft that opened.',
        )
      }
    } finally {
      setSharing(false)
    }
  }

  const header = takeawayHeader(firstName, deductionCount)
  const supportingLine = takeawaySupportingLine(deductionCount)

  return (
    <QuizShell>
      <QuizHeader size="hero" />
      <QuizPage>
        <div
          className="overflow-hidden rounded-3xl p-6 shadow-[0_10px_40px_-24px_rgba(15,61,38,0.35)] ring-1 ring-black/5"
          style={{ backgroundColor: result.color }}
        >
          <div className="text-center text-white">
            <div className="text-sm font-semibold leading-snug opacity-95 sm:text-base">
              {scoreEyebrow}
            </div>
            <div className="mt-4 text-6xl font-extrabold leading-none tracking-tight">
              {score}
              <span className="font-extrabold"> / 100</span>
            </div>
            <div className="mt-3 text-2xl leading-none sm:text-3xl">
              <span className="font-medium opacity-90">Grade: </span>
              <span className="font-bold">{result.letterGrade}</span>
            </div>
            <div className="mt-4 text-lg font-semibold">{result.headline}</div>
            <div className="mt-2 text-base leading-relaxed opacity-95 sm:text-lg">
              {result.impact}
            </div>
          </div>
        </div>

        <div className="mt-5">
          <QuizShareButton onClick={share} busy={sharing} />
        </div>

        <QuizCard padding="lg" className="mt-6 overflow-hidden">
          <section>
            <h2 className="font-display text-[1.65rem] font-semibold leading-snug text-ink-900 sm:text-[1.85rem]">
              {header}
            </h2>

            {deductionCount > 0 ? (
              <ol className="mt-6 space-y-3">
                {topItems.map((item, index) => (
                  <li
                    key={item.id}
                    className="flex items-start gap-4 rounded-2xl border border-slate-200/90 bg-[#fdfcf9] px-4 py-3.5 shadow-sm"
                  >
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-forest text-sm font-bold text-white"
                      aria-hidden
                    >
                      {index + 1}
                    </span>
                    <div className="min-w-0 pt-0.5">
                      <p className="text-base font-semibold leading-snug text-ink-900">
                        {item.itemName}
                      </p>
                      <p className="mt-1 text-xs font-medium uppercase tracking-wide text-forest-muted">
                        High-impact swap
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            ) : null}

            <p
              className={
                deductionCount > 0
                  ? 'mt-6 text-sm leading-relaxed text-slate-600 sm:text-[0.95rem]'
                  : 'mt-6 text-sm leading-relaxed text-slate-600 sm:text-base'
              }
            >
              {supportingLine}
            </p>
          </section>

          <section className="mt-5 rounded-2xl border border-emerald-200/90 bg-emerald-50 px-4 py-5 sm:px-5">
            <div className="space-y-4 text-base leading-relaxed text-slate-700">
              <p className="font-display text-xl font-semibold leading-snug text-ink-900">
                You&apos;re now ahead of most people on this.
              </p>
              <p>The hardest part is knowing. Every swap from here moves the needle.</p>
              <p className="text-ink-900">
                {firstName
                  ? `Thanks for taking the quiz, ${firstName} — talk soon.`
                  : 'Thanks for taking the quiz — talk soon.'}
              </p>
            </div>
          </section>
        </QuizCard>
      </QuizPage>
    </QuizShell>
  )
}
