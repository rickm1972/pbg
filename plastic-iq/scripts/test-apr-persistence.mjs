#!/usr/bin/env node
/**
 * APR hash chain + snapshot persistence tests (Phase 1).
 * Run: node scripts/test-apr-persistence.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { contentHash, stableJsonStringify } from '../src/lib/apr/contentHash.ts'
import {
  assertSnapshotIntegrity,
  createGateSnapshot,
  gatesStaleAfterUpstreamChange,
  validateAprHashChain,
} from '../src/lib/apr/snapshot.ts'
import { buildTwelveInchSkilletFixtureApr } from '../src/lib/apr/fixtures/twelveInchSkillet.fixture.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

// Content hash is stable for same payload
const payload = { a: 1, b: { c: 2 } }
const h1 = contentHash(payload)
const h2 = contentHash({ b: { c: 2 }, a: 1 })
assert.equal(h1, h2)
console.log('✓ content hash is order-independent')

// Key order in JSON.stringify does not affect hash
assert.equal(stableJsonStringify({ z: 1, a: 2 }), stableJsonStringify({ a: 2, z: 1 }))
console.log('✓ canonical JSON serialization')

// Snapshot integrity detects content_hash mismatch when payload differs
const snapA = createGateSnapshot({
  snapshot_id: 'test-snap-a',
  product_id: 'prod-1',
  gate: 'evidence',
  approved_at: '2026-06-01T00:00:00Z',
  payload: { foo: 'bar' },
})
assert.equal(assertSnapshotIntegrity(snapA).valid, true)
const snapB = { ...snapA, payload: { foo: 'mutated' } }
assert.equal(assertSnapshotIntegrity(snapB).valid, false)
console.log('✓ snapshot integrity detects payload drift')

// Fixture APR hash chain validates
const apr = buildTwelveInchSkilletFixtureApr()
const chain = validateAprHashChain(apr)
assert.equal(chain.valid, true, chain.errors.join('\n'))
console.log('✓ fixture APR hash chain valid')

// Stale downstream when evidence hash changes
const stale = gatesStaleAfterUpstreamChange(apr, {
  evidence: {
    ...apr.evidence,
    content_hash: 'deadbeef',
  },
})
assert.ok(stale.includes('normalization'))
assert.ok(stale.includes('qa'))
console.log('✓ upstream hash change marks downstream gates stale')

// DB migration file exists with required tables
const migration = readFileSync(join(root, 'supabase/migrations/0037_apr_snapshots.sql'), 'utf8')
assert.ok(migration.includes('apr_gate_snapshots'))
assert.ok(migration.includes('approved_product_records'))
assert.ok(migration.includes('content_hash'))
assert.ok(migration.includes("gate in ('evidence', 'normalization', 'display', 'score', 'qa')"))
console.log('✓ APR persistence migration defines snapshot tables')

const migration038 = readFileSync(join(root, 'supabase/migrations/0038_published_display_commerce.sql'), 'utf8')
assert.ok(migration038.includes('published_display_snapshots'))
assert.ok(migration038.includes('product_commerce_links'))
console.log('✓ Phase 0.25 published display + commerce migration defined')

console.log('\nAll APR persistence tests passed')
