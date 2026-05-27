import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const FINAL_FACT =
  'Most PAC exposure comes from food and drinks — small daily doses add up over years.'

export function QuizLoadingScreen() {
  const navigate = useNavigate()

  useEffect(() => {
    const t = window.setTimeout(() => navigate('/result', { replace: true }), 2300)
    return () => window.clearTimeout(t)
  }, [navigate])

  return (
    <div className="min-h-dvh bg-[#fdfcf9] text-ink-900">
      <main className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center px-4 pb-10 pt-10 text-center">
        <div className="text-xl font-semibold text-ink-900">
          Calculating your kitchen PAC Safety Score…
        </div>
        <div className="mt-4 w-full max-w-sm">
          <div className="h-2 w-full overflow-hidden rounded-full bg-[#E5E7EB]">
            <div className="h-full w-2/3 animate-pulse bg-emerald-700" />
          </div>
        </div>
        <div className="mt-8 max-w-sm text-sm leading-relaxed text-slate-600">{FINAL_FACT}</div>
      </main>
    </div>
  )
}

