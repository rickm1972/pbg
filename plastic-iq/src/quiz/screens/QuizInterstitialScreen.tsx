import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { INTERSTITIAL_AFTER_Q14, INTERSTITIAL_AFTER_Q9 } from '../quizModel'

export function QuizInterstitialScreen() {
  const { which } = useParams()
  const navigate = useNavigate()

  const text =
    which === 'heat'
      ? INTERSTITIAL_AFTER_Q9
      : which === 'kids'
        ? INTERSTITIAL_AFTER_Q14
        : null

  useEffect(() => {
    if (!text) navigate('/', { replace: true })
  }, [text, navigate])

  function continueNext() {
    if (which === 'heat') navigate('/q/q10', { replace: true })
    else if (which === 'kids') navigate('/q/q15', { replace: true })
  }

  return (
    <div className="min-h-dvh bg-[#fdfcf9] text-ink-900">
      <main className="mx-auto flex min-h-dvh max-w-lg flex-col px-4 pb-10 pt-10">
        <div className="mt-10 rounded-3xl border border-slate-200 bg-white p-5 shadow-card">
          <div className="text-sm font-semibold uppercase tracking-wide text-emerald-800">
            PAC fact
          </div>
          <div className="mt-2 text-xl font-semibold leading-snug text-ink-900">{text}</div>
        </div>

        <button
          type="button"
          onClick={continueNext}
          className="mt-auto h-16 w-full rounded-2xl bg-emerald-700 px-5 text-base font-semibold text-white active:bg-emerald-800"
        >
          Tap to continue
        </button>
      </main>
    </div>
  )
}

