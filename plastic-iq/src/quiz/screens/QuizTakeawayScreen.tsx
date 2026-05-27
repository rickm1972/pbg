import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { topScoredYesItems } from '../quizModel'
import { getFirstName, getResponseId, getScoredAnswers } from '../quizStorage'
import {
  QuizCard,
  QuizHeader,
  QuizPage,
  QuizPrimaryButton,
  QuizShell,
} from '../ui'

export function QuizTakeawayScreen() {
  const navigate = useNavigate()
  const firstName = getFirstName()
  const topItems = useMemo(() => topScoredYesItems(getScoredAnswers(), 3), [])

  useEffect(() => {
    if (!getResponseId()) navigate('/', { replace: true })
  }, [navigate])

  const header = firstName
    ? `${firstName}, here's what's pulling your score down the most.`
    : "Here's what's pulling your score down the most."

  return (
    <QuizShell>
      <QuizHeader size="hero" />
      <QuizPage>
        <QuizCard padding="lg">
          <h1 className="font-display text-2xl font-semibold leading-snug text-ink-900">
            {header}
          </h1>

          {topItems.length > 0 ? (
            <ul className="mt-5 space-y-3">
              {topItems.map((item) => (
                <li
                  key={item.id}
                  className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-[#fdfcf9] px-4 py-3 text-base text-ink-900"
                >
                  <span
                    className="mt-2 h-2 w-2 shrink-0 rounded-full bg-forest"
                    aria-hidden
                  />
                  <span className="leading-snug">{item.itemName}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-5 text-base leading-relaxed text-slate-700">
              Your answers didn&apos;t flag our highest-impact kitchen items.
            </p>
          )}

          <p className="mt-6 text-sm leading-relaxed text-slate-700">
            Swapping these three would raise your score the most. PlasticBegone is building the
            safer alternatives — we&apos;ll share them when ready.
          </p>
        </QuizCard>

        <div className="mt-6">
          <QuizPrimaryButton onClick={() => navigate('/closing', { replace: true })}>
            Next
          </QuizPrimaryButton>
        </div>
      </QuizPage>
    </QuizShell>
  )
}
