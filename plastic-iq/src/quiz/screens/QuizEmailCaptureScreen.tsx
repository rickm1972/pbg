import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { patchQuizResponse } from '../../lib/quizResponsesApi'
import { computeQuizScore, tierForScore } from '../quizModel'
import { getResponseId, getScoredAnswers } from '../quizStorage'
import {
  QuizCard,
  QuizEyebrow,
  QuizHeader,
  QuizPage,
  QuizPrimaryButton,
  QuizShell,
} from '../ui'

export function QuizEmailCaptureScreen() {
  const navigate = useNavigate()
  const responseId = getResponseId()
  const scoredAnswers = useMemo(() => getScoredAnswers(), [])
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (!responseId) {
      navigate('/', { replace: true })
      return
    }
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      await patchQuizResponse(responseId, { user_email: email.trim() || null })
      const score = computeQuizScore(scoredAnswers)
      const { tier, letterGrade } = tierForScore(score)
      await patchQuizResponse(responseId, {
        final_score: score,
        tier,
        letter_grade: letterGrade,
      })
      navigate('/loading', { replace: true })
    } catch {
      setError('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <QuizShell>
      <QuizHeader compact />
      <QuizPage
        footer={
          <QuizPrimaryButton onClick={submit} disabled={saving}>
            {saving ? 'Saving…' : 'Get my score'}
          </QuizPrimaryButton>
        }
      >
        <QuizCard padding="lg">
          <QuizEyebrow>Almost done</QuizEyebrow>
          <h2 className="mt-3 font-display text-2xl font-semibold leading-snug text-ink-900">
            Get my score
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            We&apos;ll email you your detailed results.
          </p>
          <label className="mt-6 block">
            <span className="sr-only">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="h-14 w-full rounded-2xl border-2 border-slate-200 bg-white px-4 text-base text-slate-900 outline-none ring-0 transition-colors focus:border-forest"
              autoComplete="email"
              inputMode="email"
            />
          </label>
          {error ? (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </div>
          ) : null}
        </QuizCard>
      </QuizPage>
    </QuizShell>
  )
}
