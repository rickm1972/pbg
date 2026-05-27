import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { patchQuizResponse } from '../../lib/quizResponsesApi'
import {
  AWARENESS_QUESTIONS,
  SCORED_QUESTIONS,
} from '../quizModel'
import {
  getAwarenessAnswers,
  getResponseId,
  getScoredAnswers,
  setAwarenessAnswer,
  setScoredAnswer,
} from '../quizStorage'
import {
  QuizCard,
  QuizChoiceButton,
  QuizHeader,
  QuizPage,
  QuizProgressBar,
  QuizShell,
} from '../ui'

const TOTAL_QUESTIONS = 17

function allQuestionIds(): string[] {
  return [...SCORED_QUESTIONS.map((q) => q.id), ...AWARENESS_QUESTIONS.map((q) => q.id)]
}

function nextQuestionId(currentId: string): string | null {
  const ids = allQuestionIds()
  const idx = ids.indexOf(currentId)
  if (idx < 0) return null
  return ids[idx + 1] ?? null
}

function previousQuestionId(currentId: string): string | null {
  const ids = allQuestionIds()
  const idx = ids.indexOf(currentId)
  if (idx <= 0) return null
  return ids[idx - 1] ?? null
}

function questionIndex(currentId: string): number {
  const ids = allQuestionIds()
  const idx = ids.indexOf(currentId)
  return idx >= 0 ? idx + 1 : 1
}

export function QuizQuestionScreen() {
  const { qId } = useParams()
  const navigate = useNavigate()

  const scored = useMemo(() => SCORED_QUESTIONS.find((q) => q.id === qId), [qId])
  const awareness = useMemo(() => AWARENESS_QUESTIONS.find((q) => q.id === qId), [qId])

  const [saving, setSaving] = useState(false)
  const [pulse, setPulse] = useState<'yes' | 'no' | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!qId || (!scored && !awareness)) {
      navigate('/', { replace: true })
      return
    }
    if (!getResponseId()) {
      navigate('/', { replace: true })
    }
  }, [qId, scored, awareness, navigate])

  const idx = questionIndex(qId ?? '')
  const questionText = scored?.text ?? awareness?.text ?? ''

  function goBack() {
    if (!qId || qId === 'q1') {
      navigate('/')
      return
    }
    const prev = previousQuestionId(qId)
    if (prev) navigate(`/q/${prev}`)
    else navigate('/')
  }

  async function answer(value: boolean) {
    const responseId = getResponseId()
    if (!responseId || !qId) return
    if (saving) return

    setSaving(true)
    setPulse(value ? 'yes' : 'no')
    setError(null)

    try {
      if (scored) {
        setScoredAnswer(qId, value)
        await patchQuizResponse(responseId, {
          scored_answers: getScoredAnswers() as unknown as Record<string, unknown>,
        })
      } else if (awareness) {
        setAwarenessAnswer(qId, value)
        await patchQuizResponse(responseId, {
          awareness_answers: getAwarenessAnswers() as unknown as Record<string, unknown>,
        })
      }

      if (qId === 'q9') {
        navigate('/i/heat', { replace: true })
        return
      }
      if (qId === 'q14') {
        navigate('/i/kids', { replace: true })
        return
      }

      const next = nextQuestionId(qId)
      if (!next) {
        navigate('/email', { replace: true })
        return
      }
      window.setTimeout(() => navigate(`/q/${next}`), 280)
    } catch {
      setError('Could not save your answer. Please try again.')
    } finally {
      window.setTimeout(() => setPulse(null), 320)
      setSaving(false)
    }
  }

  return (
    <QuizShell>
      <QuizHeader size="hero" />
      <QuizProgressBar
        current={idx}
        total={TOTAL_QUESTIONS}
        onBack={goBack}
      />
      <QuizPage>
        <QuizCard padding="lg">
          <p className="text-xl font-semibold leading-snug text-ink-900 sm:text-[1.35rem] sm:leading-snug">
            {questionText}
          </p>
        </QuizCard>

        {error ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        <div className="mt-4 grid grid-cols-2 gap-3">
          <QuizChoiceButton
            disabled={saving}
            selected={pulse === 'yes'}
            onClick={() => answer(true)}
          >
            Yes
          </QuizChoiceButton>
          <QuizChoiceButton
            disabled={saving}
            selected={pulse === 'no'}
            onClick={() => answer(false)}
          >
            No
          </QuizChoiceButton>
        </div>
      </QuizPage>
    </QuizShell>
  )
}
