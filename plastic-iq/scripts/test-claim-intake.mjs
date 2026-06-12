#!/usr/bin/env node
/**
 * Product claim intake enum + Layer 4A guard tests.
 * Run: npm run test:claim-intake
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  CLAIM_INTAKE_DISCLAIMER,
  CLAIM_INTAKE_TYPES,
  EVIDENCE_ONLY_CLAIM_TYPES,
  LAYER_4A_MAPPED_CLAIM_TYPES,
  claimIntakeAffectsLayer4a,
  claimIntakeValueFromLegacy,
  claimIntakeValueToLegacy,
  emptyClaimIntakeMap,
} from '../src/lib/productClaimIntake.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const migration46 = readFileSync(join(root, 'supabase/migrations/0046_managed_taxonomy.sql'), 'utf8')
const adminPage = readFileSync(join(root, 'src/pages/AdminPage.tsx'), 'utf8')
const layer4aApplicability = readFileSync(
  join(root, 'scripts/agent2/deterministic/layer4a-applicability.mjs'),
  'utf8',
)
const layer4aValidation = readFileSync(
  join(root, 'src/lib/lockedInput/buildSystemValidation.ts'),
  'utf8',
)

assert.ok(migration46.includes('create table if not exists public.product_claim_intake'))
assert.ok(migration46.includes("'bpa_free'"))
assert.ok(migration46.includes("'phthalate_free'"))
assert.ok(migration46.includes("'pfas_free'"))
assert.ok(migration46.includes("'lead_free'"))
assert.ok(migration46.includes("claim_value in ('yes', 'no', 'unknown')"))
console.log('✓ product_claim_intake table with closed enums')

// 25–29 enum coverage
assert.equal(claimIntakeValueFromLegacy('Yes'), 'yes')
assert.equal(claimIntakeValueFromLegacy('No'), 'no')
assert.equal(claimIntakeValueFromLegacy('Unknown'), 'unknown')
assert.equal(claimIntakeValueToLegacy('yes'), 'Yes')
assert.ok(CLAIM_INTAKE_TYPES.includes('bpa_free'))
assert.ok(CLAIM_INTAKE_TYPES.includes('phthalate_free'))
assert.ok(CLAIM_INTAKE_TYPES.includes('pfas_free'))
assert.ok(CLAIM_INTAKE_TYPES.includes('lead_free'))
console.log('✓ BPA/phthalate/PFAS/lead claim enums yes/no/unknown')

// 30 unmapped claims do not change score (lead-free evidence only)
assert.equal(claimIntakeAffectsLayer4a('lead_free'), false)
assert.ok(EVIDENCE_ONLY_CLAIM_TYPES.has('lead_free'))
console.log('✓ lead-free is evidence/display-only in this phase')

// 31 existing Layer 4A unchanged (spot-check symbols still present)
assert.ok(layer4aValidation.includes('bpa_free_claim_only'))
assert.ok(layer4aApplicability.includes('pfas') || layer4aValidation.includes('pfas_free_independently_verified'))
assert.ok(LAYER_4A_MAPPED_CLAIM_TYPES.has('bpa_free'))
assert.ok(LAYER_4A_MAPPED_CLAIM_TYPES.has('pfas_free'))
console.log('✓ existing Layer 4A claim mappings unchanged')

// 32 disclaimer in UI
const claimFieldsSource = readFileSync(
  join(root, 'src/components/admin/ProductClaimIntakeFields.tsx'),
  'utf8',
)
assert.ok(adminPage.includes('ProductClaimIntakeFields'))
assert.ok(claimFieldsSource.includes('CLAIM_INTAKE_DISCLAIMER'))
console.log('✓ claim UI shows scoring disclaimer')

// 33 unknown without penalty
const claims = emptyClaimIntakeMap()
for (const t of CLAIM_INTAKE_TYPES) assert.equal(claims[t], 'unknown')
console.log('✓ claim intake defaults to unknown without penalty')

console.log('✓ claim intake tests passed')
