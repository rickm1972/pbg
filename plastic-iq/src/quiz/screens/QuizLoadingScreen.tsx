import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { QuizCard, QuizEyebrow, QuizHeader, QuizShell } from '../ui'

const FINAL_FACT =
  'Most PAC exposure comes from food and drinks — small daily doses add up over years.'

export function QuizLoadingScreen() {
  const navigate = useNavigate()

  useEffect(() => {
    const t = window.setTimeout(() => navigate('/result', { replace: true }), 2400)
    return () => window.clearTimeout(t)
  }, [navigate])

  return (
    <QuizShell>
      <QuizHeader compact />
      <div className="flex min-h-[70dvh] flex-col items-center justify-center px-4 pb-10">
        <QuizCard padding="lg" className="w-full text-center">
          <QuizEyebrow>Scoring</QuizEyebrow>
          <h2 className="mt-3 font-display text-xl font-semibold text-ink-900">
            Calculating your kitchen PAC Safety Score…
          </h2>
          <div className="mx-auto mt-6 h-2 w-full max-w-xs overflow-hidden rounded-full bg-slate-200/80">
            <div className="h-full w-2/3 animate-pulse rounded-full bg-forest" />
          </div>
          <p className="mt-6 text-sm leading-relaxed text-slate-600">{FINAL_FACT}</p>
        </QuizCard>
      </div>
    </QuizShell>
  )
}
