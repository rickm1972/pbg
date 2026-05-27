import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { patchQuizResponse } from '../../lib/quizResponsesApi'
import { computeQuizScore, tierForScore } from '../quizModel'
import { getResponseId, getScoredAnswers } from '../quizStorage'
import { QuizCard, QuizPrimaryButton, QuizShell } from '../ui'

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

      // Precompute and persist score fields so results can render instantly.
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
      <main className="flex min-h-dvh flex-col px-4 pb-10 pt-10">
        <QuizCard>
          <div className="text-sm font-semibold uppercase tracking-wide text-slate-600">
            Email capture
          </div>
          <div className="mt-2 font-display text-2xl font-semibold leading-snug text-ink-900">
            Get my score
          </div>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            We&apos;ll email you your detailed results.
          </p>

          <div className="mt-5">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="h-14 w-full rounded-2xl border-2 border-slate-200 bg-white px-4 text-base text-slate-900 outline-none focus:border-forest"
              autoComplete="email"
              inputMode="email"
            />
            {error ? <div className="mt-2 text-sm font-semibold text-red-700">{error}</div> : null}
          </div>
        </QuizCard>

        <div className="mt-auto pt-6">
          <QuizPrimaryButton onClick={submit} disabled={saving}>
            {saving ? 'Saving…' : 'Get my score'}
          </QuizPrimaryButton>
        </div>
      </main>
    </QuizShell>
  )
}

