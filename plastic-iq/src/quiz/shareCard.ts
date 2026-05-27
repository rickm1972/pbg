import plasticBegoneLogo from '../assets/plastic-begone-logo-transparent.png'

export const LINK_PREVIEW_CARD_WIDTH = 1200
export const LINK_PREVIEW_CARD_HEIGHT = 630

const CARD_BG = '#fdfcf9'

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`))
    img.src = src
  })
}

export async function drawInstagramLinkPreviewCard(
  ctx: CanvasRenderingContext2D,
  _shareUrl: string,
  logo: HTMLImageElement,
): Promise<void> {
  const width = LINK_PREVIEW_CARD_WIDTH
  const height = LINK_PREVIEW_CARD_HEIGHT

  ctx.fillStyle = CARD_BG
  ctx.fillRect(0, 0, width, height)

  const logoMaxW = width * 0.92
  const logoMaxH = height * 0.92
  const logoScale = Math.min(logoMaxW / logo.width, logoMaxH / logo.height)
  const logoW = Math.round(logo.width * logoScale)
  const logoH = Math.round(logo.height * logoScale)
  const logoX = Math.round((width - logoW) / 2)
  const logoY = Math.round((height - logoH) / 2)
  ctx.drawImage(logo, logoX, logoY, logoW, logoH)
}

export async function generateQuizInviteShareCardPng(shareUrl: string): Promise<File> {
  const canvas = document.createElement('canvas')
  canvas.width = LINK_PREVIEW_CARD_WIDTH
  canvas.height = LINK_PREVIEW_CARD_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')

  const logo = await loadImage(plasticBegoneLogo)
  await drawInstagramLinkPreviewCard(ctx, shareUrl, logo)

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Failed to encode PNG'))), 'image/png')
  })

  return new File([blob], 'plasticbegone-quiz-invite.png', { type: 'image/png' })
}
