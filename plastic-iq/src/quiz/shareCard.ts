import plasticBegoneLogo from '../assets/plastic-begone-logo-transparent.png'

export type ShareCardParams = {
  score: number
  letterGrade: string
  tierColor: string
  url: string
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`))
    img.src = src
  })
}

export async function generateShareCardPng(params: ShareCardParams): Promise<File> {
  // Mobile-friendly portrait.
  const width = 1080
  const height = 1350
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')

  // Background.
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, width, height)

  // Accent block.
  ctx.fillStyle = params.tierColor
  ctx.fillRect(0, 0, width, 360)

  // Logo (centered on white area).
  const logo = await loadImage(plasticBegoneLogo)
  const logoMaxW = 760
  const logoScale = Math.min(1, logoMaxW / logo.width)
  const logoW = Math.round(logo.width * logoScale)
  const logoH = Math.round(logo.height * logoScale)
  const logoX = Math.round((width - logoW) / 2)
  const logoY = 410
  ctx.drawImage(logo, logoX, logoY, logoW, logoH)

  // Main grade + score.
  ctx.fillStyle = '#FFFFFF'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'

  ctx.font = '800 210px "Source Sans 3", system-ui, -apple-system, sans-serif'
  ctx.fillText(params.letterGrade, width / 2, 250)

  ctx.font = '800 120px "Source Sans 3", system-ui, -apple-system, sans-serif'
  ctx.fillText(String(params.score), width / 2, 330)

  // Tagline.
  ctx.fillStyle = '#0F172A'
  ctx.font = '700 54px "Source Sans 3", system-ui, -apple-system, sans-serif'
  ctx.fillText(`I got a ${params.letterGrade} on my`, width / 2, 780)
  ctx.fillText('kitchen PAC Safety Score.', width / 2, 845)

  ctx.font = '600 44px "Source Sans 3", system-ui, -apple-system, sans-serif'
  ctx.fillStyle = '#334155'
  ctx.fillText("What's yours?", width / 2, 920)

  // URL.
  ctx.fillStyle = '#0F172A'
  ctx.font = '700 46px "Source Sans 3", system-ui, -apple-system, sans-serif'
  ctx.fillText(params.url.replace(/^https?:\/\//, ''), width / 2, 1180)

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Failed to encode PNG'))), 'image/png')
  })

  return new File([blob], 'plasticbegone-kitchen-score.png', { type: 'image/png' })
}

