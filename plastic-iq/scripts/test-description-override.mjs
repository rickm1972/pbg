#!/usr/bin/env node
/**
 * Part C — description override via versioned snapshot workflow.
 * Run: npm run test:description-override
 */
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { configureDurableStore } from '../src/lib/apr/durable/durableSnapshotWriter.node.ts'
import { resetDurableStoreForTests } from '../src/lib/apr/durable/durableSnapshotWriter.node.ts'
import {
  approveDescriptionOverride,
  getDescriptionOverrideState,
  getPublicProductDescriptionFromSnapshot,
  publicDescriptionUsesSnapshotOnly,
  rejectDescriptionOverride,
  resetDescriptionOverrideStateForTests,
  saveDescriptionOverrideDraft,
  submitDescriptionOverrideForReview,
  validateDescriptionOverride,
} from '../src/lib/apr/descriptionOverride.ts'
import {
  hashPublishedDisplaySnapshot,
  assertPublishedSnapshotIntegrity,
} from '../src/lib/apr/publishedDisplaySnapshot.ts'
import {
  loadPublishedBaselineSnapshotImmutable,
  loadPublishedDisplaySnapshot,
  registerTestPublishedSnapshot,
  resetPublishedSnapshotOverlayForTests,
} from '../src/lib/apr/publishedBaselineRegistry.ts'
import { mergePublishedRenderPayload } from '../src/lib/apr/publishedRenderPayload.ts'
import { frozenDisplayFingerprint } from '../src/lib/apr/publishedRenderPayload.ts'
import {
  validateDescriptionOverrideLanguage,
  NEGATIVE_SCORE_PUBLICATION_GATE,
} from '../src/lib/apr/negativeScoreGate.ts'
import { buildApprovedLowScoreReview } from '../src/lib/apr/fixtures/lowScoreReview.ts'
import {
  FIXTURE_DESC_OVERRIDE_HIGH_SCORE_PRODUCT_ID,
  FIXTURE_DESC_OVERRIDE_PTFE_PRODUCT_ID,
  FIXTURE_DESC_OVERRIDE_UNCERTAINTY_PRODUCT_ID,
  PTFE_SAFE_OVERRIDE_TEXT,
  PTFE_UNSAFE_OVERRIDE_TEXT,
  UNCERTAINTY_SAFE_OVERRIDE_TEXT,
  UNCERTAINTY_UNSAFE_OVERRIDE_TEXT,
  buildHighScoreDescriptionOverrideFixtureSnapshot,
  buildPtfeDescriptionOverrideFixtureSnapshot,
  buildUncertaintyDescriptionOverrideFixtureSnapshot,
} from '../src/lib/apr/fixtures/descriptionOverride.fixture.ts'

configureDurableStore({ rootDir: mkdtempSync(join(tmpdir(), 'pbg-desc-override-')) })

function resetAll() {
  resetDescriptionOverrideStateForTests()
  resetPublishedSnapshotOverlayForTests()
  resetDurableStoreForTests()
}

// --- Default behavior ---
{
  resetAll()
  const snap = buildPtfeDescriptionOverrideFixtureSnapshot()
  registerTestPublishedSnapshot(snap)
  const baselineDesc = snap.display.product_description
  const legacyListing = 'Totally different legacy listing blurb'

  assert.equal(getPublicProductDescriptionFromSnapshot(FIXTURE_DESC_OVERRIDE_PTFE_PRODUCT_ID), baselineDesc)
  assert.ok(publicDescriptionUsesSnapshotOnly(FIXTURE_DESC_OVERRIDE_PTFE_PRODUCT_ID, legacyListing))

  const render = mergePublishedRenderPayload(
    loadPublishedDisplaySnapshot(FIXTURE_DESC_OVERRIDE_PTFE_PRODUCT_ID),
    [],
  )
  assert.equal(render.display.product_description, baselineDesc)
  assert.notEqual(render.display.product_description, legacyListing)
}
console.log('✓ default: no override → snapshot description; products.description not used')

