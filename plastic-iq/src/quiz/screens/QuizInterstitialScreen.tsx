import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { INTERSTITIAL_AFTER_Q14, INTERSTITIAL_AFTER_Q9 } from '../quizModel'
import { QuizCard, QuizPrimaryButton, QuizShell } from '../ui'

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
    <QuizShell>
      <main className="flex min-h-dvh flex-col px-4 pb-10 pt-10">
        <div className="mt-10">
          <QuizCard>
            <div className="text-sm font-semibold uppercase tracking-wide text-forest">
              PAC fact
            </div>
            <div className="mt-2 text-xl font-semibold leading-snug text-ink-900">{text}</div>
          </QuizCard>
        </div>

        <div className="mt-auto">
          <QuizPrimaryButton onClick={continueNext}>
          Tap to continue
          </QuizPrimaryButton>
        </div>
      </main>
    </QuizShell>
  )
}

