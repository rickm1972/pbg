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

function parseBoolMap(key: string): Record<string, boolean> {
  const raw = sessionStorage.getItem(key)
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

export function getScoredAnswers(): Record<string, boolean> {
  return parseBoolMap('quiz_scored_answers')
}

export function setScoredAnswer(id: string, value: boolean) {
  const current = getScoredAnswers()
  current[id] = value
  sessionStorage.setItem('quiz_scored_answers', JSON.stringify(current))
}

export function getAwarenessAnswers(): Record<string, boolean> {
  return parseBoolMap('quiz_awareness_answers')
}

export function setAwarenessAnswer(id: string, value: boolean) {
  const current = getAwarenessAnswers()
  current[id] = value
  sessionStorage.setItem('quiz_awareness_answers', JSON.stringify(current))
}

export function getMotivationAnswers(): Record<string, unknown> {
  const raw = sessionStorage.getItem('quiz_motivation_answers')
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
  sessionStorage.setItem('quiz_motivation_answers', JSON.stringify(current))
}

