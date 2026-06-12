#!/usr/bin/env node
/**
 * Description override validation — draft vs approval scoping.
 * Run: npm run test:description-override-validation
 */
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { configureDurableStore, resetDurableStoreForTests } from '../src/lib/apr/durable/durableSnapshotWriter.node.ts'
import {
  approveDescriptionOverride,
  resetDescriptionOverrideStateForTests,
  saveDescriptionOverrideDraft,
  submitDescriptionOverrideForReview,
  validateDescriptionOverride,
  validateDescriptionOverrideDraft,
} from '../src/lib/apr/descriptionOverride.ts'
import { loadPublishedDisplaySnapshot } from '../src/lib/apr/publishedBaselineRegistry.ts'
import { PUBLISHED_FROZEN_PRODUCT_IDS } from '../src/lib/apr/publishedFrozenProductRegistry.ts'
import { mergePublishedRenderPayload } from '../src/lib/apr/publishedRenderPayload.ts'
import { resolvePublicMethodologyDisclaimer } from '../src/lib/apr/publicReviewStamp.ts'
import { buildApprovedLowScoreReview } from '../src/lib/apr/fixtures/lowScoreReview.ts'
import { getPublicProductDescriptionFromSnapshot } from '../src/lib/apr/descriptionOverride.ts'

const tmpRoot = mkdtempSync(join(tmpdir(), 'desc-override-val-'))
configureDurableStore({ rootDir: tmpRoot })

const GREENPAN_TEXT =
  'GreenPan uses a ceramic nonstick sol-gel coating as its food-contact surface. Under the PAC Safety Score methodology, disclosure gaps affect the score and transparency badge.'

try {
  const greenpan = loadPublishedDisplaySnapshot(PUBLISHED_FROZEN_PRODUCT_IDS.greenpan)
  assert.ok(greenpan)
  // Snapshot may or may not store disclaimer; page-level fallback always supplies one.
  assert.ok(resolvePublicMethodologyDisclaimer(greenpan.display).length > 20)

  const draftVal = validateDescriptionOverrideDraft(GREENPAN_TEXT)
  assert.equal(draftVal.language_ok, true, draftVal.failures.map((f) => f.message).join('; '))
  assert.ok(
    !draftVal.failures.some((f) => f.path === 'display.methodology_disclaimer'),
    'draft must not require methodology_disclaimer',
  )
  assert.ok(
    !draftVal.failures.some((f) => f.path === 'qa.low_score_publication_review'),
    'draft must not require low-score review',
  )

  resetDescriptionOverrideStateForTests()
  const draft = saveDescriptionOverrideDraft({
    product_id: PUBLISHED_FROZEN_PRODUCT_IDS.greenpan,
    proposed_override_text: GREENPAN_TEXT,
  })
  assert.equal(draft.status, 'draft')
  assert.equal(draft.validation?.failures.length ?? 0, 0)

  const approvalNoReview = validateDescriptionOverride(greenpan, GREENPAN_TEXT)
  assert.ok(
    approvalNoReview.failures.some((f) => f.path === 'qa.low_score_publication_review'),
    'approval without review should require low-score acknowledgment',
  )
  assert.ok(
    !approvalNoReview.failures.some((f) => f.path === 'display.methodology_disclaimer'),
    'approval merged payload should satisfy methodology via page-level fallback',
  )

  const review = buildApprovedLowScoreReview({
    score: greenpan.score.pac_safety_score,
    primary_score_driving_concern: 'Material disclosure uncertainty',
  })
  const approvalOk = validateDescriptionOverride(greenpan, GREENPAN_TEXT, {
    reviewer_id: 'test',
    low_score_publication_review: review,
  })
  assert.equal(approvalOk.language_ok, true, approvalOk.failures.map((f) => f.message).join('; '))
  assert.equal(approvalOk.failures.length, 0)

  submitDescriptionOverrideForReview(draft.override_id)
  const { new_snapshot } = approveDescriptionOverride(draft.override_id, {
    reviewer_id: 'test-reviewer',
    low_score_publication_review: review,
  })
  assert.equal(new_snapshot.score.pac_safety_score, 69)
  assert.equal(new_snapshot.score.tier, 'Caution')
  assert.match(String(new_snapshot.score.transparency_badge ?? ''), /Material Uncertain/i)
  assert.equal(new_snapshot.display.product_description, GREENPAN_TEXT)

  const render = mergePublishedRenderPayload(
    loadPublishedDisplaySnapshot(PUBLISHED_FROZEN_PRODUCT_IDS.greenpan),
    [],
  )
  assert.ok(resolvePublicMethodologyDisclaimer(render.display).length > 20)
  assert.equal(getPublicProductDescriptionFromSnapshot(PUBLISHED_FROZEN_PRODUCT_IDS.greenpan), GREENPAN_TEXT)

  for (const [label, id] of [
    ['Caraway', PUBLISHED_FROZEN_PRODUCT_IDS.caraway],
    ['T-Fal', PUBLISHED_FROZEN_PRODUCT_IDS.tfal],
  ]) {
    const snap = loadPublishedDisplaySnapshot(id)
    assert.ok(snap)
    const text = `Neutral ${label} description under PAC Safety Score methodology for testing override save.`
    const d = validateDescriptionOverrideDraft(text)
    assert.equal(d.language_ok, true, `${label} draft`)
    assert.ok(!d.failures.some((f) => f.path === 'display.methodology_disclaimer'))
    resetDescriptionOverrideStateForTests()
    const saved = saveDescriptionOverrideDraft({ product_id: id, proposed_override_text: text })
    assert.equal(saved.validation?.failures.length ?? 0, 0)
  }

  resetDescriptionOverrideStateForTests()
  const carawayId = PUBLISHED_FROZEN_PRODUCT_IDS.caraway
  const first = saveDescriptionOverrideDraft({
    product_id: carawayId,
    proposed_override_text: 'First Caraway draft text under PAC Safety Score methodology.',
  })
  const secondText =
    'Updated Caraway draft text under PAC Safety Score methodology with revised wording.'
  const second = saveDescriptionOverrideDraft({
    product_id: carawayId,
    proposed_override_text: secondText,
  })
  assert.equal(second.override_id, first.override_id, 're-save should update the same draft row')
  assert.equal(second.proposed_override_text, secondText)

  console.log('✓ description override draft vs approval validation (GreenPan, Caraway, T-Fal)')
} finally {
  resetDurableStoreForTests()
}
