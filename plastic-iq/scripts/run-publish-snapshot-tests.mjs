#!/usr/bin/env node
const tests = [
  'test-publish-auto-snapshot.mjs',
  'test-published-display-snapshot.mjs',
  'test-product-page-snapshot-rendering.mjs',
  'test-snapshot-backfill-hexclad-greenpan.mjs',
  'test-published-page-freeze-invariant.mjs',
  'test-description-override.mjs',
]

for (const file of tests) {
  const t0 = Date.now()
  process.stdout.write(`→ ${file} … `)
  await import(new URL(`./${file}`, import.meta.url).href)
  console.log(`ok (${Date.now() - t0}ms)`)
}