// --- Draft / pending / rejected do not affect public page ---
{
  resetAll()
  const snap = buildPtfeDescriptionOverrideFixtureSnapshot()
  registerTestPublishedSnapshot(snap)
  const baselineDesc = snap.display.product_description

  const draft = saveDescriptionOverrideDraft({
    product_id: FIXTURE_DESC_OVERRIDE_PTFE_PRODUCT_ID,
    proposed_override_text: PTFE_SAFE_OVERRIDE_TEXT,
  })
  assert.equal(draft.status, 'draft')
  assert.equal(getPublicProductDescriptionFromSnapshot(FIXTURE_DESC_OVERRIDE_PTFE_PRODUCT_ID), baselineDesc)

  const pending = submitDescriptionOverrideForReview(draft.override_id)
  assert.equal(pending.status, 'pending_review')
  assert.equal(getPublicProductDescriptionFromSnapshot(FIXTURE_DESC_OVERRIDE_PTFE_PRODUCT_ID), baselineDesc)

  const rejected = rejectDescriptionOverride(pending.override_id, 'test-reviewer', 'nope')
  assert.equal(rejected.status, 'rejected')
  assert.equal(getPublicProductDescriptionFromSnapshot(FIXTURE_DESC_OVERRIDE_PTFE_PRODUCT_ID), baselineDesc)
}
console.log('✓ draft/pending/rejected overrides do not affect public page')

// --- Approval creates new snapshot version; baseline immutable ---
{
  resetAll()
  const snap = buildPtfeDescriptionOverrideFixtureSnapshot()
  registerTestPublishedSnapshot(snap)
  const baselineHash = hashPublishedDisplaySnapshot(snap)
  const baselineId = snap.snapshot_id

  const draft = saveDescriptionOverrideDraft({
    product_id: FIXTURE_DESC_OVERRIDE_PTFE_PRODUCT_ID,
    proposed_override_text: PTFE_SAFE_OVERRIDE_TEXT,
  })
  submitDescriptionOverrideForReview(draft.override_id)

  const review = buildApprovedLowScoreReview({
    score: snap.score.pac_safety_score,
    primary_score_driving_concern: 'PTFE nonstick coating',
  })

  const { previous_snapshot, new_snapshot, override } = approveDescriptionOverride(draft.override_id, {
    reviewer_id: 'test-reviewer',
    low_score_publication_review: review,
  })

  assert.equal(previous_snapshot.snapshot_id, baselineId)
  assert.notEqual(new_snapshot.snapshot_id, baselineId)
  assert.equal(new_snapshot.display.product_description, PTFE_SAFE_OVERRIDE_TEXT)
  assert.equal(override.resulting_snapshot_id, new_snapshot.snapshot_id)

  const immutable = loadPublishedBaselineSnapshotImmutable(FIXTURE_DESC_OVERRIDE_PTFE_PRODUCT_ID)
  assert.equal(hashPublishedDisplaySnapshot(immutable), baselineHash)
  assert.equal(immutable.display.product_description, snap.display.product_description)

  const publicDesc = getPublicProductDescriptionFromSnapshot(FIXTURE_DESC_OVERRIDE_PTFE_PRODUCT_ID)
  assert.equal(publicDesc, PTFE_SAFE_OVERRIDE_TEXT)

  const render = mergePublishedRenderPayload(loadPublishedDisplaySnapshot(FIXTURE_DESC_OVERRIDE_PTFE_PRODUCT_ID), [])
  assert.equal(render.display.product_description, PTFE_SAFE_OVERRIDE_TEXT)
  assert.equal(
    frozenDisplayFingerprint(render),
    frozenDisplayFingerprint({
      display: { ...render.display, buy_cta: [] },
      score: render.score,
    }),
  )
}
console.log('✓ approved override creates new snapshot; old baseline immutable; public reads new snapshot')

// --- No live render merge ---
{
  resetAll()
  const snap = buildHighScoreDescriptionOverrideFixtureSnapshot()
  registerTestPublishedSnapshot(snap)
  const draft = saveDescriptionOverrideDraft({
    product_id: FIXTURE_DESC_OVERRIDE_HIGH_SCORE_PRODUCT_ID,
    proposed_override_text: 'High-score neutral public wording for testing.',
  })
  assert.equal(getPublicProductDescriptionFromSnapshot(FIXTURE_DESC_OVERRIDE_HIGH_SCORE_PRODUCT_ID), snap.display.product_description)
  void draft
}
console.log('✓ no live merge at render time for draft override')

