import { generateQuizInviteShareCardPng } from './shareCard'

const SHARE_TITLE = 'Kitchen PAC Safety Quiz'

const SHARE_MESSAGE_PREFIX =
  'Found this quiz that shows how much plastic is in your kitchen. Took me 2 minutes — worth checking. '

/** Quiz URL for share text and link previews (current deploy origin). */
export function getQuizShareUrl(): string {
  return window.location.origin
}

export function buildQuizShareCaption(): string {
  return `${SHARE_MESSAGE_PREFIX}${getQuizShareUrl()}`
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
