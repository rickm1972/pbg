#!/usr/bin/env node
/**
 * Published baseline truth alignment — guards against fixture-poisoned snapshots.
 * Run: npm run test:published-baseline-truth
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServiceClient } from './agent1/supabase.mjs'
import {
  ApprovedTruthMismatchError,
  assertPublishedSnapshotMatchesApprovedTruth,
  assertSnapshotScoreMatchesApprovedTruth,
  loadApprovedPublishedScoreTruth,
  PUBLISHED_BASELINE_SPECS,
} from '../src/lib/apr/approvedPublishedTruth.ts'
import {
  loadPublishedDisplaySnapshot,
  PUBLISHED_BASELINE_PRODUCT_IDS,
} from '../src/lib/apr/publishedBaselineRegistry.ts'
import { mergePublishedRenderPayload } from '../src/lib/apr/publishedRenderPayload.ts'
import { backfillAssemblyInputs } from './lib/regression-assembly-fixtures.mjs'
import { assembleAprPublicRenderInput } from '../src/lib/apr/assembleDisplay.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const sb = createServiceClient()

// --- Bad fixture scores must fail truth guard ---
{
  const lodgeApproved = await loadApprovedPublishedScoreTruth(
    sb,
    PUBLISHED_BASELINE_PRODUCT_IDS.lodge,
  )
  assert.equal(lodgeApproved.pac_safety_score, 99, 'Lodge approved DB score')

  const badLodgeScore = { pac_safety_score: 96, tier: 'Excellent', displayed_confidence_range: '', transparency_badge: 'Fully Disclosed' }
  assert.throws(
    () => assertSnapshotScoreMatchesApprovedTruth(badLodgeScore, lodgeApproved),
    ApprovedTruthMismatchError,
  )
  console.log('✓ Lodge fixture score 96 fails against approved 99')

  const carawayApproved = await loadApprovedPublishedScoreTruth(
    sb,
    PUBLISHED_BASELINE_PRODUCT_IDS.caraway,
  )
  assert.equal(carawayApproved.pac_safety_score, 66, 'Caraway approved DB score')

  const badCarawayScore = { pac_safety_score: 72, tier: 'Caution', displayed_confidence_range: '', transparency_badge: 'Documentation Incomplete' }
  assert.throws(
    () => assertSnapshotScoreMatchesApprovedTruth(badCarawayScore, carawayApproved),
    ApprovedTruthMismatchError,
  )
  console.log('✓ Caraway fixture score 72 fails against approved 66')
}

// --- Corrected baselines match approved truth ---
const expectedScores = {
  lodge: 99,
  caraway: 66,
  'all-clad': 99,
  't-fal': 2,
}

for (const spec of PUBLISHED_BASELINE_SPECS) {
  const snap = loadPublishedDisplaySnapshot(spec.product_id)
  assert.ok(snap, `snapshot for ${spec.slug}`)
  const approved = await loadApprovedPublishedScoreTruth(sb, spec.product_id)
  assertPublishedSnapshotMatchesApprovedTruth(snap, approved)
  assert.equal(
    snap.score.pac_safety_score,
    expectedScores[spec.slug],
    `${spec.slug} snapshot score`,
  )
  console.log(`✓ ${spec.slug} snapshot matches approved score ${snap.score.pac_safety_score}`)
}

// --- Fixture assembly cannot bless wrong published score ---
{
  const lodgeApproved = await loadApprovedPublishedScoreTruth(
    sb,
    PUBLISHED_BASELINE_PRODUCT_IDS.lodge,
  )
  const fixtureInput = backfillAssemblyInputs[PUBLISHED_BASELINE_PRODUCT_IDS.lodge]
  assert.equal(fixtureInput.pageScore.pac_safety_score, 96, 'fixture still has stale 96')
  const fixtureAssembled = await assembleAprPublicRenderInput(fixtureInput)
  assert.ok(fixtureAssembled)
  assert.throws(
    () => assertSnapshotScoreMatchesApprovedTruth(fixtureAssembled.score, lodgeApproved),
    ApprovedTruthMismatchError,
  )
  console.log('✓ canned fixture assembly (96) cannot pass approved truth guard (99)')
}

// --- Product detail path uses frozen snapshot, not fixture assembly ---
{
  const snap = loadPublishedDisplaySnapshot(PUBLISHED_BASELINE_PRODUCT_IDS.lodge)
  assert.ok(snap)
  const frozenRender = mergePublishedRenderPayload(snap, [])
  assert.equal(frozenRender.score.pac_safety_score, 99)
  assert.notEqual(frozenRender.score.pac_safety_score, 96)
  console.log('✓ frozen snapshot render uses snapshot score 99, not fixture 96')
}

// --- Listing vs detail agreement (approved embed vs snapshot) ---
{
  const { data: lodgeRow, error } = await sb
    .from('products')
    .select(
      'product_id, product_scores(pac_safety_score, tier, review_status, run_timestamp)',
    )
    .eq('product_id', PUBLISHED_BASELINE_PRODUCT_IDS.lodge)
    .maybeSingle()
  assert.ifError(error)
  const approvedEmbed = (lodgeRow?.product_scores ?? []).find(
    (s) => s.review_status === 'approved',
  )
  const snap = loadPublishedDisplaySnapshot(PUBLISHED_BASELINE_PRODUCT_IDS.lodge)
  assert.ok(approvedEmbed)
  assert.ok(snap)
  assert.equal(approvedEmbed.pac_safety_score, snap.score.pac_safety_score)
  console.log('✓ Lodge listing approved embed matches detail snapshot score')
}

console.log('\nPublished baseline truth alignment tests passed')
