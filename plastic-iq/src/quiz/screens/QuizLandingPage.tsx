import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createQuizResponse } from '../../lib/quizResponsesApi'
import {
  QuizCard,
  QuizEyebrow,
  QuizHeader,
  QuizPrimaryButton,
  QuizShell,
} from '../ui'
import { clearResponseId, setResponseId } from '../quizStorage'

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
      clearResponseId()
      setResponseId(id)
      sessionStorage.setItem('quiz_scored_answers', JSON.stringify({}))
      sessionStorage.setItem('quiz_awareness_answers', JSON.stringify({}))
      sessionStorage.setItem('quiz_motivation_answers', JSON.stringify({}))
      sessionStorage.removeItem('quiz_first_name')
      navigate('/q/q1')
    } catch {
      setError('Failed to start quiz. Please try again.')
    } finally {
      setStarting(false)
    }
  }

  return (
    <QuizShell>
      <QuizHeader size="hero" />
      <main className="flex flex-1 flex-col px-4 pb-8 pt-4 sm:pt-6">
        <QuizCard padding="lg">
          <QuizEyebrow>Kitchen PAC Safety Quiz</QuizEyebrow>
          <h1 className="mt-3 font-display text-[2rem] font-semibold leading-[1.15] text-ink-900 sm:text-[2.25rem]">
            How much plastic is leaking into your food?
          </h1>
          <p className="mt-4 text-base leading-relaxed text-slate-700">
            Take the 2-minute plastic-associated chemical (PAC) quiz to see how exposed you are.
          </p>
        </QuizCard>

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
            {error}
          </div>
        ) : null}

        <div className="mt-6">
          <QuizPrimaryButton onClick={start} disabled={starting}>
            {starting ? 'Starting…' : 'Start quiz'}
          </QuizPrimaryButton>
        </div>
      </main>
    </QuizShell>
  )
}
