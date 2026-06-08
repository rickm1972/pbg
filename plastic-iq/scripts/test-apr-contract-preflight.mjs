#!/usr/bin/env node
/**
 * Phase 4 — APR contract preflight + Layer B fixtures (assertions 1–11).
 * Run: npm run test:apr:contract
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveProductTypeConfig, registerProductTypeConfigForTest } from '../src/shared/product-type-registry/index.mjs'
import { TUMBLER_TEST_CONFIG } from '../src/shared/product-type-registry/configs/test-configs.mjs'
import { getProductTypeRegistryPreflightError } from '../src/shared/product-type-registry/preflight.mjs'
import { resolveSubcategoryKey } from '../src/shared/required-evidence-matrix/resolve-subcategory.mjs'
import { deriveProductCategory } from './agent2/deterministic/category.mjs'
import { runAprContractPreflight } from '../src/lib/apr/contractPreflight.ts'
import { assertRendererTextContract, buildPrimaryProductVisibleStrings, collectAprAllowedStrings } from '../src/lib/apr/rendererTextContract.ts'
import {
  NEGATIVE_SCORE_PUBLICATION_GATE,
  assertNegativeScorePublicationPolicy,
} from '../src/lib/apr/negativeScoreGate.ts'
import { isStaticSiteChromeString } from '../src/lib/apr/pageChrome.ts'
import { buildTwelveInchSkilletFixtureApr } from '../src/lib/apr/fixtures/twelveInchSkillet.fixture.ts'
import { buildStainlessDocumentationFixtureApr } from '../src/lib/apr/fixtures/stainlessDocumentation.fixture.ts'
import {
  buildTwelveInchSkilletFixtureApr as buildVariantMismatchApr,
  FIXTURE_MFR_MISMATCH_URL,
  FIXTURE_MFR_COLLECTION_URL,
  fixturePublicEligibleSources,
} from '../src/lib/apr/fixtures/variantMismatch.fixture.ts'
import { FIXTURE_RISK_BARS_LODGE_SHAPE } from '../src/lib/apr/fixtures/riskBarContract.fixture.ts'
import {
  FORBIDDEN_RENDERER_IMPORTS,
  RENDERER_SCAN_FILES,
  scanRendererForbiddenImportsSimple,
} from '../src/lib/apr/forbiddenRendererImports.ts'

const root = join(fileURLToPath(import.meta.url), '..', '..')

console.log('Phase 4 APR contract preflight (assertions 1–11)\n')

// ── Fixture A: product-type-first resolution ────────────────────────────────

{
  const waterBottle = resolveProductTypeConfig({
    category: 'Kitchen',
    subcategory: 'Drinkware',
    product_type: 'Water bottle',
  })
  assert.equal(waterBottle?.registry_key, 'kitchen.drinkware.water_bottle')

  registerProductTypeConfigForTest(TUMBLER_TEST_CONFIG)
  const tumbler = resolveProductTypeConfig({
    category: 'Kitchen',
    subcategory: 'Drinkware',
    product_type: 'Tumbler',
  })
  assert.equal(tumbler?.registry_key, 'kitchen.drinkware.tumbler')

  const unconfigured = resolveProductTypeConfig({
    category: 'Kitchen',
    subcategory: 'Drinkware',
    product_type: 'Unconfigured Test Vessel',
  })
  assert.equal(unconfigured, null, 'unknown product_type must not alias to Water bottle')

  const stillWaterBottle = resolveProductTypeConfig({
    category: 'Kitchen',
    subcategory: 'Drinkware',
  })
  assert.equal(
    stillWaterBottle?.registry_key,
    'kitchen.drinkware.water_bottle',
    'subcategory-only Drinkware may still resolve when product_type absent',
  )
}
console.log('✓ Fixture A: product-type-first resolution (Water bottle, Tumbler, Unconfigured blocks)')

// Agent guard path — unconfigured Drinkware product_type blocks
{
  const product = {
    category: 'Kitchen',
    subcategory: 'Drinkware',
    product_type: 'Unconfigured Test Vessel',
    product_name: 'Test Vessel',
  }
  const blockReason = getProductTypeRegistryPreflightError({ product })
  assert.ok(blockReason, 'agent guard must block unknown Drinkware product_type')
  assert.match(blockReason, /category config required/i)
  assert.equal(
    resolveSubcategoryKey('Drinkware', { category: 'Kitchen', product_type: 'Unconfigured Test Vessel' }),
    null,
  )
  assert.equal(
    deriveProductCategory(
      {
        agent_metadata: {
          structured_evidence: {
            product_identity: {
              category: 'Kitchen',
              subcategory: 'Drinkware',
              product_type: 'Unconfigured Test Vessel',
            },
          },
        },
      },
      product,
    ),
    null,
  )
}
console.log('✓ unknown Drinkware product_type blocked on agent guard path (no Water bottle fallback)')

// ── Fixture B: stainless documentation ──────────────────────────────────────

{
  const apr = buildStainlessDocumentationFixtureApr()
  const result = runAprContractPreflight(apr)
  assert.equal(result.passed, true, result.violations.map((v) => v.message).join('; '))
  assert.equal(apr.score.payload.transparency_badge, 'Documentation Incomplete')
  assert.equal(apr.score.payload.displayed_confidence_range, '±3')
  assert.ok(!apr.display.payload.product_description.includes('stainless_steel_unspecified'))

  const bad = structuredClone(apr)
  bad.score.payload.transparency_badge = 'Fully Disclosed'
  bad.display.payload.disclosure_quality = 'Fully Disclosed'
  const badResult = runAprContractPreflight(bad)
  assert.equal(badResult.passed, false)
  assert.ok(badResult.violations.some((v) => v.check_id.startsWith('transparency.')))
}
console.log('✓ Fixture B: stainless_steel_unspecified → Documentation Incomplete, ±3, no raw IDs')

// ── Fixture C + E: retailer provenance + secondary materials (12" skillet) ──

{
  const apr = buildTwelveInchSkilletFixtureApr()
  const result = runAprContractPreflight(apr)
  assert.equal(result.passed, true, result.violations.map((v) => v.message).join('; '))

  const ws = apr.display.payload.sources.find((s) => s.source_role === 'retailer_primary')
  assert.ok(ws)
  assert.equal(ws.group, 'Retailer')
  assert.notEqual(ws.group, 'Context')
  assert.ok(apr.display.payload.buy_cta.some((c) => c.url === ws.url))

  const secondaryNames = apr.display.payload.secondary_materials.map((s) => s.name)
  assert.ok(secondaryNames.includes('Graphite core'))
  assert.ok(secondaryNames.includes('Aluminum core'))

  const oneCoreDropped = structuredClone(apr)
  oneCoreDropped.display.payload.secondary_materials = oneCoreDropped.display.payload.secondary_materials.filter(
    (s) => s.name !== 'Aluminum core',
  )
  const droppedResult = runAprContractPreflight(oneCoreDropped)
  assert.equal(droppedResult.passed, false)
  assert.ok(droppedResult.violations.some((v) => v.check_id === 'secondary_materials.policy_show_all'))
}
console.log('✓ Fixture C/E: retailer_primary under Retailer group; both internal cores shown')

// ── Fixture G: canonical ID leak ────────────────────────────────────────────

{
  const apr = buildTwelveInchSkilletFixtureApr()
  const leaked = structuredClone(apr)
  leaked.display.payload.primary_material = 'Primary: stainless_steel_unspecified grade'
  const result = runAprContractPreflight(leaked)
  assert.equal(result.passed, false)
  assert.ok(result.violations.some((v) => v.check_id === 'display.canonical_id_leak'))
}
console.log('✓ Fixture G: canonical ID leak in display.* fails preflight')

// ── Assertion 2: no TAXONOMY_EXPANSION_REQUIRED in normalization ────────────

{
  const apr = buildStainlessDocumentationFixtureApr()
  const expansion = structuredClone(apr)
  expansion.normalization.payload.components[0].material_id = 'TAXONOMY_EXPANSION_REQUIRED'
  const result = runAprContractPreflight(expansion)
  assert.equal(result.passed, false)
  assert.ok(result.violations.some((v) => v.check_id === 'registry.material_class_resolved'))
}
console.log('✓ Assertion 2: TAXONOMY_EXPANSION_REQUIRED in normalization fails preflight')

// ── Fixture H: unconfigured product-type on assembled APR ───────────────────

{
  const apr = buildTwelveInchSkilletFixtureApr()
  const unconfigured = structuredClone(apr)
  unconfigured.evidence.payload.structured_evidence = {
    product_identity: {
      category: 'Kitchen',
      subcategory: 'Drinkware',
      product_type: 'Unconfigured Test Vessel',
    },
  }
  const result = runAprContractPreflight(unconfigured)
  assert.equal(result.passed, false)
  assert.ok(result.violations.some((v) => v.check_id === 'registry.product_type_configured'))
  assert.match(result.violations[0].message, /category config required/i)
}
console.log('✓ Fixture H: unconfigured product_type fails APR contract preflight')

// ── retailer_primary cannot render as Context ───────────────────────────────

{
  const apr = buildTwelveInchSkilletFixtureApr()
  const bad = structuredClone(apr)
  const ws = bad.display.payload.sources.find((s) => s.source_role === 'retailer_primary')
  ws.group = 'Context'
  const result = runAprContractPreflight(bad)
  assert.equal(result.passed, false)
  assert.ok(result.violations.some((v) => v.check_id === 'sources.retailer_primary_not_context'))
}
console.log('✓ retailer_primary cannot render/group as Context')

// ── Fixture D / Assertion 7: variant mismatch ───────────────────────────────

{
  const apr = buildVariantMismatchApr()
  assert.ok(/12\s*inch/i.test(apr.evidence.payload.reviewed_identity.product_name))
  const mismatch = apr.display.payload.sources.find((s) => s.url === FIXTURE_MFR_MISMATCH_URL)
  assert.ok(mismatch?.variant_mismatch)
  assert.equal(mismatch?.public_source_eligible, false)
  assert.ok(!apr.display.payload.buy_cta.some((c) => c.url === FIXTURE_MFR_MISMATCH_URL))

  const collection = apr.display.payload.sources.find((s) => s.url === FIXTURE_MFR_COLLECTION_URL)
  assert.ok(collection?.public_source_eligible)

  const publicEligible = fixturePublicEligibleSources(apr)
  assert.ok(!publicEligible.some((s) => s.url === FIXTURE_MFR_MISMATCH_URL))

  const result = runAprContractPreflight(apr)
  assert.equal(result.passed, true, result.violations.map((v) => v.message).join('; '))

  const badCta = structuredClone(apr)
  badCta.display.payload.buy_cta.push({ label: 'Buy mismatched', url: FIXTURE_MFR_MISMATCH_URL })
  const ctaResult = runAprContractPreflight(badCta)
  assert.equal(ctaResult.passed, false)
  assert.ok(ctaResult.violations.some((v) => v.check_id === 'variant_mismatch.not_buy_cta'))

  const badVisible = structuredClone(apr)
  const mm = badVisible.display.payload.sources.find((s) => s.url === FIXTURE_MFR_MISMATCH_URL)
  mm.public_source_eligible = true
  const visResult = runAprContractPreflight(badVisible)
  assert.equal(visResult.passed, false)
  assert.ok(
    visResult.violations.some(
      (v) => v.check_id === 'variant_mismatch.exact_page_hidden' || v.check_id === 'sources.variant_mismatch',
    ),
  )
}
console.log('✓ Fixture D: variant mismatch hidden; not buy CTA or public exact product page')

// ── Assertion 8: display artifact checks ────────────────────────────────────

{
  const apr = buildTwelveInchSkilletFixtureApr()
  const clean = runAprContractPreflight(apr)
  assert.equal(clean.passed, true, clean.violations.map((v) => v.message).join('; '))

  const artifact = structuredClone(apr)
  artifact.display.payload.product_description = ', dangling comma artifact,'
  const result = runAprContractPreflight(artifact)
  assert.equal(result.passed, false)
  assert.ok(result.violations.some((v) => v.check_id.startsWith('display.artifact.')))

  const htmlLabel = structuredClone(apr)
  htmlLabel.display.payload.sources[0].label = 'Williams Sonoma page.html listing'
  const htmlResult = runAprContractPreflight(htmlLabel)
  assert.equal(htmlResult.passed, false)
  assert.ok(htmlResult.violations.some((v) => v.check_id === 'display.artifact.html_extension'))
}
console.log('✓ Assertion 8: display artifact checks catch punctuation/html leaks')

// ── Assertion 9: risk-bar contract ──────────────────────────────────────────

{
  const apr = buildTwelveInchSkilletFixtureApr()
  const withBars = structuredClone(apr)
  withBars.display.payload.risk_bars = FIXTURE_RISK_BARS_LODGE_SHAPE
  const result = runAprContractPreflight(withBars)
  assert.equal(result.passed, true, result.violations.map((v) => v.message).join('; '))

  const badBar = structuredClone(withBars)
  badBar.display.payload.risk_bars[0].color_token = 'purple'
  const badResult = runAprContractPreflight(badBar)
  assert.equal(badResult.passed, false)
  assert.ok(badResult.violations.some((v) => v.check_id === 'risk_bars.invalid_color_token'))
}
console.log('✓ Assertion 9: risk-bar Oura-style contract enforced')

// ── Fixture F / Assertion 10: renderer invented-text ──────────────────────

{
  const apr = buildTwelveInchSkilletFixtureApr()
  const renderInput = { display: apr.display.payload, score: apr.score.payload }
  const textContract = assertRendererTextContract(renderInput)
  assert.equal(textContract.valid, true, textContract.violations.map((v) => v.message).join('; '))

  assert.ok(isStaticSiteChromeString('PAC Safety Score'))
  assert.ok(!isStaticSiteChromeString('All-Clad G5 Graphite Core'))

  const inventedString = 'Completely invented product-specific string XYZ'
  const visible = buildPrimaryProductVisibleStrings(renderInput)
  const allowed = collectAprAllowedStrings(renderInput)
  const hasInvented = visible.some((s) => s === inventedString)
  assert.equal(hasInvented, false)
  const wouldAllow = [...allowed].some(
    (a) => a === inventedString || a.includes(inventedString) || inventedString.includes(a),
  )
  assert.equal(wouldAllow, false)
  assert.ok(!isStaticSiteChromeString(inventedString))

  const fileContents = RENDERER_SCAN_FILES.map((rel) => ({
    path: rel,
    content: readFileSync(join(root, rel), 'utf8'),
  }))
  const importViolations = scanRendererForbiddenImportsSimple(fileContents)
  assert.equal(importViolations.length, 0)
  for (const rel of RENDERER_SCAN_FILES) {
    assert.ok(!readFileSync(join(root, rel), 'utf8').includes('product-type-registry'))
  }
}
console.log('✓ Fixture F: renderer visible strings from APR only; chrome exempt; no forbidden imports')

// ── Fixture I / Assertion 11: negative-score placeholder only ───────────────

{
  assert.equal(NEGATIVE_SCORE_PUBLICATION_GATE.enabled, false)
  const apr = buildTwelveInchSkilletFixtureApr()
  const lowScore = structuredClone(apr)
  lowScore.score.payload.pac_safety_score = 40
  lowScore.score.payload.tier = 'Concern'
  assert.equal(assertNegativeScorePublicationPolicy(lowScore).length, 0)
  assert.equal(runAprContractPreflight(lowScore).passed, true)
}
console.log('✓ Fixture I: negative-score gate is placeholder only (not enforced)')

console.log('\nPhase 4 APR contract preflight tests passed (complete)')
