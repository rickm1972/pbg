#!/usr/bin/env node
/**
 * Single-process runner for GreenPan public page QA tests (avoids repeated npx tsx cold starts).
 */
const tests = [
  'test-product-page-sources.mjs',
  'test-product-page-commerce-links.mjs',
  'test-source-grouping.mjs',
  'test-public-source-role-rendering.mjs',
  'test-wrong-variant-commerce-link-filtering.mjs',
  'test-public-retailer-cta.mjs',
  'test-greenpan-public-page.mjs',
]

for (const file of tests) {
  const t0 = Date.now()
  process.stdout.write(`→ ${file} … `)
  await import(new URL(`./${file}`, import.meta.url).href)
  console.log(`ok (${Date.now() - t0}ms)`)
}

console.log('\n✓ all public page QA tests passed (single process)')
