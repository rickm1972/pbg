import { QuizCard, QuizEyebrow, QuizHeader, QuizPage, QuizShell } from '../ui'

export function QuizThankYouScreen() {
  return (
    <QuizShell>
      <QuizHeader />
      <QuizPage>
        <QuizCard padding="lg" className="mt-8 text-center">
          <QuizEyebrow>All set</QuizEyebrow>
          <h1 className="mt-3 font-display text-3xl font-semibold leading-tight text-ink-900">
            Thanks for taking the quiz.
          </h1>
          <p className="mt-4 text-base leading-relaxed text-slate-700">We&apos;ll be in touch.</p>
        </QuizCard>
      </QuizPage>
    </QuizShell>
  )
}
