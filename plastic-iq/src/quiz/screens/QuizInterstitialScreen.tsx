import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { INTERSTITIAL_AFTER_Q14, INTERSTITIAL_AFTER_Q9 } from '../quizModel'
import {
  QuizBackButton,
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

  function goBack() {
    if (which === 'heat') navigate('/q/q9')
    else if (which === 'kids') navigate('/q/q14')
    else navigate('/')
  }

  return (
    <QuizShell>
      <QuizHeader size="hero" />
      <div className="px-4 pb-1">
        <QuizBackButton onBack={goBack} />
      </div>
      <QuizPage>
        <QuizCard padding="lg">
          <QuizEyebrow className="font-bold">Did You Know?</QuizEyebrow>
          <p className="mt-4 font-display text-2xl font-normal leading-snug text-ink-900">
            {text}
          </p>
        </QuizCard>

        <div className="mt-6">
          <QuizPrimaryButton onClick={continueNext}>Continue</QuizPrimaryButton>
        </div>
      </QuizPage>
    </QuizShell>
  )
}
