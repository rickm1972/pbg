import { generateQuizInviteShareCardPng } from './shareCard'
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
 * Share logo PNG + quiz URL. Do not put link-preview lines in share `text` — iMessage puts
 * that in the message body. Title + subtitle + URL in the gray card come from og:title and
 * og:description on the deployed page (see quizShareMeta + vite.quiz.config).
 */
export async function shareQuizInvite(): Promise<'shared' | 'copied' | 'cancelled'> {
  const url = getQuizShareUrl()
  const text = buildQuizShareCaption()

  let file: File | null = null
  try {
    file = await generateQuizInviteShareCardPng(url)
  } catch {
    file = null
  }

  if (typeof navigator.share === 'function') {
    try {
      const withFiles =
        file &&
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files: [file] })

      if (withFiles && file) {
        // Only the invite blurb in the message — not og:title/description lines.
        // Gray card (title / 2 lines / URL) comes from og:* on the deployed page.
        await navigator.share({ files: [file], url, text })
        return 'shared'
      }

      await navigator.share({ title: QUIZ_SHARE_TITLE, text, url })
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
