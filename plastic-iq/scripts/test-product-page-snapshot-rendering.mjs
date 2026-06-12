#!/usr/bin/env node
/**
 * Published product pages render from snapshot, not live assembly.
 * Run: npm run test:product-page-snapshot-rendering
 */
import assert from 'node:assert/strict'
import { PUBLISHED_FROZEN_PRODUCT_IDS } from '../src/lib/apr/publishedFrozenProductRegistry.ts'
import { loadPublishedDisplaySnapshot } from '../src/lib/apr/publishedBaselineRegistry.ts'
import { mergePublishedRenderPayload, frozenDisplayFingerprint } from '../src/lib/apr/publishedRenderPayload.ts'
import { assembleAprPublicRenderInput } from '../src/lib/apr/assembleDisplay.ts'
import { createServiceClient, fetchProductById } from './agent1/supabase.mjs'
import { loadApprovedPublishedScoreTruth, loadApprovedAssemblyInputFromDb } from '../src/lib/apr/approvedPublishedTruth.ts'

const sb = createServiceClient()

for (const productId of [
  PUBLISHED_FROZEN_PRODUCT_IDS.hexclad,
  PUBLISHED_FROZEN_PRODUCT_IDS.greenpan,
]) {
  const snap = loadPublishedDisplaySnapshot(productId)
  assert.ok(snap, `snapshot required for ${productId}`)

  const product = await fetchProductById(sb, productId)
  assert.ok(product)
  const approved = await loadApprovedPublishedScoreTruth(sb, productId)
  const assemblyInput = await loadApprovedAssemblyInputFromDb(sb, product, approved)
  const mutated = await assembleAprPublicRenderInput({
    ...assemblyInput,
    productDescription:
      'This pan uses a mutated live-assembly description that must not appear on the published frozen page.',
  })
  assert.ok(mutated)

  const frozen = mergePublishedRenderPayload(snap, [])
  assert.ok(!frozen.display.product_description.includes('mutated live-assembly'))
  assert.equal(frozen.score.pac_safety_score, snap.score.pac_safety_score)

  assert.notEqual(frozen.display.product_description, mutated.display.product_description)
}

console.log('✓ published pages use frozen snapshot render path')
