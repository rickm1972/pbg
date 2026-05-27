import { QuizCard, QuizShell } from '../ui'

export function QuizThankYouScreen() {
  return (
    <QuizShell>
      <main className="flex min-h-dvh flex-col px-4 pb-10 pt-10">
        <div className="mt-16">
          <QuizCard>
            <div className="font-display text-3xl font-semibold leading-tight text-ink-900">
              Thanks for taking the quiz.
            </div>
            <p className="mt-3 text-base leading-relaxed text-slate-700">We&apos;ll be in touch.</p>
          </QuizCard>
        </div>
      </main>
    </QuizShell>
  )
}

