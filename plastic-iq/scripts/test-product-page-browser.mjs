#!/usr/bin/env node
/**
 * Browser smoke test — ProductPage on real /product/:id routes.
 *
 * Default: spawns a fresh Vite server on a free port (latest bundle).
 * Set DEV_SERVER_URL=http://localhost:5173 to test an already-running dev server instead.
 *
 * Run: npm run test:product-page-browser
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { PUBLISHED_BASELINE_PRODUCT_IDS } from '../src/lib/apr/publishedBaselineIds.ts'
import { loadPublishedDisplaySnapshot } from '../src/lib/apr/publishedBaselineRegistry.ts'
import { STANDARD_METHODOLOGY_DISCLAIMER } from '../src/lib/apr/lowScoreRemediationConstants.ts'
import { GLOBAL_METHODOLOGY_DISCLAIMER } from '../src/lib/apr/publicReviewStamp.ts'

function assertBundledGeneratedFile() {
  const durableDir = join(process.cwd(), 'src/lib/apr/durable-approved')
  const tfalBundled = readFileSync(join(durableDir, 't-fal-approved.json'), 'utf8')
  const carawayBundled = readFileSync(join(durableDir, 'caraway-approved.json'), 'utf8')
  assert.ok(
    tfalBundled.includes("This pan's cooking surface is PTFE nonstick coating"),
    'bundled t-fal-approved.json missing approved PTFE description copy',
  )
  assert.ok(
    tfalBundled.includes(STANDARD_METHODOLOGY_DISCLAIMER) &&
      carawayBundled.includes(STANDARD_METHODOLOGY_DISCLAIMER),
    'bundled durable snapshots missing standard methodology disclaimer',
  )
  assert.ok(
    !tfalBundled.includes('contradicts that marketing claim'),
    'bundled T-Fal snapshot still contains banned marketing language',
  )
  console.log('✓ bundled durable-approved JSON contains remediated T-Fal + Caraway copy')
}

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address()
      server.close(() => resolve(typeof addr === 'object' && addr ? addr.port : 5173))
    })
    server.on('error', reject)
  })
}

async function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url)
      if (res.ok || res.status === 404) return
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`Server not ready: ${url}`)
}

assertBundledGeneratedFile()

const useExisting = process.env.DEV_SERVER_URL?.trim()
let base = useExisting?.replace(/\/$/, '') ?? null
let vite = null

if (!base) {
  const port = await freePort()
  base = `http://127.0.0.1:${port}`
  vite = spawn('npx', ['vite', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, BROWSER: 'none' },
  })
  let viteLog = ''
  vite.stdout.on('data', (d) => {
    viteLog += d.toString()
  })
  vite.stderr.on('data', (d) => {
    viteLog += d.toString()
  })
  vite.on('exit', () => {
    vite._log = viteLog
  })
  console.log(`Spawning fresh Vite for browser smoke at ${base}`)
} else {
  console.log(`Using existing dev server at ${base}`)
  try {
    await waitForServer(base, 5000)
  } catch {
    throw new Error(
      `DEV_SERVER_URL=${base} is not reachable. Start npm run dev or unset DEV_SERVER_URL.`,
    )
  }
}

try {
  if (!useExisting) await waitForServer(base)

  const { chromium } = await import('playwright')
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  const tfalApprovedDescription = loadPublishedDisplaySnapshot(
    PUBLISHED_BASELINE_PRODUCT_IDS.tfal,
  ).display.product_description

  const products = [
    {
      id: PUBLISHED_BASELINE_PRODUCT_IDS.tfal,
      name: 'T-Fal',
      mustContain: [
        tfalApprovedDescription,
        GLOBAL_METHODOLOGY_DISCLAIMER,
        'Reviewed June 8, 2026',
        'Minnesota Pollution Control Agency — 2025 PFAS prohibitions',
        'T-Fal — PFOA information',
      ],
      mustNotContain: [
        'contradicts marketing',
        'markets this product as non-toxic',
        'https://www.pca.state.mn.us/air-water-land-climate/2025-pfas-prohibitions',
        'https://www.t-fal.ca/en/pfoas/',
      ],
      score: '2',
      minSources: 4,
    },
    {
      id: PUBLISHED_BASELINE_PRODUCT_IDS.caraway,
      name: 'Caraway',
      mustContain: [GLOBAL_METHODOLOGY_DISCLAIMER, 'Reviewed June 8, 2026'],
      mustNotContain: ['confirmed chemical hazard'],
      score: '66',
      minSources: 3,
    },
    {
      id: PUBLISHED_BASELINE_PRODUCT_IDS.lodge,
      name: 'Lodge',
      mustContain: [GLOBAL_METHODOLOGY_DISCLAIMER],
      mustNotContain: [],
      score: '99',
      minSources: 2,
      noLowercaseSentenceStarts: true,
    },
    {
      id: PUBLISHED_BASELINE_PRODUCT_IDS.allClad,
      name: 'All-Clad',
      mustContain: [GLOBAL_METHODOLOGY_DISCLAIMER],
      mustNotContain: [],
      score: '99',
      minSources: 2,
      noLowercaseSentenceStarts: true,
    },
  ]

  for (const product of products) {
    const url = `${base}/product/${product.id}`
    const expectedSnapshot = loadPublishedDisplaySnapshot(product.id)
    console.log(`\n${product.name}`)
    console.log(`  URL tested: ${url}`)
    console.log(`  product_id: ${product.id}`)
    console.log(`  expected snapshot_id: ${expectedSnapshot?.snapshot_id ?? 'null'}`)

    await page.goto(url, { waitUntil: 'networkidle' })
    const body = await page.locator('body').innerText()

    for (const text of product.mustContain) {
      assert.ok(body.includes(text), `${product.name} missing: ${text.slice(0, 60)}`)
    }
    for (const text of product.mustNotContain) {
      assert.ok(!body.includes(text), `${product.name} still contains banned text: ${text}`)
    }
    if (product.noLowercaseSentenceStarts) {
      const descMatch = body.match(
        /(?:Lodge's|All-Clad's)[\s\S]{0,800}/,
      )
      if (descMatch) {
        assert.ok(
          !/\. [a-z]/.test(descMatch[0]),
          `${product.name} description has lowercase sentence start after period`,
        )
      }
    }
    if (product.score) {
      assert.ok(body.includes(product.score), `${product.name} score ${product.score} not visible`)
    }

    const disclaimerVisible = body.includes(GLOBAL_METHODOLOGY_DISCLAIMER)
    assert.ok(disclaimerVisible, `${product.name} methodology disclaimer not visible`)
    const reviewedMatch = body.match(/Reviewed [A-Za-z]+ \d{1,2}, \d{4}/)
    console.log(`  disclaimer visible: ${disclaimerVisible ? 'yes' : 'no'}`)
    console.log(`  reviewed date: ${reviewedMatch?.[0] ?? '(none)'}`)
    console.log(`  score visible: ${product.score ?? 'n/a'}`)

    const sourceLinks = page.locator('section[aria-labelledby="product-sources-heading"] a[href]')
    const sourceCount = await sourceLinks.count()
    assert.ok(
      sourceCount >= product.minSources,
      `${product.name} expected >= ${product.minSources} sources, got ${sourceCount}`,
    )
    const groupHeadings = await page
      .locator('section[aria-labelledby="product-sources-heading"] h3')
      .allTextContents()
    const labels = await sourceLinks.allTextContents()
    for (const label of labels) {
      const trimmed = label.trim()
      assert.ok(
        !/^https?:\/\//i.test(trimmed),
        `${product.name} raw URL source label rendered: ${trimmed}`,
      )
    }
    console.log(`  source count rendered: ${sourceCount}`)
    console.log(`  source groups: ${groupHeadings.join(', ') || '(none)'}`)
    console.log(`  source labels: ${labels.map((l) => l.trim()).join(' | ')}`)
    console.log(`  ✓ browser render OK`)
  }

  await browser.close()
  console.log('\nProduct page browser smoke tests passed.')
} catch (err) {
  if (vite?._log) console.error(vite._log)
  throw err
} finally {
  vite?.kill('SIGTERM')
}
