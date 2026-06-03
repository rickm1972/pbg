#!/usr/bin/env node
/**
 * Assert PTFE cookware required-check runners are wired for Agent 1 (Phase 3.7).
 * Usage: node scripts/agent1/test-ptfe-required-retrieval-runners.mjs
 */
import { PTFE_REQUIRED_EXTERNAL_CHECK_IDS } from '../../src/shared/required-evidence-retrieval/retrieval-task-registry.mjs'
import { getRetrievalTaskForCheck } from '../../src/shared/required-evidence-retrieval/retrieval-task-registry.mjs'
import {
  assertPtfeExternalRunnersRegistered,
  TASK_RUNNERS,
} from './required-check-retrieval/task-runners.mjs'
import { executeRequiredCheckRetrieval } from './required-check-retrieval/execute-required-retrieval.mjs'
import { applyCanonicalMappings } from '../../src/shared/canonical-taxonomy/map-structured-evidence.mjs'
import { detectPatternTriggers } from '../../src/shared/required-evidence-matrix/pattern-triggers.mjs'

const PTFE_PRIMARIES = new Set(['ptfe_nonstick_titanium_reinforced', 'ptfe_nonstick_coating'])

assertPtfeExternalRunnersRegistered()

for (const checkId of PTFE_REQUIRED_EXTERNAL_CHECK_IDS) {
  const task = getRetrievalTaskForCheck(checkId)
  if (!task) throw new Error(`Registry missing task for ${checkId}`)
  if (task.check_id !== checkId) {
    throw new Error(`Registry check_id mismatch: ${task.check_id} !== ${checkId}`)
  }
  if (!TASK_RUNNERS[checkId]) {
    throw new Error(`TASK_RUNNERS missing ${checkId}`)
  }
}

const fixture = {
  product_identity: { subcategory: 'Cookware', brand: 'T-Fal', product_name: 'Test Pan' },
  primary_contact_material: { material_identity: 'PTFE nonstick titanium reinforced coating' },
  safety_claims: {
    pfoa_free_claim: { claimed: true, source_quote: 'PFOA free', source_url: 'https://example.com/pfoa' },
    pfas_free_claim: { claimed: false },
  },
  coatings_and_finishes: [{ coating_name: 'PTFE nonstick', composition_disclosed: true }],
}
const sources = [{ url: 'https://example.com/pfoa', page_excerpt: 'PFOA free coating', source_type: 'manufacturer' }]

applyCanonicalMappings(fixture, sources, { facts: [] })
const primaryId = fixture.canonical_mappings?.primary_contact_material_id?.canonical_id
if (!PTFE_PRIMARIES.has(primaryId)) {
  throw new Error(`Expected PTFE primary, got ${primaryId}`)
}

const triggers = detectPatternTriggers(fixture, fixture.canonical_mappings, sources)
for (const id of PTFE_REQUIRED_EXTERNAL_CHECK_IDS) {
  if (!triggers.has('ptfe_primary_contact')) {
    throw new Error('ptfe_primary_contact trigger missing')
  }
}
if (!triggers.has('pfoa_pfas_distinction')) {
  throw new Error('pfoa_pfas_distinction trigger missing for PTFE fixture')
}

const product = { brand: 'T-Fal', product_name: 'Test Pan' }
const out = await executeRequiredCheckRetrieval({
  structured: fixture,
  sources,
  product,
  env: {},
})

for (const checkId of PTFE_REQUIRED_EXTERNAL_CHECK_IDS) {
  const row = out.results?.find((r) => r.check_id === checkId)
  if (!row) throw new Error(`No required_check_results row for ${checkId}`)
  if (/No retrieval runner registered/i.test(row.detail ?? '')) {
    throw new Error(`${checkId} still has unregistered-runner stub: ${row.detail}`)
  }
}

console.log('OK: PTFE required-check runners registered and execute path reachable.')
console.log('  check_ids:', PTFE_REQUIRED_EXTERNAL_CHECK_IDS.join(', '))
console.log(
  '  fixture results:',
  PTFE_REQUIRED_EXTERNAL_CHECK_IDS.map((id) => {
    const r = out.results.find((x) => x.check_id === id)
    return `${id}=${r?.status}`
  }).join(', '),
)
