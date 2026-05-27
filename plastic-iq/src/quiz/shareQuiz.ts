import { generateQuizInviteShareCardPng } from './shareCard'

export const QUIZ_PUBLIC_URL = 'https://quiz.plasticbegone.com'

export const QUIZ_SHARE_MESSAGE =
  'Found this quiz that shows how much plastic is in your kitchen. Took me 2 minutes — worth checking. quiz.plasticbegone.com'

const SHARE_TITLE = 'Kitchen PAC Safety Quiz'

/** URL used for share sheet link previews (production quiz domain). */
export function getQuizShareUrl(): string {
  const fromEnv = import.meta.env.VITE_QUIZ_PUBLIC_URL as string | undefined
  const trimmed = fromEnv?.trim()
  return trimmed || QUIZ_PUBLIC_URL
}

export function buildQuizShareCaption(): string {
  return QUIZ_SHARE_MESSAGE
}

export async function shareQuizInvite(): Promise<'shared' | 'copied' | 'cancelled'> {
  const url = getQuizShareUrl()
  const text = buildQuizShareCaption()

  let file: File | null = null
  try {
    file = await generateQuizInviteShareCardPng()
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
        await navigator.share({
          title: SHARE_TITLE,
          text,
          url,
          files: [file],
        })
      } else {
        await navigator.share({ title: SHARE_TITLE, text, url })
      }
      return 'shared'
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return 'cancelled'
    }
  }

  try {
    await navigator.clipboard.writeText(text)
  } catch {
    // ignore
  }

  const mailto = `mailto:?subject=${encodeURIComponent(SHARE_TITLE)}&body=${encodeURIComponent(text)}`
  window.open(mailto, '_blank', 'noopener,noreferrer')

  return 'copied'
}
