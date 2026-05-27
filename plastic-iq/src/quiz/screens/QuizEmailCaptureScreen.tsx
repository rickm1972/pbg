import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { patchQuizResponse } from '../../lib/quizResponsesApi'
import { computeQuizScore, tierForScore } from '../quizModel'
import { getResponseId, getScoredAnswers } from '../quizStorage'

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
    <div className="min-h-dvh bg-[#fdfcf9] text-ink-900">
      <main className="mx-auto flex min-h-dvh max-w-lg flex-col px-4 pb-10 pt-10">
        <div>
          <div className="text-sm font-semibold text-slate-700">Email</div>
          <div className="mt-2 text-2xl font-semibold leading-snug text-ink-900">
            Get my score
          </div>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            We&apos;ll email you your detailed results.
          </p>
        </div>

        <div className="mt-6">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="h-14 w-full rounded-2xl border-2 border-slate-200 bg-white px-4 text-base text-slate-900 outline-none focus:border-emerald-700"
            autoComplete="email"
            inputMode="email"
          />
          {error ? <div className="mt-2 text-sm text-red-700">{error}</div> : null}
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={saving}
          className="mt-auto h-16 w-full rounded-2xl bg-emerald-700 px-5 text-base font-semibold text-white disabled:opacity-70 active:bg-emerald-800"
        >
          {saving ? 'Saving…' : 'Get my score'}
        </button>
      </main>
    </div>
  )
}

