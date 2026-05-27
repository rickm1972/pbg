import plasticBegoneLogo from '../assets/plastic-begone-logo-transparent.png'

const HEADLINE = 'Do you know how much plastic is leaking into your food?'
const SUBHEAD = 'Take the 2-minute Kitchen PAC Safety Quiz.'

const BRAND = {
  forest: '#0f3d26',
  forestMuted: '#1a5c40',
  ink: '#0B1220',
  paper: '#FFFFFF',
  cream: '#fdfcf9',
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`))
    img.src = src
  })
}

function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = word
    } else {
      line = test
    }
  }
  if (line) lines.push(line)
  return lines
}

function drawCenteredLines(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  centerX: number,
  startY: number,
  lineHeight: number,
) {
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], centerX, startY + i * lineHeight)
  }
}

/** Invite card for sharing the quiz (no score or personal data). */
export async function generateQuizInviteShareCardPng(): Promise<File> {
  const width = 1080
  const height = 1350
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')

  ctx.fillStyle = BRAND.paper
  ctx.fillRect(0, 0, width, height)

  // Soft brand frame
  ctx.fillStyle = BRAND.cream
  ctx.fillRect(0, 0, width, height)
  ctx.strokeStyle = '#dfe6dd'
  ctx.lineWidth = 2
  ctx.strokeRect(48, 48, width - 96, height - 96)

  ctx.fillStyle = BRAND.forest
  ctx.fillRect(48, 48, width - 96, 10)

  const logo = await loadImage(plasticBegoneLogo)
  const logoMaxW = 820
  const logoScale = Math.min(1, logoMaxW / logo.width)
  const logoW = Math.round(logo.width * logoScale)
  const logoH = Math.round(logo.height * logoScale)
  const logoX = Math.round((width - logoW) / 2)
  const logoY = 200
  ctx.drawImage(logo, logoX, logoY, logoW, logoH)

  const textMaxW = width - 160
  const centerX = width / 2
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'

  let y = logoY + logoH + 100

  ctx.fillStyle = BRAND.ink
  ctx.font = '700 52px "Playfair Display", Georgia, serif'
  const headlineLines = wrapTextLines(ctx, HEADLINE, textMaxW)
  drawCenteredLines(ctx, headlineLines, centerX, y, 64)
  y += headlineLines.length * 64 + 36

  ctx.fillStyle = BRAND.forestMuted
  ctx.font = '600 40px "Source Sans 3", system-ui, -apple-system, sans-serif'
  const subheadLines = wrapTextLines(ctx, SUBHEAD, textMaxW)
  drawCenteredLines(ctx, subheadLines, centerX, y, 52)

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Failed to encode PNG'))), 'image/png')
  })

  return new File([blob], 'plasticbegone-quiz-invite.png', { type: 'image/png' })
}
