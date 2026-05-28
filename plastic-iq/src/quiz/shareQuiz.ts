import { QUIZ_SHARE_TITLE } from './quizShareMeta'

export const QUIZ_SHARE_MESSAGE =
  'How exposed is your kitchen to plastic chemicals? This 2-minute quiz will tell you.'

export function getQuizShareUrl(): string {
  return window.location.origin
}

export function buildQuizShareCaption(): string {
  return QUIZ_SHARE_MESSAGE
}

export function buildQuizShareBodyWithLink(): string {
  return `${QUIZ_SHARE_MESSAGE}\n\n${getQuizShareUrl()}`
}

/**
 * Share message + URL only. Image comes once from og:image in the link preview card —
 * do not attach a PNG (iMessage would show it above the text and again in the preview).
 */
export async function shareQuizInvite(): Promise<'shared' | 'copied' | 'cancelled'> {
  const url = getQuizShareUrl()
  const text = buildQuizShareCaption()

  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ text, url })
      return 'shared'
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return 'cancelled'
    }
  }

  const body = buildQuizShareBodyWithLink()
  try {
    await navigator.clipboard.writeText(body)
  } catch {
    // ignore
  }

  const mailto = `mailto:?subject=${encodeURIComponent(QUIZ_SHARE_TITLE)}&body=${encodeURIComponent(body)}`
  window.open(mailto, '_blank', 'noopener,noreferrer')

  return 'copied'
}
