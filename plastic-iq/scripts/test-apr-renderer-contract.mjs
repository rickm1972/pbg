#!/usr/bin/env node
/**
 * Phase 2 — public renderer reads display.* strings verbatim from fixture APR.
 * Run: npx tsx scripts/test-apr-renderer-contract.mjs
 */
import assert from 'node:assert/strict'
import { buildTwelveInchSkilletFixtureApr } from '../src/lib/apr/fixtures/twelveInchSkillet.fixture.ts'

const apr = buildTwelveInchSkilletFixtureApr()
const { display, score } = { display: apr.display.payload, score: apr.score.payload }

// Score values verbatim
assert.equal(score.pac_safety_score, 99)
assert.equal(score.tier, 'Excellent')
assert.equal(score.transparency_badge, 'Documentation Incomplete')

// Display strings are pre-authored — renderer must not invent alternatives
assert.ok(display.product_title.includes('12 inch'))
assert.ok(!display.product_description.includes('stainless_steel_unspecified'))
assert.ok(display.buy_cta[0].label.includes('Williams Sonoma'))

const publicSources = display.sources.filter((s) => s.public_source_eligible)
assert.ok(!publicSources.some((s) => s.url.includes('12-5-inch')))
assert.ok(publicSources.some((s) => s.source_role === 'retailer_primary'))

assert.ok(display.why_this_score.sections.length > 0)
assert.ok(display.badge_summary.includes('Documentation Incomplete'))
assert.ok(display.risk_bars.length === 0 || display.risk_bars.every((b) => b.status_label.length > 0))

console.log('✓ fixture APR provides complete display + score for renderer')
console.log('\nAPR renderer contract tests passed')
