import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { INTERSTITIAL_AFTER_Q14, INTERSTITIAL_AFTER_Q9 } from '../quizModel'
import {
  QuizCard,
  QuizEyebrow,
  QuizHeader,
  QuizPage,
  QuizPrimaryButton,
  QuizShell,
} from '../ui'

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
      <QuizHeader compact />
      <QuizPage footer={<QuizPrimaryButton onClick={continueNext}>Continue</QuizPrimaryButton>}>
        <QuizCard padding="lg" className="mt-4">
          <QuizEyebrow>PAC fact</QuizEyebrow>
          <p className="mt-4 font-display text-2xl font-semibold leading-snug text-ink-900">{text}</p>
        </QuizCard>
      </QuizPage>
    </QuizShell>
  )
}
