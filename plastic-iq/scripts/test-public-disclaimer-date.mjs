#!/usr/bin/env node
import assert from 'node:assert/strict'
import { PUBLISHED_BASELINE_PRODUCT_IDS } from '../src/lib/apr/publishedBaselineIds.ts'
import { loadPublishedDisplaySnapshot } from '../src/lib/apr/publishedBaselineRegistry.ts'
import { mergePublishedRenderPayload } from '../src/lib/apr/publishedRenderPayload.ts'
import {
  GLOBAL_METHODOLOGY_DISCLAIMER,
  resolvePublicMethodologyDisclaimer,
  resolvePublicReviewDate,
} from '../src/lib/apr/publicReviewStamp.ts'

const products = [
  { name: 'Lodge', id: PUBLISHED_BASELINE_PRODUCT_IDS.lodge },
  { name: 'All-Clad', id: PUBLISHED_BASELINE_PRODUCT_IDS.allClad },
  { name: 'Caraway', id: PUBLISHED_BASELINE_PRODUCT_IDS.caraway },
  { name: 'T-Fal', id: PUBLISHED_BASELINE_PRODUCT_IDS.tfal },
]

for (const p of products) {
  const snapshot = loadPublishedDisplaySnapshot(p.id)
  assert.ok(snapshot, `${p.name} snapshot missing`)
  const render = mergePublishedRenderPayload(snapshot, [])
  const disclaimer = resolvePublicMethodologyDisclaimer(render.display)
  assert.equal(disclaimer, GLOBAL_METHODOLOGY_DISCLAIMER, `${p.name} disclaimer`)
  console.log(`✓ ${p.name}: global methodology disclaimer resolves`)
}

const tfalSnapshot = loadPublishedDisplaySnapshot(PUBLISHED_BASELINE_PRODUCT_IDS.tfal)
const carawaySnapshot = loadPublishedDisplaySnapshot(PUBLISHED_BASELINE_PRODUCT_IDS.caraway)
assert.ok(tfalSnapshot && carawaySnapshot)
const tfalRender = mergePublishedRenderPayload(tfalSnapshot, [])
const carawayRender = mergePublishedRenderPayload(carawaySnapshot, [])

assert.equal(
  resolvePublicReviewDate({
    display: tfalRender.display,
    snapshotPublishedAt: tfalRender.snapshot_meta?.published_at,
  }),
  '2026-06-08',
)
assert.equal(
  resolvePublicReviewDate({
    display: carawayRender.display,
    snapshotPublishedAt: carawayRender.snapshot_meta?.published_at,
  }),
  '2026-06-08',
)
console.log('✓ T-Fal and Caraway: Reviewed June 8, 2026 from low_score_last_reviewed_at')

const lodgeSnapshot = loadPublishedDisplaySnapshot(PUBLISHED_BASELINE_PRODUCT_IDS.lodge)
assert.ok(lodgeSnapshot)
const lodgeRender = mergePublishedRenderPayload(lodgeSnapshot, [])
const lodgeDate = resolvePublicReviewDate({
  display: lodgeRender.display,
  snapshotPublishedAt: lodgeRender.snapshot_meta?.published_at,
})
assert.ok(lodgeDate, 'Lodge should have approved review date')
console.log(`✓ Lodge reviewed date: ${lodgeDate}`)

const allCladSnapshot = loadPublishedDisplaySnapshot(PUBLISHED_BASELINE_PRODUCT_IDS.allClad)
assert.ok(allCladSnapshot)
const allCladRender = mergePublishedRenderPayload(allCladSnapshot, [])
const allCladDate = resolvePublicReviewDate({
  display: allCladRender.display,
  snapshotPublishedAt: allCladRender.snapshot_meta?.published_at,
})
assert.ok(allCladDate, 'All-Clad should have approved review date')
console.log(`✓ All-Clad reviewed date: ${allCladDate}`)

console.log('\nPublic disclaimer/date tests passed.')
