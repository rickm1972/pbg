import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { QuizCard, QuizShell } from '../ui'

const FINAL_FACT =
  'Most PAC exposure comes from food and drinks — small daily doses add up over years.'

export function QuizLoadingScreen() {
  const navigate = useNavigate()

  useEffect(() => {
    const t = window.setTimeout(() => navigate('/result', { replace: true }), 2300)
    return () => window.clearTimeout(t)
  }, [navigate])

  return (
    <QuizShell>
      <main className="flex min-h-dvh flex-col items-center justify-center px-4 pb-10 pt-10 text-center">
        <QuizCard className="w-full max-w-md text-left">
          <div className="font-display text-xl font-semibold text-ink-900">
            Calculating your kitchen PAC Safety Score…
          </div>
          <div className="mt-4">
            <div className="h-2 w-full overflow-hidden rounded-full bg-[#E5E7EB]">
              <div className="h-full w-2/3 animate-pulse bg-forest" />
            </div>
          </div>
          <div className="mt-5 text-sm leading-relaxed text-slate-600">{FINAL_FACT}</div>
        </QuizCard>
      </main>
    </QuizShell>
  )
}

