#!/usr/bin/env node
import assert from 'node:assert/strict'
import { PUBLISHED_BASELINE_PRODUCT_IDS } from '../src/lib/apr/publishedBaselineIds.ts'
import { loadPublishedDisplaySnapshot } from '../src/lib/apr/publishedBaselineRegistry.ts'
import { mergePublishedRenderPayload } from '../src/lib/apr/publishedRenderPayload.ts'
import {
  isRawUrlSourceLabel,
  polishDisplaySourceLabel,
} from '../src/lib/apr/publicSourceDisplayLabel.ts'

const TFAL_PCA =
  'https://www.pca.state.mn.us/air-water-land-climate/2025-pfas-prohibitions'
const TFAL_PFOA = 'https://www.t-fal.ca/en/pfoas/'

assert.equal(
  polishDisplaySourceLabel({
    url: TFAL_PCA,
    group: 'Context',
    label: TFAL_PCA,
    public_source_eligible: true,
    source_role: 'context',
    variant_mismatch: false,
    footnote: null,
  }),
  'Minnesota Pollution Control Agency — 2025 PFAS prohibitions',
)
assert.equal(
  polishDisplaySourceLabel({
    url: TFAL_PFOA,
    group: 'Context',
    label: TFAL_PFOA,
    public_source_eligible: true,
    source_role: 'context',
    variant_mismatch: false,
    footnote: null,
  }),
  'T-Fal — PFOA information',
)
console.log('✓ T-Fal context sources use human-readable labels')

assert.equal(
  polishDisplaySourceLabel({
    url: 'https://www.t-fal.com/ultimate-hard-anodized-non-stick-cookware-3-piece-frypan-set.html',
    group: 'Manufacturer',
    label: 'Manufacturer product',
    public_source_eligible: true,
    source_role: 'manufacturer',
    variant_mismatch: false,
    footnote: null,
  }),
  'T-Fal — Ultimate hard anodized non stick cookware 3 piece frypan set',
)
console.log('✓ generic manufacturer label replaced with domain-derived title')

for (const [name, id, minCount] of [
  ['Lodge', PUBLISHED_BASELINE_PRODUCT_IDS.lodge, 2],
  ['All-Clad', PUBLISHED_BASELINE_PRODUCT_IDS.allClad, 2],
  ['Caraway', PUBLISHED_BASELINE_PRODUCT_IDS.caraway, 3],
  ['T-Fal', PUBLISHED_BASELINE_PRODUCT_IDS.tfal, 4],
]) {
  const snapshot = loadPublishedDisplaySnapshot(id)
  assert.ok(snapshot)
  const frozenCount = snapshot.display.sources.filter((s) => s.public_source_eligible !== false).length
  const render = mergePublishedRenderPayload(snapshot, [])
  const renderCount = render.display.sources.filter((s) => s.public_source_eligible !== false).length
  assert.equal(renderCount, frozenCount, `${name} source count preserved`)
  assert.ok(renderCount >= minCount, `${name} expected >= ${minCount} sources`)
  for (const source of render.display.sources) {
    if (!source.public_source_eligible) continue
    assert.ok(!isRawUrlSourceLabel(source.label), `${name} raw URL label: ${source.label}`)
  }
  console.log(
    `✓ ${name}: ${renderCount} sources, labels: ${render.display.sources.map((s) => s.label).join(' | ')}`,
  )
}

const tfalSnapshot = loadPublishedDisplaySnapshot(PUBLISHED_BASELINE_PRODUCT_IDS.tfal)
const tfalRender = mergePublishedRenderPayload(tfalSnapshot, [])
assert.equal(tfalRender.display.product_description, tfalSnapshot.display.product_description)
assert.ok(tfalRender.display.product_description.includes('PTFE nonstick coating'))
console.log('✓ T-Fal approved PTFE description unchanged')

console.log('\nSource label tests passed.')
