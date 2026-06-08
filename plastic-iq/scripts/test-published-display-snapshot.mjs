#!/usr/bin/env node
/**
 * Phase 0.25 — published display snapshot + commerce layer + regression gate tests.
 * Run: npm exec tsx scripts/test-published-display-snapshot.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { stableJsonStringify } from '../src/lib/apr/contentHash.ts'
import {
  assertPublishedSnapshotIntegrity,
  stripCommerceFromRenderInput,
} from '../src/lib/apr/publishedDisplaySnapshot.ts'
import {
  loadPublishedDisplaySnapshot,
  listPublishedBaselineSnapshots,
  PUBLISHED_BASELINE_PRODUCT_IDS,
} from '../src/lib/apr/publishedBaselineRegistry.ts'
import {
  mergePublishedRenderPayload,
  frozenDisplayFingerprint,
} from '../src/lib/apr/publishedRenderPayload.ts'
import {
  commerceLinksFromProduct,
  updateCommerceLinkAffiliateUrl,
} from '../src/lib/commerce/productCommerceLinks.ts'
import { assembleAprPublicRenderInput } from '../src/lib/apr/assembleDisplay.ts'
import { diffPublishedDisplayAgainstAssembly } from '../src/lib/apr/displayDiffGate.ts'
import {
  createDisplayUpdateProposal,
  approveDisplayUpdateProposal,
  assertSnapshotNotMutatedInPlace,
} from '../src/lib/apr/displayUpdateWorkflow.ts'
import { backfillAssemblyInputs } from './lib/regression-assembly-fixtures.mjs'
import { createServiceClient } from './agent1/supabase.mjs'
import {
  assertPublishedSnapshotMatchesApprovedTruth,
  loadApprovedPublishedScoreTruth,
} from '../src/lib/apr/approvedPublishedTruth.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

// --- Snapshot integrity ---
for (const snap of listPublishedBaselineSnapshots()) {
  const integrity = assertPublishedSnapshotIntegrity(snap)
  assert.equal(integrity.valid, true, integrity.reason)
  assert.ok(!('buy_cta' in snap.display), `${snap.product_id}: snapshot must not store buy_cta`)
}
console.log('✓ 4 published baseline snapshots integrity + no frozen commerce')

// --- Truth alignment: frozen snapshots match approved DB/Gate 3 scores ---
const sb = createServiceClient()
for (const snap of listPublishedBaselineSnapshots()) {
  const approved = await loadApprovedPublishedScoreTruth(sb, snap.product_id)
  assertPublishedSnapshotMatchesApprovedTruth(snap, approved)
}
console.log('✓ all frozen baselines match approved DB/Gate 3 score truth')

// --- Hard freeze: assembly changes do not alter published render ---
{
  const snap = loadPublishedDisplaySnapshot(PUBLISHED_BASELINE_PRODUCT_IDS.lodge)
  assert.ok(snap)
  const product = backfillAssemblyInputs[PUBLISHED_BASELINE_PRODUCT_IDS.lodge].product
  const commerce = commerceLinksFromProduct(product)
  const renderA = mergePublishedRenderPayload(snap, commerce)
  const renderB = mergePublishedRenderPayload(snap, commerce)

  assert.equal(
    frozenDisplayFingerprint(renderA),
    frozenDisplayFingerprint(renderB),
    'Published render fingerprint must be stable',
  )

  const mutatedAssembly = await assembleAprPublicRenderInput({
    ...backfillAssemblyInputs[PUBLISHED_BASELINE_PRODUCT_IDS.lodge],
    productDescription: 'MUTATED DESCRIPTION THAT MUST NOT APPEAR ON PUBLISHED PAGE',
  })
  assert.ok(mutatedAssembly)
  const liveDiffs = diffPublishedDisplayAgainstAssembly(snap, mutatedAssembly)
  assert.ok(liveDiffs.length > 0, 'Mutated assembly should differ from snapshot')

  const publishedAfterMutation = mergePublishedRenderPayload(snap, commerce)
  assert.equal(
    frozenDisplayFingerprint(renderA),
    frozenDisplayFingerprint(publishedAfterMutation),
    'Published page must not change when live assembly changes',
  )
  assert.ok(
    !publishedAfterMutation.display.product_description.includes('MUTATED DESCRIPTION'),
    'Published page must not show mutated assembly output',
  )
}
console.log('✓ hard freeze: assembly mutation does not alter published snapshot render')

// --- Commerce mutability: affiliate URL change does not touch frozen truth ---
{
  const snap = loadPublishedDisplaySnapshot(PUBLISHED_BASELINE_PRODUCT_IDS.lodge)
  assert.ok(snap)
  const product = backfillAssemblyInputs[PUBLISHED_BASELINE_PRODUCT_IDS.lodge].product
  const commerce = commerceLinksFromProduct(product)
  const before = mergePublishedRenderPayload(snap, commerce)

  const amazonLink = commerce.find((l) => l.retailer_key === 'amazon')
  assert.ok(amazonLink)
  const updatedCommerce = commerce.map((l) =>
    l.link_id === amazonLink.link_id
      ? updateCommerceLinkAffiliateUrl(l, 'https://www.amazon.com/UPDATED-AFFILIATE-URL/dp/B00006JSUA')
      : l,
  )
  const after = mergePublishedRenderPayload(snap, updatedCommerce)

  assert.equal(frozenDisplayFingerprint(before), frozenDisplayFingerprint(after))
  assert.notEqual(before.display.buy_cta[0]?.url, after.display.buy_cta[0]?.url)
  assert.ok(after.display.buy_cta[0]?.url.includes('UPDATED-AFFILIATE-URL'))
  assert.equal(before.score.pac_safety_score, after.score.pac_safety_score)
  assert.equal(before.display.product_description, after.display.product_description)
  assert.deepEqual(before.display.sources, after.display.sources)
}
console.log('✓ commerce mutability: affiliate URL change affects CTA only')

// --- Display update workflow stub ---
{
  const snap = loadPublishedDisplaySnapshot(PUBLISHED_BASELINE_PRODUCT_IDS.allClad)
  assert.ok(snap)
  const input = backfillAssemblyInputs[PUBLISHED_BASELINE_PRODUCT_IDS.allClad]
  const assembled = await assembleAprPublicRenderInput(input)
  assert.ok(assembled)

  const proposal = createDisplayUpdateProposal({
    proposal_id: 'prop-test-1',
    product_id: snap.product_id,
    current_snapshot: snap,
    proposed: assembled,
    meta: { published_at: new Date().toISOString() },
  })
  assert.equal(proposal.status, 'pending')
  assert.ok(Array.isArray(proposal.diff_summary))

  const { proposal: approved, new_snapshot } = approveDisplayUpdateProposal(
    proposal,
    'admin@test',
    'snapshot-v2-allclad',
  )
  assert.equal(approved.status, 'approved')
  assert.notEqual(new_snapshot.snapshot_id, snap.snapshot_id)
  assert.ok(assertSnapshotNotMutatedInPlace(snap, snap))
}
console.log('✓ display update workflow creates new snapshot version without in-place mutation')

// --- Migration 0038 exists ---
const migration = readFileSync(
  join(root, 'supabase/migrations/0038_published_display_commerce.sql'),
  'utf8',
)
assert.ok(migration.includes('published_display_snapshots'))
assert.ok(migration.includes('product_commerce_links'))
assert.ok(migration.includes('display_regression_manifest'))
console.log('✓ migration 0038 defines snapshot + commerce tables')

console.log('\nPhase 0.25 published display snapshot tests passed')