// --- Phase 4.5 language gate: PTFE fixtures ---
{
  resetAll()
  const snap = buildPtfeDescriptionOverrideFixtureSnapshot()
  registerTestPublishedSnapshot(snap)
  const review = buildApprovedLowScoreReview({
    score: snap.score.pac_safety_score,
    primary_score_driving_concern: 'PTFE nonstick coating',
  })

  const safe = validateDescriptionOverride(snap, PTFE_SAFE_OVERRIDE_TEXT, {
    reviewer_id: 'test',
    low_score_publication_review: review,
  })
  assert.equal(safe.language_ok, true, safe.failures.map((f) => f.message).join('; '))

  for (const unsafeText of [
    PTFE_UNSAFE_OVERRIDE_TEXT,
    'This product is toxic and should be avoided.',
    'This product is unsafe for daily cooking.',
    'Brand lied about the coating materials.',
  ]) {
    const lang = validateDescriptionOverrideLanguage(unsafeText)
    assert.equal(lang.ok, false, `expected language fail: ${unsafeText}`)
  }

  const unsafeValidation = validateDescriptionOverride(snap, PTFE_UNSAFE_OVERRIDE_TEXT, {
    reviewer_id: 'test',
    low_score_publication_review: review,
  })
  assert.equal(unsafeValidation.language_ok, false)

  assert.throws(
    () =>
      approveDescriptionOverride(
        saveDescriptionOverrideDraft({
          product_id: FIXTURE_DESC_OVERRIDE_PTFE_PRODUCT_ID,
          proposed_override_text: PTFE_UNSAFE_OVERRIDE_TEXT,
        }).override_id,
        { reviewer_id: 'test', low_score_publication_review: review },
      ),
    /failed validation|Phase 4.5/,
  )
}
console.log('✓ PTFE fixtures: safe passes; toxic/unsafe/marketing/deception blocked')

// --- Caraway uncertainty fixtures ---
{
  resetAll()
  const snap = buildUncertaintyDescriptionOverrideFixtureSnapshot()
  registerTestPublishedSnapshot(snap)
  const review = buildApprovedLowScoreReview({
    score: snap.score.pac_safety_score,
    primary_score_driving_concern: 'Incomplete disclosure',
  })

  const safe = validateDescriptionOverride(snap, UNCERTAINTY_SAFE_OVERRIDE_TEXT, {
    reviewer_id: 'test',
    low_score_publication_review: review,
  })
  assert.equal(safe.language_ok, true, safe.failures.map((f) => f.message).join('; '))

  const unsafe = validateDescriptionOverride(snap, UNCERTAINTY_UNSAFE_OVERRIDE_TEXT, {
    reviewer_id: 'test',
    low_score_publication_review: review,
  })
  assert.equal(unsafe.language_ok, false)
}
console.log('✓ uncertainty fixtures: safe passes; confirmed-hazard blocked')

// --- Low-score human approval cannot be bypassed ---
{
  resetAll()
  const snap = buildPtfeDescriptionOverrideFixtureSnapshot()
  registerTestPublishedSnapshot(snap)
  const draft = saveDescriptionOverrideDraft({
    product_id: FIXTURE_DESC_OVERRIDE_PTFE_PRODUCT_ID,
    proposed_override_text: PTFE_SAFE_OVERRIDE_TEXT,
  })

  assert.throws(
    () =>
      approveDescriptionOverride(draft.override_id, {
        reviewer_id: 'test',
        low_score_publication_review: null,
      }),
    /Phase 4.5|review|validation/i,
  )
}
console.log('✓ score < 75 cannot bypass low-score human approval on approve')

// --- Score >= 75: negative gate does not apply ---
{
  resetAll()
  const snap = buildHighScoreDescriptionOverrideFixtureSnapshot()
  registerTestPublishedSnapshot(snap)
  const validation = validateDescriptionOverride(snap, 'Neutral high-score public description.', {
    reviewer_id: 'test',
    low_score_publication_review: null,
  })
  assert.equal(validation.negative_score_gate?.applies, false)
  assert.equal(snap.score.pac_safety_score >= NEGATIVE_SCORE_PUBLICATION_GATE.threshold, true)

  const draft = saveDescriptionOverrideDraft({
    product_id: FIXTURE_DESC_OVERRIDE_HIGH_SCORE_PRODUCT_ID,
    proposed_override_text: 'Approved high-score neutral public description.',
  })
  const { new_snapshot } = approveDescriptionOverride(draft.override_id, {
    reviewer_id: 'test',
    low_score_publication_review: null,
  })
  assert.equal(new_snapshot.display.product_description, 'Approved high-score neutral public description.')
}
console.log('✓ score >= 75: negative-score gate applies:false; approval without low-score review')

