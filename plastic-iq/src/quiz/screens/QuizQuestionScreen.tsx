import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { patchQuizResponse } from '../../lib/quizResponsesApi'
import {
  AWARENESS_QUESTIONS,
  SCORED_QUESTIONS,
  type ScoredAnswerValue,
} from '../quizModel'
import {
  nextRouteAfterQuestion,
  questionProgressIndex,
  QUIZ_QUESTION_COUNT,
  routeBeforeQuestion,
} from '../quizFlow'
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

export function QuizQuestionScreen() {
  const { qId } = useParams()
  const navigate = useNavigate()

  const scored = useMemo(() => SCORED_QUESTIONS.find((q) => q.id === qId), [qId])
  const awareness = useMemo(() => AWARENESS_QUESTIONS.find((q) => q.id === qId), [qId])

  const [saving, setSaving] = useState(false)
  const [pulse, setPulse] = useState<ScoredAnswerValue | null>(null)
  const [awarenessPulse, setAwarenessPulse] = useState<'yes' | 'no' | null>(null)
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

  const idx = questionProgressIndex(qId ?? '')
  const questionText = scored?.text ?? awareness?.text ?? ''

  function goBack() {
    if (!qId) {
      navigate('/')
      return
    }
    navigate(routeBeforeQuestion(qId))
  }

  async function answerScored(value: ScoredAnswerValue) {
    const responseId = getResponseId()
    if (!responseId || !qId) return
    if (saving) return

    setSaving(true)
    setPulse(value)
    setError(null)

    try {
      setScoredAnswer(qId, value)
      await patchQuizResponse(responseId, {
        scored_answers: getScoredAnswers() as unknown as Record<string, unknown>,
      })

      const dest = nextRouteAfterQuestion(qId)
      if (dest.startsWith('/i/')) {
        navigate(dest, { replace: true })
        return
      }
      window.setTimeout(() => navigate(dest), 280)
    } catch {
      setError('Could not save your answer. Please try again.')
    } finally {
      window.setTimeout(() => setPulse(null), 320)
      setSaving(false)
    }
  }

  async function answerAwareness(value: boolean) {
    const responseId = getResponseId()
    if (!responseId || !qId) return
    if (saving) return

    setSaving(true)
    setAwarenessPulse(value ? 'yes' : 'no')
    setError(null)

    try {
      setAwarenessAnswer(qId, value)
      await patchQuizResponse(responseId, {
        awareness_answers: getAwarenessAnswers() as unknown as Record<string, unknown>,
      })

      const dest = nextRouteAfterQuestion(qId)
      window.setTimeout(() => navigate(dest), 280)
    } catch {
      setError('Could not save your answer. Please try again.')
    } finally {
      window.setTimeout(() => setAwarenessPulse(null), 320)
      setSaving(false)
    }
  }

  return (
    <QuizShell>
      <QuizHeader size="hero" />
      <QuizProgressBar current={idx} total={QUIZ_QUESTION_COUNT} onBack={goBack} />
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

        {scored ? (
          <div className="mt-4 grid grid-cols-3 gap-3">
            <QuizChoiceButton
              disabled={saving}
              selected={pulse === 'yes'}
              onClick={() => answerScored('yes')}
            >
              Yes
            </QuizChoiceButton>
            <QuizChoiceButton
              disabled={saving}
              selected={pulse === 'no'}
              onClick={() => answerScored('no')}
            >
              No
            </QuizChoiceButton>
            <QuizChoiceButton
              disabled={saving}
              selected={pulse === 'sometimes'}
              onClick={() => answerScored('sometimes')}
            >
              Sometimes
            </QuizChoiceButton>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-3">
            <QuizChoiceButton
              disabled={saving}
              selected={awarenessPulse === 'yes'}
              onClick={() => answerAwareness(true)}
            >
              Yes
            </QuizChoiceButton>
            <QuizChoiceButton
              disabled={saving}
              selected={awarenessPulse === 'no'}
              onClick={() => answerAwareness(false)}
            >
              No
            </QuizChoiceButton>
          </div>
        )}
      </QuizPage>
    </QuizShell>
  )
}
