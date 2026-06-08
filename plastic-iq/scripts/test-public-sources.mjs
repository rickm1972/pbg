#!/usr/bin/env node
import assert from 'node:assert/strict'
import { PUBLISHED_BASELINE_PRODUCT_IDS } from '../src/lib/apr/publishedBaselineIds.ts'
import {
  loadPublishedBaselineSnapshotImmutable,
  loadPublishedDisplaySnapshot,
} from '../src/lib/apr/publishedBaselineRegistry.ts'
import { mergePublishedRenderPayload } from '../src/lib/apr/publishedRenderPayload.ts'
import { displaySourcesFingerprint } from '../src/lib/apr/publicDisplaySourceAssembly.ts'
import {
  approveDescriptionOverride,
  resetDescriptionOverrideStateForTests,
  saveDescriptionOverrideDraft,
  submitDescriptionOverrideForReview,
} from '../src/lib/apr/descriptionOverride.ts'
import {
  configureDurableStore,
  resetDurableStoreForTests,
} from '../src/lib/apr/durable/durableSnapshotWriter.node.ts'
import {
  FIXTURE_DESC_OVERRIDE_HIGH_SCORE_PRODUCT_ID,
  buildHighScoreDescriptionOverrideFixtureSnapshot,
} from '../src/lib/apr/fixtures/descriptionOverride.fixture.ts'
import {
  registerTestPublishedSnapshot,
  resetPublishedSnapshotOverlayForTests,
} from '../src/lib/apr/publishedBaselineRegistry.ts'
import { mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const products = [
  { name: 'Lodge', id: PUBLISHED_BASELINE_PRODUCT_IDS.lodge, minSources: 2 },
  { name: 'All-Clad', id: PUBLISHED_BASELINE_PRODUCT_IDS.allClad, minSources: 2 },
  { name: 'Caraway', id: PUBLISHED_BASELINE_PRODUCT_IDS.caraway, minSources: 3 },
  { name: 'T-Fal', id: PUBLISHED_BASELINE_PRODUCT_IDS.tfal, minSources: 4 },
]

for (const p of products) {
  const snapshot = loadPublishedDisplaySnapshot(p.id)
  assert.ok(snapshot, `${p.name} snapshot`)
  const eligible = snapshot.display.sources.filter((s) => s.public_source_eligible !== false)
  assert.ok(eligible.length >= p.minSources, `${p.name} expected >= ${p.minSources} sources, got ${eligible.length}`)
  const render = mergePublishedRenderPayload(snapshot, [])
  assert.equal(
    render.display.sources.filter((s) => s.public_source_eligible !== false).length,
    eligible.length,
    `${p.name} render must include all snapshot sources`,
  )
  console.log(`✓ ${p.name}: latest-approved snapshot has ${eligible.length} public-eligible sources`)
}

const durableRoot = mkdtempSync(join(tmpdir(), 'pbg-override-sources-'))
configureDurableStore({ rootDir: durableRoot })
resetDescriptionOverrideStateForTests()
resetPublishedSnapshotOverlayForTests()
resetDurableStoreForTests()
const fixtureSnap = buildHighScoreDescriptionOverrideFixtureSnapshot()
registerTestPublishedSnapshot(fixtureSnap)
const fixtureBefore = loadPublishedDisplaySnapshot(FIXTURE_DESC_OVERRIDE_HIGH_SCORE_PRODUCT_ID)
assert.ok(fixtureBefore)
const beforeSources = displaySourcesFingerprint(fixtureBefore.display.sources)
const draft = saveDescriptionOverrideDraft({
  product_id: FIXTURE_DESC_OVERRIDE_HIGH_SCORE_PRODUCT_ID,
  proposed_override_text: 'Updated description for source preservation test.',
  created_by: 'test',
})
submitDescriptionOverrideForReview(draft.override_id)
const { new_snapshot } = approveDescriptionOverride(draft.override_id, { reviewer_id: 'test' })
assert.equal(
  displaySourcesFingerprint(new_snapshot.display.sources),
  beforeSources,
  'description override must preserve display.sources',
)
console.log('✓ description override preserves display.sources unchanged')

const lodgeBaseline = loadPublishedBaselineSnapshotImmutable(PUBLISHED_BASELINE_PRODUCT_IDS.lodge)
assert.ok(lodgeBaseline)
assert.equal(lodgeBaseline.display.sources.length, 1, 'baseline lodge still has 1 source (immutable)')
console.log('✓ baseline JSON snapshots remain immutable')

console.log('\nPublic sources tests passed.')
