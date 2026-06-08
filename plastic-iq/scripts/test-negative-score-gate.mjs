#!/usr/bin/env node
/**
 * Phase 4.5 — negative-score publication gate tests.
 * Run: npm run test:negative-score-gate
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  NEGATIVE_SCORE_PUBLICATION_GATE,
  LOW_SCORE_GATE_VERSION,
  runNegativeScorePublicationGate,
  assertNegativeScorePublicationReady,
} from '../src/lib/apr/negativeScoreGate.ts'
import { assertPublishReadiness } from '../src/lib/apr/publishReadiness.ts'
import { runAprContractPreflight } from '../src/lib/apr/contractPreflight.ts'
import { buildTwelveInchSkilletFixtureApr } from '../src/lib/apr/fixtures/twelveInchSkillet.fixture.ts'
import { buildLowScorePtfePatternFixtureApr } from '../src/lib/apr/fixtures/lowScorePtfePattern.fixture.ts'
import { buildLowScoreUncertaintyPatternFixtureApr } from '../src/lib/apr/fixtures/lowScoreUncertaintyPattern.fixture.ts'
import { buildApprovedLowScoreReview } from '../src/lib/apr/fixtures/lowScoreReview.ts'

const root = join(fileURLToPath(import.meta.url), '..', '..')

assert.equal(NEGATIVE_SCORE_PUBLICATION_GATE.enabled, true)
assert.equal(NEGATIVE_SCORE_PUBLICATION_GATE.threshold, 75)
assert.equal(LOW_SCORE_GATE_VERSION, '4.5.0')

// A. Threshold tests
{
  const high = buildTwelveInchSkilletFixtureApr()
  const atThreshold = structuredClone(high)
  atThreshold.score.payload.pac_safety_score = 75
  const below = structuredClone(high)
  below.score.payload.pac_safety_score = 74
  const veryLow = structuredClone(high)
  veryLow.score.payload.pac_safety_score = 2

  assert.equal(runNegativeScorePublicationGate(high).applies, false)
  assert.equal(runNegativeScorePublicationGate(atThreshold).applies, false)
  assert.equal(runNegativeScorePublicationGate(below).applies, true)
  assert.equal(runNegativeScorePublicationGate(veryLow).applies, true)
}
console.log('✓ A: threshold tests (75 bypass, 74/2 apply)')

// B/C/D/E/F/G/H via fixtures
{
  const ptfePass = buildLowScorePtfePatternFixtureApr()
  const ptfeGate = runNegativeScorePublicationGate(ptfePass)
  assert.equal(ptfeGate.applies, true)
  assert.equal(ptfeGate.ok, true, ptfeGate.failures.map((f) => f.message).join('; '))

  const ptfeNoSupport = structuredClone(ptfePass)
  ptfeNoSupport.evidence.payload.sources = []
  ptfeNoSupport.evidence.payload.structured_evidence = { product_identity: {} }
  ptfeNoSupport.normalization.payload.components = []
  const unsupported = runNegativeScorePublicationGate(ptfeNoSupport)
  assert.equal(unsupported.ok, false)
  assert.ok(unsupported.failures.some((f) => f.rule === 'score_driving_material_unsupported'))

  const ptfeToxic = structuredClone(ptfePass)
  ptfeToxic.display.payload.product_description += ' This product is toxic and unsafe.'
  const toxic = runNegativeScorePublicationGate(ptfeToxic)
  assert.equal(toxic.ok, false)
  assert.ok(toxic.failures.some((f) => f.rule === 'banned_absolute_harm'))

  const ptfeMarketing = structuredClone(ptfePass)
  ptfeMarketing.display.payload.product_description =
    'T-Fal markets this product as non-toxic, but materials contradict the marketing claim.'
  const marketing = runNegativeScorePublicationGate(ptfeMarketing)
  assert.equal(marketing.ok, false)
  assert.ok(marketing.failures.some((f) => f.rule === 'banned_brand_characterization'))

  const ptfeNoReview = buildLowScorePtfePatternFixtureApr(null)
  const noReview = runNegativeScorePublicationGate(ptfeNoReview)
  assert.equal(noReview.ok, false)
  assert.ok(noReview.failures.some((f) => f.check_id === 'negative_score.review_missing'))

  const carawayPass = buildLowScoreUncertaintyPatternFixtureApr()
  const carawayGate = runNegativeScorePublicationGate(carawayPass)
  assert.equal(carawayGate.ok, true, carawayGate.failures.map((f) => f.message).join('; '))

  const carawayHazard = structuredClone(carawayPass)
  carawayHazard.display.payload.product_description +=
    ' This is a confirmed chemical hazard from PFAS exposure.'
  const hazard = runNegativeScorePublicationGate(carawayHazard)
  assert.equal(hazard.ok, false)

  const carawayNoReview = buildLowScoreUncertaintyPatternFixtureApr(null)
  assert.equal(runNegativeScorePublicationGate(carawayNoReview).ok, false)
}
console.log('✓ B–F: evidence, language, approval, PTFE + uncertainty fixtures')

// D. Human approval mismatch / stale
{
  const apr = buildLowScorePtfePatternFixtureApr(
    buildApprovedLowScoreReview({
      score: 99,
      primary_score_driving_concern: 'PTFE nonstick coating',
    }),
  )
  const mismatch = runNegativeScorePublicationGate(apr)
  assert.equal(mismatch.ok, false)
  assert.ok(mismatch.failures.some((f) => f.rule === 'review_score_mismatch'))

  const stale = buildLowScorePtfePatternFixtureApr({
    ...buildApprovedLowScoreReview({
      score: 2,
      primary_score_driving_concern: 'PTFE nonstick coating',
    }),
    low_score_gate_version: '0.0.1',
  })
  assert.ok(runNegativeScorePublicationGate(stale).failures.some((f) => f.rule === 'review_gate_version_stale'))
}
console.log('✓ D: human approval mismatch and stale version')

// G. Non-low-score bypass + contract preflight still runs
{
  const high = buildTwelveInchSkilletFixtureApr()
  const gate = runNegativeScorePublicationGate(high)
  assert.equal(gate.applies, false)
  assert.equal(gate.ok, true)
  const contract = runAprContractPreflight(high)
  assert.equal(contract.passed, true)
}
console.log('✓ G: score 99 bypasses negative gate; APR preflight still passes')

// H. Publish readiness integration
{
  const fail = buildLowScorePtfePatternFixtureApr(null)
  const readinessFail = assertPublishReadiness(fail)
  assert.equal(readinessFail.ready, false)
  assert.equal(readinessFail.negative_score_gate.applies, true)

  const pass = buildLowScorePtfePatternFixtureApr()
  const readinessPass = assertPublishReadiness(pass)
  assert.equal(readinessPass.negative_score_gate.ok, true)
  // Contract may still fail on fixture gaps unrelated to negative gate — PTFE fixture should pass both
  assert.equal(readinessPass.ready, true, readinessPass.violations.map((v) => v.message).join('; '))
}
console.log('✓ H: publish readiness integration')

// assertNegativeScorePublicationReady throws on failure
{
  const bad = buildLowScorePtfePatternFixtureApr(null)
  assert.throws(() => assertNegativeScorePublicationReady(bad), /Negative-score publication gate failed/)
}
console.log('✓ assertNegativeScorePublicationReady throws on failure')

// Read-only: existing published baselines would fail (no mutation)
{
  const tfal = JSON.parse(
    readFileSync(join(root, 'src/lib/apr/published-baselines/t-fal.json'), 'utf8'),
  )
  const caraway = JSON.parse(
    readFileSync(join(root, 'src/lib/apr/published-baselines/caraway.json'), 'utf8'),
  )

  function minimalAprFromBaseline(snapshot, scorePayload) {
    return {
      apr_id: 'read-only-baseline-check',
      product_id: snapshot.product_id,
      schema_version: '1',
      assembled_at: '2026-06-01T00:00:00Z',
      assembled_content_hash: '',
      evidence: {
        payload: {
          evidence_id: '',
          bundle_version: 1,
          algorithm_version: '',
          reviewed_identity: {
            product_name: snapshot.display.product_title,
            brand: '',
            sku_or_model: null,
            primary_retailer_url: null,
          },
          sources: (snapshot.display.sources ?? []).map((s) => ({
            source_type: 'other_retailer',
            url: s.url,
            title: s.label,
            fetched_at: '2026-06-01T00:00:00Z',
            source_role: s.source_role,
            variant_mismatch: s.variant_mismatch ?? false,
          })),
          structured_evidence: { canonical_mappings: { primary_contact_surface: { canonical_id: 'ptfe_nonstick_coating' } } },
        },
      },
      normalization: {
        payload: {
          input_id: snapshot.product_id,
          evidence_id: '',
          evidence_content_hash: '',
          algorithm_version: '',
          components: [
            {
              component_name: 'Food contact',
              component_role: 'primary_food_contact',
              material_id: 'ptfe_nonstick_coating',
              material: snapshot.display.primary_material,
              material_hazard: 0.8,
              adjusted_migration_potential: 0.7,
              contact_intimacy: 1,
              exposure_severity: 1,
              severity_justification: '',
              exposure_duration: 1,
              duration_justification: '',
            },
          ],
          layer_4a: null,
          layer_4b: null,
        },
      },
      display: { payload: snapshot.display },
      score: { payload: scorePayload },
      qa: { payload: { qa_id: '', score_content_hash: '', display_content_hash: '', preflight: { passed: true, checked_at: '', checks: [] }, checks: {} } },
    }
  }

  const tfalGate = runNegativeScorePublicationGate(
    minimalAprFromBaseline(tfal, tfal.score),
  )
  const carawayGate = runNegativeScorePublicationGate(
    minimalAprFromBaseline(caraway, caraway.score),
  )

  assert.equal(tfalGate.applies, true)
  assert.equal(tfalGate.ok, false, 'T-Fal baseline expected to fail new gate (language + missing review)')
  assert.equal(carawayGate.applies, true)
  assert.equal(carawayGate.ok, false, 'Caraway baseline expected to fail new gate (missing review/disclaimer)')
  console.log(
    `  read-only baseline: T-Fal failures=${tfalGate.failures.length}, Caraway failures=${carawayGate.failures.length}`,
  )
}
console.log('✓ read-only published baseline check (no mutation)')

console.log('\nPhase 4.5 negative-score publication gate tests passed')
