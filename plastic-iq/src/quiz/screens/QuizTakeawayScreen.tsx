import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { countScoredYesAnswers, topScoredYesItems } from '../quizModel'
import { getFirstName, getResponseId, getScoredAnswers } from '../quizStorage'
import { QuizCard, QuizHeader, QuizPage, QuizShell } from '../ui'

const SUPPORTING_TAIL =
  " PlasticBegone is building the safer alternatives — we'll share them when ready."

function takeawayHeader(firstName: string | null, yesCount: number): string {
  if (yesCount === 0) {
    return firstName
      ? `${firstName}, your kitchen is in great shape.`
      : 'Your kitchen is in great shape.'
  }
  return firstName
    ? `${firstName}, here's what's pulling your score down the most.`
    : "Here's what's pulling your score down the most."
}

function takeawaySupportingLine(yesCount: number): string {
  if (yesCount === 0) {
    return `You're already doing what most people aren't.${SUPPORTING_TAIL}`
  }
  if (yesCount === 1) {
    return `Swapping this one would raise your score the most.${SUPPORTING_TAIL}`
  }
  if (yesCount === 2) {
    return `Swapping these two would raise your score the most.${SUPPORTING_TAIL}`
  }
  return `Swapping these three would raise your score the most.${SUPPORTING_TAIL}`
}

export function QuizTakeawayScreen() {
  const navigate = useNavigate()
  const firstName = getFirstName()
  const scoredAnswers = useMemo(() => getScoredAnswers(), [])
  const yesCount = useMemo(() => countScoredYesAnswers(scoredAnswers), [scoredAnswers])
  const topItems = useMemo(() => topScoredYesItems(scoredAnswers, 3), [scoredAnswers])

  useEffect(() => {
    if (!getResponseId()) navigate('/', { replace: true })
  }, [navigate])

  const header = takeawayHeader(firstName, yesCount)
  const supportingLine = takeawaySupportingLine(yesCount)

  return (
    <QuizShell>
      <QuizHeader size="hero" />
      <QuizPage>
        <QuizCard padding="lg" className="overflow-hidden">
          <section>
            <h1 className="font-display text-[1.65rem] font-semibold leading-snug text-ink-900 sm:text-[1.85rem]">
              {header}
            </h1>

            {yesCount > 0 ? (
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
                yesCount > 0
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
