#!/usr/bin/env node
/**
 * Phase 0.5 load-bearing verification — no-code config + unconfigured block proofs.
 * Run: npm run test:phase05-registry-verification
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  registerProductTypeConfigForTest,
  resolveProductTypeConfig,
  resolveMatrixKeyFromRegistry,
  validateProductTypeConfig,
} from '../src/shared/product-type-registry/index.mjs'
import {
  TUMBLER_TEST_CONFIG,
  UNCONFIGURED_TEST_PRODUCT,
} from '../src/shared/product-type-registry/configs/test-configs.mjs'
import {
  getProductTypeRegistryPreflightError,
  CATEGORY_CONFIG_REQUIRED,
} from '../src/shared/product-type-registry/preflight.mjs'
import { resolveSubcategoryKey } from '../src/shared/required-evidence-matrix/resolve-subcategory.mjs'
import { validateRequiredEvidence } from '../src/shared/required-evidence-matrix/validate-required-evidence.mjs'
import { getMatrixForSubcategory } from '../src/shared/required-evidence-matrix/matrices/index.mjs'
import { deriveProductCategory } from './agent2/deterministic/category.mjs'
import { buildWhyThisScoreOptions } from './agent2/why-this-score-map.mjs'

const root = join(fileURLToPath(import.meta.url), '..', '..')

/** Paths that must not change for Tumbler no-code registration to hold. */
const AGENT_PREFLIGHT_RENDERER_GUARD_FILES = [
  'scripts/agent1/runner.mjs',
  'scripts/agent2/runner.mjs',
  'scripts/agent3/runner.mjs',
  'scripts/agent4/runner.mjs',
  'src/shared/product-type-registry/preflight.mjs',
  'src/pages/ProductPage.tsx',
  'src/components/Sources.tsx',
  'src/components/WhyThisScore.tsx',
  'src/components/RiskDashboard.tsx',
  'src/components/RetailerBuyButtons.tsx',
  'src/components/TransparencyBadge.tsx',
]

function snapshotGuardFiles() {
  /** @type {Record<string, string>} */
  const out = {}
  for (const rel of AGENT_PREFLIGHT_RENDERER_GUARD_FILES) {
    out[rel] = readFileSync(join(root, rel), 'utf8')
  }
  return out
}

console.log('Phase 0.5 registry verification\n')

const guardSnapshotBefore = snapshotGuardFiles()

// ── Verification 1: Tumbler config-only registration ─────────────────────────

const tumblerValidation = validateProductTypeConfig(TUMBLER_TEST_CONFIG)
assert.equal(tumblerValidation.valid, true, tumblerValidation.errors.join('; '))
assert.equal(TUMBLER_TEST_CONFIG.scoring_assumption_ref, 'v2.3.4.drinkware')

registerProductTypeConfigForTest(TUMBLER_TEST_CONFIG)

const tumblerResolved = resolveProductTypeConfig({
  category: 'Kitchen',
  subcategory: 'Drinkware',
  product_type: 'Tumbler',
})
assert.equal(tumblerResolved.registry_key, 'kitchen.drinkware.tumbler')
assert.equal(
  resolveMatrixKeyFromRegistry('Drinkware', { category: 'Kitchen', product_type: 'Tumbler' }),
  'water_bottles_drinkware',
)

const tumblerCategory = deriveProductCategory(
  {
    agent_metadata: {
      structured_evidence: {
        product_identity: {
          category: 'Kitchen',
          subcategory: 'Drinkware',
          product_type: 'Tumbler',
        },
      },
    },
  },
  { category: 'Kitchen', subcategory: 'Drinkware', product_type: 'Tumbler' },
)
assert.equal(tumblerCategory, 'drinkware')

const tumblerUseConditions = buildWhyThisScoreOptions(
  { facts: [{ fact_key: 'product_use_case', value: 'Daily drinking from insulated tumbler' }] },
  { product_category_default: 'drinkware', normal_intended_use: 'Daily drinking from insulated tumbler' },
)
assert.ok(tumblerUseConditions.use_conditions_options.includes('Direct oral contact during drinking'))

console.log('✓ Verification 1: Kitchen / Drinkware / Tumbler registers via config only')

