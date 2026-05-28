import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { patchQuizResponse } from '../../lib/quizResponsesApi'
import { PRE_CONCERN_OPTIONS, PRE_CONCERN_PROMPT } from '../quizModel'
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

export function QuizPreConcernScreen() {
  const navigate = useNavigate()
  const responseId = getResponseId()
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    if (!responseId) navigate('/', { replace: true })
  }, [responseId, navigate])

  async function pick(value: string) {
    if (!responseId || saving) return
    setSaving(true)
    setSelected(value)
    try {
      setMotivationAnswer('q19', value)
      await patchQuizResponse(responseId, {
        motivation_answers: getMotivationAnswers() as Record<string, unknown>,
      })
      await new Promise((r) => window.setTimeout(r, 220))
      navigate('/q/q1', { replace: true })
    } catch {
      setSelected(null)
    } finally {
      setSaving(false)
    }
  }

  return (
    <QuizShell>
      <QuizHeader size="hero" />
      <QuizProgressBar current={1} total={1} onBack={() => navigate('/')} />
      <QuizPage>
        <QuizCard padding="lg">
          <QuizEyebrow>Before we start</QuizEyebrow>
          <p className="mt-3 text-xl font-semibold leading-snug text-ink-900">{PRE_CONCERN_PROMPT}</p>
        </QuizCard>

        <div className="mt-4 grid gap-3">
          {PRE_CONCERN_OPTIONS.map((opt) => (
            <QuizChoiceButton
              key={opt}
              disabled={saving}
              selected={selected === opt}
              onClick={() => pick(opt)}
            >
              {opt}
            </QuizChoiceButton>
          ))}
        </div>
      </QuizPage>
    </QuizShell>
  )
}
