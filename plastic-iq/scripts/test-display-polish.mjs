#!/usr/bin/env node
import assert from 'node:assert/strict'
import { PUBLISHED_BASELINE_PRODUCT_IDS } from '../src/lib/apr/publishedBaselineIds.ts'
import { loadPublishedDisplaySnapshot } from '../src/lib/apr/publishedBaselineRegistry.ts'
import { loadPublishedBaselineSnapshotImmutable } from '../src/lib/apr/publishedBaselineRegistry.ts'
import { mergePublishedRenderPayload } from '../src/lib/apr/publishedRenderPayload.ts'
import { capitalizeDescriptionSentenceInitials } from '../src/lib/apr/displayTextPolish.ts'

assert.equal(
  capitalizeDescriptionSentenceInitials(
    'Lodge uses cast iron as its food-contact surface. cast iron is not a plastic- or PFAS-based food-contact material.',
  ),
  'Lodge uses cast iron as its food-contact surface. Cast iron is not a plastic- or PFAS-based food-contact material.',
)
assert.equal(
  capitalizeDescriptionSentenceInitials(
    'All-Clad uses stainless steel of unspecified grade as its food-contact surface. stainless steel of unspecified grade is not a plastic- or PFAS-based food-contact material.',
  ),
  'All-Clad uses stainless steel of unspecified grade as its food-contact surface. Stainless steel of unspecified grade is not a plastic- or PFAS-based food-contact material.',
)
console.log('✓ sentence-initial material phrase capitalization')

const lodgeBaseline = loadPublishedBaselineSnapshotImmutable(PUBLISHED_BASELINE_PRODUCT_IDS.lodge)
const lodgeFromBaseline = mergePublishedRenderPayload(lodgeBaseline, [])
assert.match(lodgeFromBaseline.display.product_description, /\. Cast iron is not/)
assert.match(lodgeBaseline.display.product_description, /\. cast iron is not/)
console.log('✓ Lodge baseline render capitalizes second sentence; immutable baseline unchanged')

const allCladBaseline = loadPublishedBaselineSnapshotImmutable(PUBLISHED_BASELINE_PRODUCT_IDS.allClad)
const allCladFromBaseline = mergePublishedRenderPayload(allCladBaseline, [])
assert.match(
  allCladFromBaseline.display.product_description,
  /\. Stainless steel of unspecified grade is not/,
)
console.log('✓ All-Clad baseline render capitalizes second sentence')

const lodgeLatest = mergePublishedRenderPayload(
  loadPublishedDisplaySnapshot(PUBLISHED_BASELINE_PRODUCT_IDS.lodge),
  [],
)
assert.ok(!/\. [a-z]/.test(lodgeLatest.display.product_description))
console.log('✓ Lodge latest-approved description has no lowercase sentence starts')

const tfalSnapshot = loadPublishedDisplaySnapshot(PUBLISHED_BASELINE_PRODUCT_IDS.tfal)
const tfal = mergePublishedRenderPayload(tfalSnapshot, [])
assert.equal(tfal.display.product_description, tfalSnapshot.display.product_description)
assert.ok(tfal.display.product_description.includes('PTFE nonstick coating'))
console.log('✓ T-Fal approved PTFE description unchanged')

const carawaySnapshot = loadPublishedDisplaySnapshot(PUBLISHED_BASELINE_PRODUCT_IDS.caraway)
const caraway = mergePublishedRenderPayload(carawaySnapshot, [])
assert.equal(
  caraway.display.product_description,
  capitalizeDescriptionSentenceInitials(carawaySnapshot.display.product_description),
)
assert.ok(!/confirmed chemical hazard/i.test(caraway.display.product_description))
console.log('✓ Caraway latest-approved description unchanged aside from capitalization pass')

const allCladLatest = mergePublishedRenderPayload(
  loadPublishedDisplaySnapshot(PUBLISHED_BASELINE_PRODUCT_IDS.allClad),
  [],
)
assert.ok(!/\. [a-z]/.test(allCladLatest.display.product_description))

assert.equal(lodgeLatest.score.pac_safety_score, 99)
assert.equal(allCladLatest.score.pac_safety_score, 99)
assert.equal(caraway.score.pac_safety_score, 66)
assert.equal(tfal.score.pac_safety_score, 2)
console.log('✓ scores unchanged')

console.log('\nDisplay polish tests passed.')
