import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import plasticBegoneLogo from '../../assets/plastic-begone-logo-transparent.png'
import { createQuizResponse } from '../../lib/quizResponsesApi'

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
    <div className="min-h-dvh bg-[#fdfcf9] text-ink-900">
      <header className="mx-auto flex max-w-lg items-center justify-center px-4 pt-6">
        <img
          src={plasticBegoneLogo}
          alt="Plastic Begone"
          className="h-[4.25rem] w-auto max-w-[min(86vw,28rem)] object-contain"
        />
      </header>

      <main className="mx-auto max-w-lg px-4 pb-10 pt-6">
        <h1 className="font-serif text-3xl font-semibold leading-tight text-ink-900">
          How safe is your kitchen?
        </h1>
        <p className="mt-3 text-base leading-relaxed text-slate-700">
          Take the PAC Safety quiz — see how your kitchen scores.
        </p>
        <p className="mt-2 text-sm text-slate-600">Takes 2 minutes.</p>

        <button
          type="button"
          onClick={start}
          disabled={starting}
          className="mt-8 w-full rounded-2xl bg-emerald-700 px-5 py-4 text-base font-semibold text-white shadow-[0_18px_40px_-26px_rgba(15,61,38,0.65)] disabled:opacity-70 active:bg-emerald-800"
        >
          {starting ? 'Starting…' : 'Start quiz'}
        </button>

        {error ? (
          <div className="mt-3 text-sm text-red-700">{error}</div>
        ) : null}
      </main>
    </div>
  )
}

