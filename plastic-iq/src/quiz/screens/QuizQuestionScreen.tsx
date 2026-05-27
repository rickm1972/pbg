import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { patchQuizResponse } from '../../lib/quizResponsesApi'
import {
  AWARENESS_QUESTIONS,
  INTERSTITIAL_AFTER_Q14,
  INTERSTITIAL_AFTER_Q9,
  SCORED_QUESTIONS,
} from '../quizModel'
import {
  getAwarenessAnswers,
  getResponseId,
  getScoredAnswers,
  setAwarenessAnswer,
  setScoredAnswer,
} from '../quizStorage'

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
  const progress = Math.round((idx / TOTAL_QUESTIONS) * 100)

  async function answer(value: boolean) {
    const responseId = getResponseId()
    if (!responseId || !qId) return
    if (saving) return

    setSaving(true)
    setPulse(value ? 'yes' : 'no')

    try {
      if (scored) {
        setScoredAnswer(qId, value)
        const answers = getScoredAnswers()
        await patchQuizResponse(responseId, { scored_answers: answers as unknown as Record<string, unknown> })
      } else if (awareness) {
        setAwarenessAnswer(qId, value)
        const answers = getAwarenessAnswers()
        await patchQuizResponse(responseId, { awareness_answers: answers as unknown as Record<string, unknown> })
      }

      const next = nextQuestionId(qId)
      // Interstitials after q9 and q14, but only if we're moving past those ids.
      if (qId === 'q9') {
        navigate('/i/heat', { replace: true })
        return
      }
      if (qId === 'q14') {
        navigate('/i/kids', { replace: true })
        return
      }

      if (!next) {
        navigate('/email', { replace: true })
        return
      }
      // Small confirmation delay (~250ms)
      window.setTimeout(() => navigate(`/q/${next}`), 250)
    } finally {
      window.setTimeout(() => setPulse(null), 300)
      setSaving(false)
    }
  }

  const questionText = scored?.text ?? awareness?.text ?? ''
  const isFirst = qId === 'q1'

  return (
    <div className="min-h-dvh bg-[#fdfcf9] text-ink-900">
      <div className="mx-auto max-w-lg px-4 pt-4">
        <div className="h-2 w-full overflow-hidden rounded-full bg-[#E5E7EB]">
          <div className="h-full bg-emerald-700 transition-[width] duration-300" style={{ width: `${progress}%` }} />
        </div>
        <div className="mt-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className={`text-sm font-semibold text-slate-700 ${isFirst ? 'invisible' : ''}`}
            aria-label="Back"
          >
            ←
          </button>
          <div className="text-sm font-semibold text-slate-700">
            Question {idx} of {TOTAL_QUESTIONS}
          </div>
          <div className="w-8" />
        </div>
      </div>

      <main className="mx-auto flex max-w-lg flex-col px-4 pb-10 pt-8">
        <div className="min-h-[32vh]">
          <div className="text-2xl font-semibold leading-snug text-ink-900">{questionText}</div>
        </div>

        <div className="mt-auto grid gap-3 pb-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => answer(true)}
            className={[
              'h-16 w-full rounded-2xl border-2 border-emerald-700 bg-transparent text-base font-semibold text-emerald-800',
              'active:bg-emerald-700 active:text-white',
              pulse === 'yes' ? 'bg-emerald-700 text-white' : '',
              saving ? 'opacity-80' : '',
            ].join(' ')}
          >
            Yes
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => answer(false)}
            className={[
              'h-16 w-full rounded-2xl border-2 border-slate-300 bg-white text-base font-semibold text-slate-800',
              'active:border-emerald-700 active:bg-emerald-700 active:text-white',
              pulse === 'no' ? 'border-emerald-700 bg-emerald-700 text-white' : '',
              saving ? 'opacity-80' : '',
            ].join(' ')}
          >
            No
          </button>
        </div>
      </main>

      {/* Preload interstitial copy so routes are deterministic */}
      <div className="hidden" aria-hidden>
        {INTERSTITIAL_AFTER_Q9}
        {INTERSTITIAL_AFTER_Q14}
      </div>
    </div>
  )
}

