import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { patchQuizResponse } from '../../lib/quizResponsesApi'
import { generateShareCardPng } from '../shareCard'
import { QuizCard, QuizOutlineButton, QuizPrimaryButton, QuizShell } from '../ui'
import {
  BRIDGE_SENTENCE,
  computeQuizScore,
  tierForScore,
} from '../quizModel'
import { getResponseId, getScoredAnswers } from '../quizStorage'

export function QuizResultsScreen() {
  const navigate = useNavigate()
  const responseId = getResponseId()
  const scoredAnswers = useMemo(() => getScoredAnswers(), [])
  const score = useMemo(() => computeQuizScore(scoredAnswers), [scoredAnswers])
  const result = useMemo(() => tierForScore(score), [score])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!responseId) navigate('/', { replace: true })
  }, [responseId, navigate])

  useEffect(() => {
    if (!responseId) return
    if (saving) return
    setSaving(true)
    // Mark completion (idempotent).
    patchQuizResponse(responseId, {
      completed_at: new Date().toISOString(),
      final_score: score,
      tier: result.tier,
      letter_grade: result.letterGrade,
    }).finally(() => setSaving(false))
  }, [responseId, score, result.tier, result.letterGrade, saving])

  async function share() {
    const text = `I got a ${result.letterGrade} (${score}) on my kitchen PAC Safety Score. What's yours?`
    const url = window.location.origin
    if (navigator.share) {
      try {
        const file = await generateShareCardPng({
          score,
          letterGrade: result.letterGrade,
          tierColor: result.color,
          url,
        })
        const canShareFiles =
          typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })
        await navigator.share(
          canShareFiles
            ? { title: 'Kitchen PAC Safety Quiz', text, url, files: [file] }
            : { title: 'Kitchen PAC Safety Quiz', text, url },
        )
        return
      } catch {
        // fall through to copy
      }
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`)
      alert('Copied share text.')
    } catch {
      alert(url)
    }
  }

  return (
    <QuizShell>
      <main className="px-4 pb-10 pt-8">
        <div className="rounded-3xl p-6 shadow-card" style={{ backgroundColor: result.color }}>
          <div className="text-center text-white">
            <div className="text-sm font-semibold uppercase tracking-wide opacity-95">
              Your kitchen PAC Safety Score
            </div>
            <div className="mt-4 text-6xl font-extrabold leading-none">{score}</div>
            <div className="mt-2 text-3xl font-bold">{result.letterGrade}</div>
            <div className="mt-4 text-lg font-semibold">{result.headline}</div>
            <div className="mt-2 text-sm leading-relaxed opacity-95">{result.impact}</div>
          </div>
        </div>

        <QuizCard className="mt-5">
          <p className="text-sm leading-relaxed text-slate-700">{BRIDGE_SENTENCE}</p>
        </QuizCard>

        <div className="mt-5">
          <QuizOutlineButton onClick={share}>Share my score</QuizOutlineButton>
        </div>

        <QuizCard className="mt-8">
          <div className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            What are these chemicals?
          </div>
          <div className="mt-2 space-y-4 text-sm leading-relaxed text-slate-700">
            <p>
              The chemicals released from plastic and plastic-coated products are a family called
              plastic-associated chemicals, or PACs. The most concerning groups are PFAS (in
              nonstick cookware), phthalates (in soft plastics), bisphenols like BPA and BPS (in
              hard plastics and can linings), and flame retardants. These chemicals are linked to
              hormone disruption, immune problems, fertility issues, certain cancers, and
              developmental concerns.
            </p>
            <p>
              <span className="font-semibold">PFAS</span> — the &quot;forever chemicals&quot;. Nonstick cookware
              often contains chemicals called PFAS, sometimes called &quot;forever chemicals&quot; because
              they don&apos;t break down in the body or environment. PFAS have been detected in the
              blood of 97% of Americans. They&apos;re linked to thyroid disease, weakened immune
              response, certain cancers, and developmental issues in children.
            </p>
            <p>
              <span className="font-semibold">Phthalates and bisphenols</span> — the hormone disruptors.
              Many everyday plastics contain chemicals called phthalates and bisphenols (like BPA
              and BPS) that disrupt your body&apos;s hormones. They&apos;ve been detected in 95%+ of
              Americans. Phthalates lower testosterone and contribute to documented declines in male
              hormone levels. Bisphenols mimic estrogen and are linked to fertility problems, weight
              gain, mood changes, and developmental issues in children.
            </p>
            <p>
              <span className="font-semibold">Heat makes it worse.</span> Heat dramatically speeds up
              how much chemical migrates from plastic into food. Microwaving plastic — even
              containers labeled &quot;microwave safe&quot; — releases chemicals into your food. The
              dishwasher does the same to plastic items. And hot coffee in a paper cup with plastic
              lining absorbs chemicals from the lining. The hotter the contact, the more migration.
            </p>
            <p>
              <span className="font-semibold">Kids are more vulnerable.</span> Children absorb more
              PACs relative to their body weight, and their developing systems — hormones, brain,
              immune, reproductive — are especially sensitive during growth windows. Studies show
              kids carry higher per-body-weight levels of phthalates and bisphenols than adults.
              Reducing your kitchen&apos;s PAC load protects everyone who eats in your home.
            </p>
            <p>
              <span className="font-semibold">How do these chemicals get into you?</span> Mostly
              through food and drinks. Plastic containers, nonstick coatings, food packaging, and
              cutting boards all release small amounts of chemicals into what you eat and drink. The
              amounts seem small until you multiply them by every meal, every day, for years.
            </p>
            <p>
              <span className="font-semibold">Why your kitchen matters most.</span> Your kitchen is
              where food and plastic meet most often. Reducing chemical exposure starts here.
              Replacing high-risk items with safer alternatives is one of the highest-impact changes
              you can make.
            </p>
          </div>
        </QuizCard>

        <div className="mt-8">
          <QuizPrimaryButton onClick={() => navigate('/motivation')}>Continue</QuizPrimaryButton>
        </div>
      </main>
    </QuizShell>
  )
}

