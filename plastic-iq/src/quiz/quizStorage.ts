import type { ScoredAnswerValue } from './quizModel'
import { normalizeScoredAnswer } from './quizModel'

const SCORED_KEY = 'quiz_scored_answers'
const AWARENESS_KEY = 'quiz_awareness_answers'
const MOTIVATION_KEY = 'quiz_motivation_answers'

export function getResponseId(): string | null {
  const fromSession = sessionStorage.getItem('quiz_response_id')
  if (fromSession && fromSession.trim()) return fromSession.trim()
  const fromLocal = localStorage.getItem('quiz_response_id')
  if (fromLocal && fromLocal.trim()) return fromLocal.trim()
  return null
}

export function setResponseId(id: string) {
  const trimmed = id.trim()
  sessionStorage.setItem('quiz_response_id', trimmed)
  localStorage.setItem('quiz_response_id', trimmed)
}

export function clearResponseId() {
  sessionStorage.removeItem('quiz_response_id')
  localStorage.removeItem('quiz_response_id')
}

export function getFirstName(): string | null {
  const name = sessionStorage.getItem('quiz_first_name')
  return name && name.trim() ? name.trim() : null
}

export function setFirstName(name: string) {
  sessionStorage.setItem('quiz_first_name', name.trim())
}

const EMAIL_CAPTURED_KEY = 'quiz_email_captured'

export function setEmailCaptured() {
  sessionStorage.setItem(EMAIL_CAPTURED_KEY, '1')
}

export function hasEmailCaptured(): boolean {
  return sessionStorage.getItem(EMAIL_CAPTURED_KEY) === '1'
}

export function clearEmailCaptured() {
  sessionStorage.removeItem(EMAIL_CAPTURED_KEY)
}

function parseScoredMap(raw: string | null): Record<string, ScoredAnswerValue> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}
    const obj = parsed as Record<string, unknown>
    const out: Record<string, ScoredAnswerValue> = {}
    for (const [k, v] of Object.entries(obj)) {
      const norm = normalizeScoredAnswer(v)
      if (norm) out[k] = norm
    }
    return out
  } catch {
    return {}
  }
}

export function mergeScoredAnswerMaps(
  ...sources: Array<Record<string, unknown> | Record<string, ScoredAnswerValue>>
): Record<string, ScoredAnswerValue> {
  const out: Record<string, ScoredAnswerValue> = {}
  for (const src of sources) {
    for (const [k, v] of Object.entries(src ?? {})) {
      const norm = normalizeScoredAnswer(v)
      if (norm) out[k] = norm
    }
  }
  return out
}

function persistScoredMap(map: Record<string, ScoredAnswerValue>) {
  const json = JSON.stringify(map)
  sessionStorage.setItem(SCORED_KEY, json)
  localStorage.setItem(SCORED_KEY, json)
}

export function getScoredAnswers(): Record<string, ScoredAnswerValue> {
  const fromSession = parseScoredMap(sessionStorage.getItem(SCORED_KEY))
  if (Object.keys(fromSession).length > 0) return fromSession
  const fromLocal = parseScoredMap(localStorage.getItem(SCORED_KEY))
  if (Object.keys(fromLocal).length > 0) {
    sessionStorage.setItem(SCORED_KEY, JSON.stringify(fromLocal))
    return fromLocal
  }
  return {}
}

export function setScoredAnswer(id: string, value: ScoredAnswerValue) {
  const current = getScoredAnswers()
  current[id] = value
  persistScoredMap(current)
}

function parseBoolMap(raw: string | null): Record<string, boolean> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}
    const obj = parsed as Record<string, unknown>
    const out: Record<string, boolean> = {}
    for (const [k, v] of Object.entries(obj)) out[k] = v === true
    return out
  } catch {
    return {}
  }
}

function persistAwarenessMap(map: Record<string, boolean>) {
  const json = JSON.stringify(map)
  sessionStorage.setItem(AWARENESS_KEY, json)
  localStorage.setItem(AWARENESS_KEY, json)
}

export function getAwarenessAnswers(): Record<string, boolean> {
  const fromSession = parseBoolMap(sessionStorage.getItem(AWARENESS_KEY))
  if (Object.keys(fromSession).length > 0) return fromSession
  const fromLocal = parseBoolMap(localStorage.getItem(AWARENESS_KEY))
  if (Object.keys(fromLocal).length > 0) {
    sessionStorage.setItem(AWARENESS_KEY, JSON.stringify(fromLocal))
    return fromLocal
  }
  return {}
}

export function setAwarenessAnswer(id: string, value: boolean) {
  const current = getAwarenessAnswers()
  current[id] = value
  persistAwarenessMap(current)
}

export function getMotivationAnswers(): Record<string, unknown> {
  const raw =
    sessionStorage.getItem(MOTIVATION_KEY) ?? localStorage.getItem(MOTIVATION_KEY)
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed as Record<string, unknown>
  } catch {
    return {}
  }
}

export function setMotivationAnswer(id: string, value: unknown) {
  const current = getMotivationAnswers()
  current[id] = value
  const json = JSON.stringify(current)
  sessionStorage.setItem(MOTIVATION_KEY, json)
  localStorage.setItem(MOTIVATION_KEY, json)
}

export function clearQuizAnswerStorage() {
  for (const key of [SCORED_KEY, AWARENESS_KEY, MOTIVATION_KEY]) {
    sessionStorage.removeItem(key)
    localStorage.removeItem(key)
  }
}

export function restoreScoredAnswersFromServer(server: Record<string, unknown> | undefined) {
  const merged = mergeScoredAnswerMaps(server ?? {}, getScoredAnswers())
  persistScoredMap(merged)
  return merged
}
