import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  INTERSTITIAL_AFTER_Q14,
  INTERSTITIAL_CONTINUE_LABEL,
  INTERSTITIAL_NATURE_STUDY,
} from '../quizModel'
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
    which === 'nature'
      ? INTERSTITIAL_NATURE_STUDY
      : which === 'kids'
        ? INTERSTITIAL_AFTER_Q14
        : null

  useEffect(() => {
    if (!text) navigate('/', { replace: true })
  }, [text, navigate])

  function continueNext() {
    if (which === 'nature') navigate('/q/q8', { replace: true })
    else if (which === 'kids') navigate('/q/q15', { replace: true })
  }

  function goBack() {
    if (which === 'nature') navigate('/q/q7')
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
          <QuizPrimaryButton onClick={continueNext}>{INTERSTITIAL_CONTINUE_LABEL}</QuizPrimaryButton>
        </div>
      </QuizPage>
    </QuizShell>
  )
}
