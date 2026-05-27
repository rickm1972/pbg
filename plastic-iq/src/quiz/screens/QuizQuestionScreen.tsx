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
  const isFirst = qId === 'q1'
  const questionText = scored?.text ?? awareness?.text ?? ''
  const isAwareness = Boolean(awareness)

  async function answer(value: boolean) {
    const responseId = getResponseId()
    if (!responseId || !qId) return
    if (saving) return

    setSaving(true)
    setPulse(value ? 'yes' : 'no')

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
    } finally {
      window.setTimeout(() => setPulse(null), 320)
      setSaving(false)
    }
  }

  return (
    <QuizShell>
      <QuizHeader compact />
      <QuizProgressBar
        current={idx}
        total={TOTAL_QUESTIONS}
        showBack={!isFirst}
        onBack={() => navigate(-1)}
      />
      <QuizPage
        footer={
          <div className="grid grid-cols-2 gap-3">
            <QuizChoiceButton
              variant="yes"
              disabled={saving}
              selected={pulse === 'yes'}
              onClick={() => answer(true)}
            >
              Yes
            </QuizChoiceButton>
            <QuizChoiceButton
              variant="no"
              disabled={saving}
              selected={pulse === 'no'}
              onClick={() => answer(false)}
            >
              No
            </QuizChoiceButton>
          </div>
        }
      >
        <QuizCard padding="lg" className="min-h-[40vh]">
          {isAwareness ? (
            <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Quick check — not scored
            </div>
          ) : null}
          <p className="text-xl font-semibold leading-snug text-ink-900 sm:text-[1.35rem] sm:leading-snug">
            {questionText}
          </p>
        </QuizCard>
      </QuizPage>
    </QuizShell>
  )
}
