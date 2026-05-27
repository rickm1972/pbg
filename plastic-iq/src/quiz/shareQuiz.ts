/** Public URL for the quiz landing page (share / invite). */
export function getQuizShareUrl(): string {
  const { origin, pathname } = window.location
  if (pathname.endsWith('index.quiz.html')) return `${origin}/index.quiz.html`
  return `${origin}/`
}

export function buildQuizShareCaption(score: number, letterGrade: string): string {
  const url = getQuizShareUrl()
  return (
    `Protect the people you love — take the free Kitchen PAC Safety Quiz (about 2 minutes). ` +
    `I scored ${score}/100 (Grade ${letterGrade}). See what's in your kitchen.\n\n${url}`
  )
}

export async function shareQuizInvite(options: {
  score: number
  letterGrade: string
  tierColor: string
  generateImage: (params: {
    score: number
    letterGrade: string
    tierColor: string
    url: string
  }) => Promise<File>
}): Promise<'shared' | 'copied' | 'cancelled'> {
  const url = getQuizShareUrl()
  const text = buildQuizShareCaption(options.score, options.letterGrade)
  const title = 'Kitchen PAC Safety Quiz'

  let file: File | null = null
  try {
    file = await options.generateImage({
      score: options.score,
      letterGrade: options.letterGrade,
      tierColor: options.tierColor,
      url,
    })
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
        await navigator.share({ title, text, url, files: [file] })
      } else {
        await navigator.share({ title, text, url })
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

  const mailto = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(text)}`
  window.open(mailto, '_blank', 'noopener,noreferrer')

  return 'copied'
}