// --- Snapshot integrity ---
{
  resetAll()
  const snap = buildPtfeDescriptionOverrideFixtureSnapshot()
  registerTestPublishedSnapshot(snap)
  const before = hashPublishedDisplaySnapshot(snap)
  const draft = saveDescriptionOverrideDraft({
    product_id: FIXTURE_DESC_OVERRIDE_PTFE_PRODUCT_ID,
    proposed_override_text: PTFE_SAFE_OVERRIDE_TEXT,
  })
  const { new_snapshot } = approveDescriptionOverride(draft.override_id, {
    reviewer_id: 'test',
    low_score_publication_review: buildApprovedLowScoreReview({
      score: snap.score.pac_safety_score,
      primary_score_driving_concern: 'PTFE',
    }),
  })
  assert.equal(hashPublishedDisplaySnapshot(snap), before)
  assert.equal(assertPublishedSnapshotIntegrity(snap).valid, true)
  assert.equal(assertPublishedSnapshotIntegrity(new_snapshot).valid, true)
  assert.notEqual(new_snapshot.content_hash, snap.content_hash)
}
console.log('✓ baseline content hash unchanged; new snapshot has distinct hash')

// --- Admin state shape ---
{
  resetAll()
  const snap = buildPtfeDescriptionOverrideFixtureSnapshot()
  registerTestPublishedSnapshot(snap)
  saveDescriptionOverrideDraft({
    product_id: FIXTURE_DESC_OVERRIDE_PTFE_PRODUCT_ID,
    proposed_override_text: PTFE_SAFE_OVERRIDE_TEXT,
  })
  const state = getDescriptionOverrideState(FIXTURE_DESC_OVERRIDE_PTFE_PRODUCT_ID)
  assert.equal(state.status, 'draft')
  assert.ok(state.current_snapshot_description)
  assert.equal(state.active_override?.field, 'product_description')
}
console.log('✓ admin override state exposes snapshot description and draft metadata')

// Diff-gate resolution uses same latest-approved path
{
  resetAll()
  const snap = buildPtfeDescriptionOverrideFixtureSnapshot()
  registerTestPublishedSnapshot(snap)
  const draft = saveDescriptionOverrideDraft({
    product_id: FIXTURE_DESC_OVERRIDE_PTFE_PRODUCT_ID,
    proposed_override_text: PTFE_SAFE_OVERRIDE_TEXT,
  })
  approveDescriptionOverride(draft.override_id, {
    reviewer_id: 'test',
    low_score_publication_review: buildApprovedLowScoreReview({
      score: snap.score.pac_safety_score,
      primary_score_driving_concern: 'PTFE',
    }),
  })
  const latest = loadPublishedDisplaySnapshot(FIXTURE_DESC_OVERRIDE_PTFE_PRODUCT_ID)
  const immutable = loadPublishedBaselineSnapshotImmutable(FIXTURE_DESC_OVERRIDE_PTFE_PRODUCT_ID)
  assert.notEqual(latest.snapshot_id, immutable.snapshot_id)
  assert.equal(latest.display.product_description, PTFE_SAFE_OVERRIDE_TEXT)
}
console.log('✓ latest-approved resolution returns durable override, not baseline')

// Approved override preserves full display payload (sources, risk bars, WTS)
{
  resetAll()
  const snap = buildPtfeDescriptionOverrideFixtureSnapshot()
  registerTestPublishedSnapshot(snap)
  const baselineSources = snap.display.sources.length
  const baselineRiskBars = snap.display.risk_bars?.length ?? 0
  const draft = saveDescriptionOverrideDraft({
    product_id: FIXTURE_DESC_OVERRIDE_PTFE_PRODUCT_ID,
    proposed_override_text: PTFE_SAFE_OVERRIDE_TEXT,
  })
  const { new_snapshot } = approveDescriptionOverride(draft.override_id, {
    reviewer_id: 'test',
    low_score_publication_review: buildApprovedLowScoreReview({
      score: snap.score.pac_safety_score,
      primary_score_driving_concern: 'PTFE',
    }),
    display_remediation: {
      methodology_disclaimer: 'Test disclaimer for payload preservation.',
      low_score_last_reviewed_at: '2026-06-08',
    },
  })
  assert.equal(new_snapshot.display.sources.length, baselineSources)
  assert.equal(new_snapshot.display.risk_bars?.length ?? 0, baselineRiskBars)
  assert.equal(new_snapshot.display.why_this_score.sections?.length ?? 0, snap.display.why_this_score.sections?.length ?? 0)
  assert.equal(new_snapshot.score.pac_safety_score, snap.score.pac_safety_score)
}
console.log('✓ override preserves sources, risk bars, WTS, and score')

console.log('\nAll description override tests passed.')
