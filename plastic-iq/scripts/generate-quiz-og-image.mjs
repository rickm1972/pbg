import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const logoPath = join(root, 'src/assets/plastic-begone-logo-transparent.png')
const outPath = join(root, 'public/og-quiz-share.png')

const w = 1200
const h = 630

async function main() {
  const { default: sharp } = await import('sharp')
  const meta = await sharp(logoPath).metadata()
  const logoMaxW = w * 0.92
  const logoMaxH = h * 0.92
  const scale = Math.min(logoMaxW / meta.width, logoMaxH / meta.height)
  const logoW = Math.round(meta.width * scale)
  const logoH = Math.round(meta.height * scale)
  const logoX = Math.round((w - logoW) / 2)
  const logoY = Math.round((h - logoH) / 2)

  const logoPng = await sharp(logoPath).resize(logoW, logoH).png().toBuffer()

  await sharp({
    create: { width: w, height: h, channels: 4, background: '#fdfcf9' },
  })
    .composite([{ input: logoPng, top: logoY, left: logoX }])
    .png()
    .toFile(outPath)

  console.log('Wrote', outPath)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
