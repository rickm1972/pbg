#!/usr/bin/env node
/**
 * APR ownership + renderer forbidden-import tests (Phase 2).
 * Run: npx tsx scripts/test-apr-ownership.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  assertAgent3ReadContract,
  assertFieldOwnershipMapComplete,
  assertRendererReadContract,
  runAprOwnershipPreflight,
} from '../src/lib/apr/ownership.ts'
import {
  FORBIDDEN_RENDERER_IMPORTS,
  RENDERER_SCAN_FILES,
  scanRendererForbiddenImportsSimple,
} from '../src/lib/apr/forbiddenRendererImports.ts'
import { buildTwelveInchSkilletFixtureApr } from '../src/lib/apr/fixtures/twelveInchSkillet.fixture.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const ownershipMap = assertFieldOwnershipMapComplete()
assert.equal(ownershipMap.valid, true, ownershipMap.errors.join('; '))
console.log('✓ field ownership map complete')

const rendererViolations = assertRendererReadContract(['normalization.components', 'display.product_title'])
assert.equal(rendererViolations.valid, false)
const rendererOk = assertRendererReadContract(['display.product_title', 'score.tier'])
assert.equal(rendererOk.valid, true)
console.log('✓ renderer read contract rejects forbidden paths')

const agent3Bad = assertAgent3ReadContract(['normalization.components', 'display.primary_material'])
assert.equal(agent3Bad.valid, false)
const agent3Ok = assertAgent3ReadContract(['normalization.components'])
assert.equal(agent3Ok.valid, true)
console.log('✓ Agent 3 read contract rejects display.* paths')

const apr = buildTwelveInchSkilletFixtureApr()
const preflight = runAprOwnershipPreflight(apr)
assert.equal(preflight.passed, true, preflight.violations.map((v) => v.message).join('; '))
console.log('✓ fixture APR passes ownership preflight')

const fileContents = RENDERER_SCAN_FILES.map((rel) => ({
  path: rel,
  content: readFileSync(join(root, rel), 'utf8'),
}))
const importViolations = scanRendererForbiddenImportsSimple(fileContents)
assert.equal(
  importViolations.length,
  0,
  `Renderer must not import forbidden upstream modules:\n${importViolations.map((v) => `${v.file}:${v.line} ${v.importPath}`).join('\n')}`,
)
console.log('✓ public renderer has zero forbidden upstream imports')

const inventory = readFileSync(join(root, 'docs/apr-migration-inventory.md'), 'utf8')
assert.ok(inventory.includes('Migration Inventory'))
console.log('✓ migration inventory document present')

console.log('\nAll APR ownership tests passed')
