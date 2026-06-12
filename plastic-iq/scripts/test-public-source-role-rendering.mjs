#!/usr/bin/env node
/**
 * Public source role labels — context vs manufacturer confirmation.
 * Run: npm run test:public-source-role-rendering
 */
import assert from 'node:assert/strict'
import { buildPublicSourcesFromEvidence } from '../src/lib/publicSourceDisplay.ts'
import { buildPublicDisplayContract } from '../src/lib/publicProductDisplayContract.ts'
import {
  buildGreenPanMisclassifiedSourcesEvidence,
  GREENPAN_PUBLIC_PRODUCT,
} from '../src/lib/fixtures/greenpanPublicPageSources.fixture.ts'
import { buildGate1SourcesReview } from '../src/lib/gate1SourcesReview.ts'

const evidence = buildGreenPanMisclassifiedSourcesEvidence()
const contract = buildPublicDisplayContract(GREENPAN_PUBLIC_PRODUCT, evidence)
const sources = buildPublicSourcesFromEvidence(evidence, contract)

const consumerReports = sources.find((s) => s.url.includes('consumerreports.org'))
if (consumerReports) {
  assert.equal(consumerReports.public_label, 'Context')
  assert.match(consumerReports.title, /third-party|context|review/i)
}

const hexArticle = sources.find((s) => /hexclad/i.test(`${s.url} ${s.title}`))
assert.equal(hexArticle, undefined, 'HexClad cross-brand article should be suppressed on GreenPan')

const review = buildGate1SourcesReview(evidence)
const youtubeRow = review.allRows.find((r) => r.url.includes('youtube.com'))
assert.equal(youtubeRow?.reviewerLabel, 'Context source only')

const mfr = sources.find((s) => s.url.includes('greenpan.us/products'))
assert.ok(mfr)
assert.equal(mfr.public_label, 'Manufacturer')

console.log('✓ public source role rendering')
