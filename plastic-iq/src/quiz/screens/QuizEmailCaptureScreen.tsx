import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { patchQuizResponse } from '../../lib/quizResponsesApi'
import { getResponseId, setFirstName } from '../quizStorage'
import {
  QuizCard,
  QuizEyebrow,
  QuizHeader,
  QuizPage,
  QuizPrimaryButton,
  QuizShell,
} from '../ui'

const inputClassName =
  'h-14 w-full rounded-2xl border-2 border-slate-200 bg-white px-4 text-base text-slate-900 outline-none ring-0 transition-colors focus:border-forest'

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

export function QuizEmailCaptureScreen() {
  const navigate = useNavigate()
  const responseId = getResponseId()
  const [firstName, setFirstNameField] = useState('')
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!responseId) navigate('/', { replace: true })
  }, [responseId, navigate])

  const canSubmit =
    firstName.trim().length > 0 && isValidEmail(email) && !saving

  async function submit() {
    if (!responseId) {
      navigate('/', { replace: true })
      return
    }
    if (!canSubmit) {
      setError('Please enter your first name and a valid email address.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const trimmedName = firstName.trim()
      const trimmedEmail = email.trim()
      setFirstName(trimmedName)
      await patchQuizResponse(responseId, {
        first_name: trimmedName,
        user_email: trimmedEmail,
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
      <QuizHeader size="hero" />
      <QuizPage>
        <QuizCard padding="lg">
          <QuizEyebrow>Almost done</QuizEyebrow>
          <h2 className="mt-3 font-display text-2xl font-semibold leading-snug text-ink-900">
            Get my score
          </h2>
          <label className="mt-6 block">
            <span className="mb-2 block text-sm font-medium text-slate-700">
              First name <span className="text-red-600">*</span>
            </span>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstNameField(e.target.value)}
              placeholder="Jane"
              required
              autoComplete="given-name"
              className={inputClassName}
            />
          </label>
          <label className="mt-4 block">
            <span className="mb-2 block text-sm font-medium text-slate-700">
              Email <span className="text-red-600">*</span>
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
              inputMode="email"
              className={inputClassName}
            />
          </label>
          {error ? (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </div>
          ) : null}
        </QuizCard>

        <div className="mt-6">
          <QuizPrimaryButton onClick={submit} disabled={!canSubmit}>
            {saving ? 'Saving…' : 'Get my score'}
          </QuizPrimaryButton>
        </div>
      </QuizPage>
    </QuizShell>
  )
}
