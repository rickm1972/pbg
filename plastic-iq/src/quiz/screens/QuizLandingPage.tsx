import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import plasticBegoneLogo from '../../assets/plastic-begone-logo-transparent.png'
import { createQuizResponse } from '../../lib/quizResponsesApi'
import { QuizPrimaryButton, QuizShell } from '../ui'

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
    } catch (e: unknown) {
      setError('Failed to start quiz. Please try again.')
    } finally {
      setStarting(false)
    }
  }

  return (
    <QuizShell>
      <header className="flex items-center justify-center px-4 pt-6">
        <img
          src={plasticBegoneLogo}
          alt="Plastic Begone"
          className="h-[4.25rem] w-auto max-w-[min(86vw,28rem)] object-contain"
        />
      </header>

      <main className="px-4 pb-10 pt-6">
        <h1 className="font-display text-3xl font-semibold leading-tight text-ink-900">
          How safe is your kitchen?
        </h1>
        <p className="mt-3 text-base leading-relaxed text-slate-700">
          Take the PAC Safety quiz — see how your kitchen scores.
        </p>
        <p className="mt-2 text-sm font-semibold text-slate-600">Takes 2 minutes.</p>

        <div className="mt-8">
          <QuizPrimaryButton onClick={start} disabled={starting}>
          {starting ? 'Starting…' : 'Start quiz'}
          </QuizPrimaryButton>
        </div>

        {error ? (
          <div className="mt-3 text-sm font-semibold text-red-700">{error}</div>
        ) : null}
      </main>
    </QuizShell>
  )
}

