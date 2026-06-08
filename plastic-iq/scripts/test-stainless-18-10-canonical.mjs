/**
 * Regression: live All-Clad normalized IDs (stainless_steel_18_10) must not hit TAXONOMY_EXPANSION_REQUIRED.
 */
import assert from 'node:assert/strict'
import {
  applyCanonicalMappings,
  resolvePrimaryContactEntry,
  resolveSubstrateEntry,
} from '../src/shared/canonical-taxonomy/map-structured-evidence.mjs'
import { getCanonicalApprovalBlockers } from '../src/shared/canonical-taxonomy/score-driving-fields.mjs'
import { evaluateFieldRequirement } from '../src/shared/required-evidence-matrix/field-evaluators.mjs'
import { hasRecordedAmazonUrl } from '../src/shared/agent1/amazon-source-consistency.mjs'
import { TAXONOMY_EXPANSION_REQUIRED } from '../src/shared/canonical-taxonomy/constants.mjs'

const RAW = 'stainless_steel_18_10'

assert.equal(resolvePrimaryContactEntry(RAW)?.canonical_id, 'stainless_steel_18_10')
assert.equal(resolveSubstrateEntry(RAW)?.canonical_id, 'stainless_steel_body')

const structured = {
  product_identity: { subcategory: 'cookware' },
  primary_contact_material: {
    material_identity: RAW,
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
    page_excerpt: '18/10 stainless steel interior. No nonstick coating.',
    source_type: 'amazon',
  },
  {
    url: 'https://www.all-clad.com/g5-skillet',
    title: 'G5 Graphite Core',
    page_excerpt: 'stainless steel cooking surface',
    source_type: 'manufacturer',
  },
]

const mappings = applyCanonicalMappings(structured, sources)
const blockers = getCanonicalApprovalBlockers(mappings, { subcategory: 'cookware' })

assert.equal(mappings.primary_contact_material_id?.raw_value, RAW)
assert.equal(mappings.primary_contact_material_id?.canonical_id, 'stainless_steel_18_10')
assert.notEqual(mappings.primary_contact_material_id?.canonical_id, TAXONOMY_EXPANSION_REQUIRED)

assert.equal(mappings.substrate_material_id?.canonical_id, 'stainless_steel_body')
assert.equal(mappings.substrate_material_id?.raw_value, RAW)
assert.notEqual(mappings.substrate_material_id?.canonical_id, TAXONOMY_EXPANSION_REQUIRED)

assert.equal(mappings.coating_modifier_id?.canonical_id, 'no_coating_modifier')
assert.equal(mappings.pfas_status_id?.canonical_id, 'pfas_not_present_inert_material')

const coatingsCheck = evaluateFieldRequirement(
  { ...structured, canonical_mappings: mappings },
  { field_path: 'coatings_and_finishes', required: true },
)
assert.equal(coatingsCheck.status, 'passed')
assert.match(coatingsCheck.detail, /uncoated|all-metal/i)

assert.ok(!blockers.some((b) => b.includes('TAXONOMY_EXPANSION_REQUIRED')))

assert.equal(
  hasRecordedAmazonUrl({
    retailer_links: { amazon_url: 'https://www.williams-sonoma.com/products/x' },
  }),
  false,
)
assert.equal(
  hasRecordedAmazonUrl({
    retailer_links: { amazon_url: 'https://www.amazon.com/dp/B00EXAMPLE' },
  }),
  true,
)

console.log('stainless-18-10-canonical: OK')
console.log(
  JSON.stringify(
    {
      primary: mappings.primary_contact_material_id?.canonical_id,
      substrate: mappings.substrate_material_id?.canonical_id,
      pfas: mappings.pfas_status_id?.canonical_id,
      coatings: coatingsCheck.status,
    },
    null,
    2,
  ),
)