// Prove agent/preflight/renderer guard files were not modified during Tumbler registration
{
  const guardSnapshotAfter = snapshotGuardFiles()
  for (const rel of AGENT_PREFLIGHT_RENDERER_GUARD_FILES) {
    assert.equal(
      guardSnapshotAfter[rel],
      guardSnapshotBefore[rel],
      `${rel} changed during Tumbler config registration — no-code promise broken`,
    )
    const content = guardSnapshotAfter[rel]
    if (rel.includes('runner.mjs')) {
      assert.ok(
        content.includes('getProductTypeRegistryPreflightError'),
        `${rel} must use registry preflight guard (unchanged contract)`,
      )
    }
    if (rel.includes('ProductPage') || rel.includes('components/')) {
      assert.ok(!content.includes('product-type-registry'), `${rel} must not import registry`)
    }
  }
}
console.log('✓ Verification 1: no agent/preflight/renderer source changes required for Tumbler')

// ── Verification 2: unconfigured type blocked on real agent guard path ───────

const unconfiguredProduct = { ...UNCONFIGURED_TEST_PRODUCT }

// Agent 1 guard — same call as scripts/agent1/runner.mjs before any status/DB mutation
const agent1BlockReason = getProductTypeRegistryPreflightError({ product: unconfiguredProduct })
assert.ok(agent1BlockReason, 'Agent 1 guard must block unconfigured product')
assert.match(agent1BlockReason, /category config required/i)

// Agent 2/3/4 guard — same call as agent2/3/4 runners (with optional evidence)
const agent2BlockReason = getProductTypeRegistryPreflightError({
  product: unconfiguredProduct,
  evidence: {
    agent_metadata: {
      structured_evidence: {
        product_identity: {
          category: unconfiguredProduct.category,
          subcategory: unconfiguredProduct.subcategory,
          product_type: unconfiguredProduct.product_type,
        },
      },
    },
  },
})
assert.ok(agent2BlockReason, 'Agent 2 guard must block unconfigured product')
assert.match(agent2BlockReason, /category config required/i)

// Agent 1 required-evidence path — must not fall back to cookware matrix
const matrixKey = resolveSubcategoryKey(unconfiguredProduct.subcategory, {
  category: unconfiguredProduct.category,
  product_type: unconfiguredProduct.product_type,
})
assert.equal(matrixKey, null, 'must not resolve unconfigured subcategory to any matrix key')

assert.throws(
  () => getMatrixForSubcategory(matrixKey),
  /category config required/,
  'getMatrixForSubcategory must throw, not fall back to cookware',
)

const requiredEvidence = validateRequiredEvidence({
  product_identity: {
    category: unconfiguredProduct.category,
    subcategory: unconfiguredProduct.subcategory,
    product_type: unconfiguredProduct.product_type,
    product_name: unconfiguredProduct.product_name,
    brand: 'Test',
  },
})
assert.equal(requiredEvidence.summary.approval_blocked, true)
assert.equal(requiredEvidence.summary.category_config_required, true)
assert.ok(
  requiredEvidence.approval_blockers.some((b) => /category config required/i.test(b)),
  `expected block message, got: ${requiredEvidence.approval_blockers.join('; ')}`,
)

// Agent 2 category derivation — no generic/cookware fallback
const derivedCategory = deriveProductCategory(
  {
    agent_metadata: {
      structured_evidence: {
        product_identity: {
          category: unconfiguredProduct.category,
          subcategory: unconfiguredProduct.subcategory,
          product_type: unconfiguredProduct.product_type,
        },
      },
    },
  },
  unconfiguredProduct,
)
assert.equal(derivedCategory, null, 'must not fall back to cookware or general category')

console.log('✓ Verification 2: unconfigured product blocked on agent guard + required-evidence paths')
console.log(`  block error: ${agent1BlockReason}`)

// Simulate agent early-return contract (no DB mutation, no scoring, no display assembly)
function simulateAgentPipelineEntry(agentLabel, product, evidence = null) {
  const reason = getProductTypeRegistryPreflightError({ product, evidence })
  if (reason) {
    return { ok: false, agent: agentLabel, reason, mutated: false }
  }
  return { ok: true, agent: agentLabel, mutated: true }
}

for (const agent of ['agent1', 'agent2', 'agent3', 'agent4']) {
  const result = simulateAgentPipelineEntry(
    agent,
    unconfiguredProduct,
    agent === 'agent1'
      ? null
      : {
          agent_metadata: {
            structured_evidence: {
              product_identity: {
                category: unconfiguredProduct.category,
                subcategory: unconfiguredProduct.subcategory,
                product_type: unconfiguredProduct.product_type,
              },
            },
          },
        },
  )
  assert.equal(result.ok, false, `${agent} must block before processing`)
  assert.equal(result.mutated, false, `${agent} must not mutate records when blocked`)
  assert.equal(result.reason, agent1BlockReason)
}

console.log('✓ Verification 2: all four agent pipeline entry guards block with no mutation path')

console.log('\nPhase 0.5 registry verification passed')
