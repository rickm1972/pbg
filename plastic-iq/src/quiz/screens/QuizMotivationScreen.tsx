import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { patchQuizResponse } from '../../lib/quizResponsesApi'
import { getResponseId, getMotivationAnswers, setMotivationAnswer } from '../quizStorage'
import { QuizCard, QuizOutlineButton, QuizShell } from '../ui'

type Step = 'q18' | 'q18b' | 'q19' | 'q20' | 'q21'

export function QuizMotivationScreen() {
  const navigate = useNavigate()
  const responseId = getResponseId()
  // Eager parse to keep storage format consistent (no-op).
  getMotivationAnswers()

  const [step, setStep] = useState<Step>('q18')
  const [saving, setSaving] = useState(false)

  async function persist() {
    if (!responseId) return
    const answers = getMotivationAnswers()
    await patchQuizResponse(responseId, { motivation_answers: answers as Record<string, unknown> })
  }

  async function pick(id: string, value: unknown) {
    if (saving) return
    setSaving(true)
    try {
      setMotivationAnswer(id, value)
      await persist()

      if (step === 'q18') {
        if (value === 'Yes') setStep('q18b')
        else setStep('q19')
        return
      }
      if (step === 'q18b') {
        setStep('q19')
        return
      }
      if (step === 'q19') {
        setStep('q20')
        return
      }
      if (step === 'q20') {
        setStep('q21')
        return
      }
      if (step === 'q21') {
        navigate('/thanks', { replace: true })
      }
    } finally {
      setSaving(false)
    }
  }

  const prompt =
    step === 'q18'
      ? 'Do you have children under 12 in your household?'
      : step === 'q18b'
        ? 'How old are your children?'
        : step === 'q19'
          ? 'Before this quiz, how concerned were you about chemicals in your kitchen?'
          : step === 'q20'
            ? 'After your score, how concerned are you?'
            : 'When buying or replacing kitchen products, would you choose safer alternatives if you knew what they were?'

  const options =
    step === 'q18'
      ? ['Yes', 'No']
      : step === 'q18b'
        ? ['Under 5', '5-12', 'Both']
        : step === 'q19'
          ? ['Very concerned', 'Somewhat concerned', 'Not concerned']
          : step === 'q20'
            ? ['More concerned', 'About the same', 'Less concerned']
            : ['Yes', 'No', 'Maybe']

  const storageKey =
    step === 'q18'
      ? 'q18'
      : step === 'q18b'
        ? 'q18b'
        : step === 'q19'
          ? 'q19'
          : step === 'q20'
            ? 'q20'
            : 'q21'

  return (
    <QuizShell>
      <main className="flex min-h-dvh flex-col px-4 pb-10 pt-10">
        <QuizCard>
          <div className="text-sm font-semibold uppercase tracking-wide text-slate-600">
            A few more questions to help us improve
          </div>
          <div className="mt-3 text-2xl font-semibold leading-snug text-ink-900">{prompt}</div>
        </QuizCard>

        <div className="mt-auto grid gap-3 pt-6 pb-2">
          {options.map((opt) => (
            <QuizOutlineButton
              key={opt}
              disabled={saving}
              onClick={() => pick(storageKey, opt)}
              className="text-left"
            >
              <span className="flex w-full justify-start">{opt}</span>
            </QuizOutlineButton>
          ))}
        </div>
      </main>
    </QuizShell>
  )
}

