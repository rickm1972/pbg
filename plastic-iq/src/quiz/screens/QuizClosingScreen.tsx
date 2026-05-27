import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getFirstName, getResponseId } from '../quizStorage'
import { QuizCard, QuizHeader, QuizPage, QuizShell } from '../ui'

export function QuizClosingScreen() {
  const navigate = useNavigate()
  const firstName = getFirstName()

  useEffect(() => {
    if (!getResponseId()) navigate('/', { replace: true })
  }, [navigate])

  return (
    <QuizShell>
      <QuizHeader size="hero" />
      <QuizPage>
        <QuizCard padding="lg">
          <div className="space-y-5 text-base leading-relaxed text-slate-700">
            <p className="font-display text-xl font-semibold leading-snug text-ink-900">
              You&apos;re now ahead of most people on this.
            </p>
            <p>The hardest part is knowing. Every swap from here moves the needle.</p>
            <p>
              {firstName
                ? `Thanks for taking the quiz, ${firstName} — talk soon.`
                : 'Thanks for taking the quiz — talk soon.'}
            </p>
          </div>
        </QuizCard>
      </QuizPage>
    </QuizShell>
  )
}
