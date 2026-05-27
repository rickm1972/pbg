import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createQuizResponse } from '../../lib/quizResponsesApi'
import {
  QuizCard,
  QuizEyebrow,
  QuizHeader,
  QuizPage,
  QuizPrimaryButton,
  QuizShell,
} from '../ui'

export function QuizLandingPage() {
  const navigate = useNavigate()
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function start() {
    if (starting) return
    setStarting(true)
    setError(null)
    try {
      const id = await createQuizResponse(navigator.userAgent ?? null)
      sessionStorage.setItem('quiz_response_id', id)
      sessionStorage.setItem('quiz_scored_answers', JSON.stringify({}))
      sessionStorage.setItem('quiz_awareness_answers', JSON.stringify({}))
      sessionStorage.setItem('quiz_motivation_answers', JSON.stringify({}))
      navigate('/q/q1')
    } catch {
      setError('Failed to start quiz. Please try again.')
    } finally {
      setStarting(false)
    }
  }

  return (
    <QuizShell>
      <QuizHeader />
      <QuizPage
        footer={
          <QuizPrimaryButton onClick={start} disabled={starting}>
            {starting ? 'Starting…' : 'Start quiz'}
          </QuizPrimaryButton>
        }
      >
        <QuizCard padding="lg" className="mt-2">
          <QuizEyebrow>Kitchen PAC Safety Quiz</QuizEyebrow>
          <h1 className="mt-3 font-display text-[2rem] font-semibold leading-[1.15] text-ink-900">
            How safe is your kitchen?
          </h1>
          <p className="mt-4 text-base leading-relaxed text-slate-700">
            Take the PAC Safety quiz — see how your kitchen scores on the same 0–100 scale we use
            for every product on PlasticBegone.
          </p>
          <p className="mt-3 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-forest ring-1 ring-emerald-200/80">
            Takes 2 minutes
          </p>
        </QuizCard>

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
            {error}
          </div>
        ) : null}
      </QuizPage>
    </QuizShell>
  )
}
