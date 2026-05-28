import { AWARENESS_QUESTIONS, SCORED_QUESTIONS } from './quizModel'

const SCORED_IDS = SCORED_QUESTIONS.map((q) => q.id)
const AWARENESS_IDS = AWARENESS_QUESTIONS.map((q) => q.id)

export const QUIZ_QUESTION_COUNT = SCORED_IDS.length + AWARENESS_IDS.length

export function allQuizQuestionIds(): string[] {
  return [...SCORED_IDS, ...AWARENESS_IDS]
}

export function nextRouteAfterQuestion(qId: string): string {
  if (qId === 'q7') return '/i/nature'
  if (qId === 'q14') return '/i/kids'
  const ids = allQuizQuestionIds()
  const idx = ids.indexOf(qId)
  if (idx < 0 || idx >= ids.length - 1) return '/motivation'
  return `/q/${ids[idx + 1]}`
}

export function previousQuestionId(currentId: string): string | null {
  const ids = allQuizQuestionIds()
  const idx = ids.indexOf(currentId)
  if (idx <= 0) return null
  return ids[idx - 1] ?? null
}

export function questionProgressIndex(currentId: string): number {
  const ids = allQuizQuestionIds()
  const idx = ids.indexOf(currentId)
  return idx >= 0 ? idx + 1 : 1
}

export function routeBeforeQuestion(qId: string): string {
  if (qId === 'q1') return '/concern/pre'
  const prev = previousQuestionId(qId)
  if (!prev) return '/concern/pre'
  if (prev === 'q7') return '/i/nature'
  if (prev === 'q14') return '/i/kids'
  return `/q/${prev}`
}
