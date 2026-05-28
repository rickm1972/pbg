import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { patchQuizResponse } from '../../lib/quizResponsesApi'
import { POST_CONCERN_OPTIONS, POST_CONCERN_PROMPT } from '../quizModel'
import { getMotivationAnswers, getResponseId, setMotivationAnswer } from '../quizStorage'
import {
  QuizCard,
  QuizChoiceButton,
  QuizEyebrow,
  QuizHeader,
  QuizPage,
  QuizProgressBar,
  QuizShell,
} from '../ui'

type Step = 'q20' | 'q18' | 'q18b' | 'q21'

const MOTIVATION_TOTAL = 4

function motivationProgress(step: Step): number {
  if (step === 'q20') return 1
  if (step === 'q18' || step === 'q18b') return 2
  if (step === 'q21') return 3
  return 4
}

export function QuizMotivationScreen() {
  const navigate = useNavigate()
  const responseId = getResponseId()

  const [step, setStep] = useState<Step>('q20')
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    if (!responseId) navigate('/', { replace: true })
  }, [responseId, navigate])

  async function persist() {
    if (!responseId) return
    await patchQuizResponse(responseId, {
      motivation_answers: getMotivationAnswers() as Record<string, unknown>,
    })
  }

  async function pick(id: string, value: unknown) {
    if (saving) return
    setSaving(true)
    setSelected(String(value))
    try {
      setMotivationAnswer(id, value)
      await persist()

      await new Promise((r) => window.setTimeout(r, 220))

      if (step === 'q20') {
        setSelected(null)
        setStep('q18')
        return
      }
      if (step === 'q18') {
        setSelected(null)
        if (value === 'Yes') setStep('q18b')
        else setStep('q21')
        return
      }
      if (step === 'q18b') {
        setSelected(null)
        setStep('q21')
        return
      }
      if (step === 'q21') {
        navigate('/email', { replace: true })
      }
    } finally {
      setSaving(false)
    }
  }

  const prompt =
    step === 'q20'
      ? POST_CONCERN_PROMPT
      : step === 'q18'
        ? 'Do you have children under 12 in your household?'
        : step === 'q18b'
          ? 'How old are your children?'
          : 'When buying or replacing kitchen products, would you choose safer alternatives if you knew what they were?'

  const options =
    step === 'q20'
      ? [...POST_CONCERN_OPTIONS]
      : step === 'q18'
        ? ['Yes', 'No']
        : step === 'q18b'
          ? ['Under 5', '5-12', 'Both']
          : ['Yes', 'No', 'Maybe']

  const storageKey =
    step === 'q20' ? 'q20' : step === 'q18' ? 'q18' : step === 'q18b' ? 'q18b' : 'q21'

  function goBack() {
    setSelected(null)
    if (step === 'q20') {
      navigate('/q/q17')
      return
    }
    if (step === 'q18') {
      setStep('q20')
      return
    }
    if (step === 'q18b') {
      setStep('q18')
      return
    }
    if (step === 'q21') {
      const answers = getMotivationAnswers()
      setStep(answers.q18 === 'Yes' ? 'q18b' : 'q18')
    }
  }

  return (
    <QuizShell>
      <QuizHeader size="hero" />
      <QuizProgressBar
        current={motivationProgress(step)}
        total={MOTIVATION_TOTAL}
        onBack={goBack}
      />
      <QuizPage>
        <QuizCard padding="lg">
          <QuizEyebrow>Help us improve</QuizEyebrow>
          <p className="mt-3 text-xl font-semibold leading-snug text-ink-900">{prompt}</p>
        </QuizCard>

        <div className="mt-4 grid gap-3">
          {options.map((opt) => (
            <QuizChoiceButton
              key={opt}
              disabled={saving}
              selected={selected === opt}
              onClick={() => pick(storageKey, opt)}
            >
              {opt}
            </QuizChoiceButton>
          ))}
        </div>
      </QuizPage>
    </QuizShell>
  )
}
