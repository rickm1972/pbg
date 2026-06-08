/**
 * Compound cookware material parser — All-Clad v3 live raw + variants.
 */
import assert from 'node:assert/strict'
import {
  applyCanonicalMappings,
  resolvePrimaryContactEntry,
  resolveSubstrateEntry,
} from '../src/shared/canonical-taxonomy/map-structured-evidence.mjs'
import { parseCompoundCookwareMaterial } from '../src/shared/canonical-taxonomy/compound-cookware-material.mjs'
import { getCanonicalApprovalBlockers } from '../src/shared/canonical-taxonomy/score-driving-fields.mjs'
import { evaluateFieldRequirement } from '../src/shared/required-evidence-matrix/field-evaluators.mjs'
import { detectPatternTriggers } from '../src/shared/required-evidence-matrix/pattern-triggers.mjs'
import { TAXONOMY_EXPANSION_REQUIRED } from '../src/shared/canonical-taxonomy/constants.mjs'
import { hasRecordedAmazonUrl } from '../src/shared/agent1/amazon-source-consistency.mjs'
import { assertCookwareMaterialsResolved } from './agent1/assert-canonical-materials.mjs'

const LIVE_RAW = 'stainless_steel_interior_5ply_graphite_aluminum_core'

function mapFixture(raw = LIVE_RAW) {
  const structured = {
    product_identity: { subcategory: 'cookware' },
    primary_contact_material: {
      material_identity: raw,
      source_url: 'https://www.all-clad.com/g5-skillet',
      confidence_label: 'manufacturer_confirmed',
    },
    coatings_and_finishes: [],
    secondary_components: [],
    safety_claims: {},
    retailer_links: {
      amazon_url: 'https://www.williams-sonoma.com/products/all-clad-g5-skillet/',
      manufacturer_direct_url: 'https://www.all-clad.com/g5-skillet',
    },
  }
  const sources = [
    {
      url: 'https://www.williams-sonoma.com/products/all-clad-g5-skillet/',
      title: 'All-Clad G5 Graphite Core Skillet',
      page_excerpt: '5-ply bonded. Stainless steel interior. Graphite core. No nonstick coating.',
      source_type: 'amazon',
    },
    {
      url: 'https://www.all-clad.com/g5-skillet',
      title: 'G5 Graphite Core',
      source_type: 'manufacturer',
    },
  ]
  const mappings = applyCanonicalMappings(structured, sources)
  return { structured, sources, mappings }
}

const compound = parseCompoundCookwareMaterial(LIVE_RAW)
assert.equal(compound.isCompound, true)
assert.equal(compound.primaryContactCanonicalId, 'stainless_steel_unspecified')
assert.equal(compound.substrateCanonicalId, 'graphite_structural_core')
assert.ok(compound.secondaryCoreMaterialIds.includes('aluminum_core'))
assert.ok(compound.constructionDescriptors.includes('5_ply'))

assert.equal(resolvePrimaryContactEntry(LIVE_RAW)?.canonical_id, 'stainless_steel_unspecified')
assert.equal(resolveSubstrateEntry(LIVE_RAW)?.canonical_id, 'graphite_structural_core')

const { structured, sources, mappings } = mapFixture()
assert.notEqual(mappings.primary_contact_material_id?.canonical_id, TAXONOMY_EXPANSION_REQUIRED)
assert.equal(mappings.primary_contact_material_id?.canonical_id, 'stainless_steel_unspecified')
assert.notEqual(mappings.substrate_material_id?.canonical_id, TAXONOMY_EXPANSION_REQUIRED)
assert.equal(mappings.substrate_material_id?.canonical_id, 'graphite_structural_core')
assert.equal(mappings.coating_modifier_id?.canonical_id, 'no_coating_modifier')
assert.equal(mappings.pfas_status_id?.canonical_id, 'pfas_not_present_inert_material')

const coatingsCheck = evaluateFieldRequirement(
  { ...structured, canonical_mappings: mappings },
  { field_path: 'coatings_and_finishes', required: true },
)
assert.equal(coatingsCheck.status, 'passed')

const triggers = detectPatternTriggers(structured, mappings, sources)
assert.equal(triggers.has('ptfe_primary_contact'), false)

const blockers = getCanonicalApprovalBlockers(mappings, { subcategory: 'cookware' })
assert.ok(!blockers.some((b) => b.includes('TAXONOMY_EXPANSION_REQUIRED')))

assert.equal(
  hasRecordedAmazonUrl(structured, sources),
  false,
  'Williams Sonoma catalog URL must not count as Amazon present',
)

assert.doesNotThrow(() => assertCookwareMaterialsResolved(structured, { product_name: 'All-Clad test' }))

const variants = [
  'stainless_steel_interior_aluminum_core',
  'stainless_steel_interior_graphite_core',
  'stainless_steel_5ply_aluminum_core',
  'stainless_steel_with_graphite_core',
  'stainless steel interior with graphite core',
]
for (const raw of variants) {
  const m = mapFixture(raw)
  assert.notEqual(
    m.mappings.primary_contact_material_id?.canonical_id,
    TAXONOMY_EXPANSION_REQUIRED,
    `primary expansion for ${raw}`,
  )
  assert.notEqual(
    m.mappings.substrate_material_id?.canonical_id,
    TAXONOMY_EXPANSION_REQUIRED,
    `substrate expansion for ${raw}`,
  )
}

console.log('compound-cookware-material: OK')
console.log(
  JSON.stringify(
    {
      compound,
      primary: mappings.primary_contact_material_id?.canonical_id,
      substrate: mappings.substrate_material_id?.canonical_id,
      pfas: mappings.pfas_status_id?.canonical_id,
      coatings: coatingsCheck.status,
      secondaries: structured.secondary_components?.map((c) => c.material_identity),
    },
    null,
    2,
  ),
)
