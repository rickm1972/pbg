#!/usr/bin/env node
import { chromium } from 'playwright'
import { PUBLISHED_BASELINE_PRODUCT_IDS } from '../src/lib/apr/publishedBaselineIds.ts'
import { loadPublishedDisplaySnapshot } from '../src/lib/apr/publishedBaselineRegistry.ts'
import { loadBundledLatestApprovedSnapshot } from '../src/lib/apr/durable/bundledDurableRegistry.ts'

const base = process.env.DIAGNOSE_BASE_URL ?? 'http://localhost:5173'

async function main() {
  console.log('=== Node-side snapshot resolution ===')
  for (const [name, id] of [
    ['T-Fal', PUBLISHED_BASELINE_PRODUCT_IDS.tfal],
    ['Caraway', PUBLISHED_BASELINE_PRODUCT_IDS.caraway],
  ]) {
    const bundled = loadBundledLatestApprovedSnapshot(id)
    const latest = loadPublishedDisplaySnapshot(id)
    console.log(`${name} product_id: ${id}`)
    console.log(`  bundled snapshot_id: ${bundled?.meta.snapshot_id ?? 'null'}`)
    console.log(`  loadPublishedDisplaySnapshot id: ${latest?.snapshot_id ?? 'null'}`)
    console.log(`  description starts: ${latest?.display.product_description?.slice(0, 70)}`)
    console.log(`  disclaimer present: ${Boolean(latest?.display.methodology_disclaimer)}`)
  }

  console.log(`\n=== Browser DOM at ${base} ===`)
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  for (const [name, id] of [
    ['T-Fal', PUBLISHED_BASELINE_PRODUCT_IDS.tfal],
    ['Caraway', PUBLISHED_BASELINE_PRODUCT_IDS.caraway],
  ]) {
    const url = `${base}/product/${id}`
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
    const body = await page.locator('body').innerText()
    console.log(`\n${name}`)
    console.log(`  URL: ${url}`)
    console.log(`  contains contradicts marketing: ${body.includes('contradicts')}`)
    console.log(`  contains markets non-toxic: ${body.includes('markets this product as non-toxic')}`)
    console.log(`  contains neutral PTFE copy: ${body.includes('Reviewed product materials identify PTFE')}`)
    console.log(`  contains methodology disclaimer: ${body.includes('plastic-associated-chemical exposure risk')}`)
    console.log(`  contains Reviewed June 8, 2026: ${body.includes('Reviewed June 8, 2026')}`)
    const idx = body.indexOf('T-Fal uses')
    const idx2 = body.indexOf('Reviewed product materials')
    const idx3 = body.indexOf('Caraway uses')
    console.log(`  description area snippet: ${body.slice(Math.max(0, idx2 >= 0 ? idx2 : idx >= 0 ? idx : idx3), (idx2 >= 0 ? idx2 : idx >= 0 ? idx : idx3) + 200)}`)
  }

  await browser.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
