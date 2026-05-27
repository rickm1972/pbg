import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { patchQuizResponse } from '../../lib/quizResponsesApi'
import { shareQuizInvite } from '../shareQuiz'
import {
  QuizHeader,
  QuizPage,
  QuizPrimaryButton,
  QuizShareButton,
  QuizShell,
} from '../ui'
import { computeQuizScore, tierForScore } from '../quizModel'
import { getFirstName, getResponseId, getScoredAnswers } from '../quizStorage'

export function QuizResultsScreen() {
  const navigate = useNavigate()
  const responseId = getResponseId()
  const scoredAnswers = useMemo(() => getScoredAnswers(), [])
  const score = useMemo(() => computeQuizScore(scoredAnswers), [scoredAnswers])
  const result = useMemo(() => tierForScore(score), [score])
  const firstName = getFirstName()
  const [saving, setSaving] = useState(false)
  const [sharing, setSharing] = useState(false)

  const scoreEyebrow = firstName
    ? `${firstName}, your kitchen scored:`
    : 'Your kitchen scored:'

  useEffect(() => {
    if (!responseId) navigate('/', { replace: true })
  }, [responseId, navigate])

  useEffect(() => {
    if (!responseId) return
    if (saving) return
    setSaving(true)
    patchQuizResponse(responseId, {
      completed_at: new Date().toISOString(),
      final_score: score,
      tier: result.tier,
      letter_grade: result.letterGrade,
    }).finally(() => setSaving(false))
  }, [responseId, score, result.tier, result.letterGrade, saving])

  async function share() {
    if (sharing) return
    setSharing(true)
    try {
      const outcome = await shareQuizInvite()
      if (outcome === 'copied') {
        alert(
          'Share link copied. You can paste it into a text or email — or use the email draft that opened.',
        )
      }
    } finally {
      setSharing(false)
    }
  }

  return (
    <QuizShell>
      <QuizHeader size="hero" />
      <QuizPage>
        <div
          className="overflow-hidden rounded-3xl p-6 shadow-[0_10px_40px_-24px_rgba(15,61,38,0.35)] ring-1 ring-black/5"
          style={{ backgroundColor: result.color }}
        >
          <div className="text-center text-white">
            <div className="text-sm font-semibold leading-snug opacity-95 sm:text-base">
              {scoreEyebrow}
            </div>
            <div className="mt-4 text-6xl font-extrabold leading-none tracking-tight">
              {score}
              <span className="font-extrabold"> / 100</span>
            </div>
            <div className="mt-3 text-2xl leading-none sm:text-3xl">
              <span className="font-medium opacity-90">Grade: </span>
              <span className="font-bold">{result.letterGrade}</span>
            </div>
            <div className="mt-4 text-lg font-semibold">{result.headline}</div>
            <div className="mt-2 text-base leading-relaxed opacity-95 sm:text-lg">
              {result.impact}
            </div>
          </div>
        </div>

        <div className="mt-5">
          <QuizShareButton onClick={share} busy={sharing} />
        </div>

        <div className="mt-6">
          <QuizPrimaryButton onClick={() => navigate('/motivation')}>
            A few quick questions to help us
          </QuizPrimaryButton>
        </div>
      </QuizPage>
    </QuizShell>
  )
}
