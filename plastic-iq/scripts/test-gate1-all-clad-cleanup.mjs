/**
 * Gate 1 cleanup regression: Williams Sonoma primary retailer, no inferred PFAS-free claim.
 */
import assert from 'node:assert/strict'
import { applyCanonicalMappings } from '../src/shared/canonical-taxonomy/map-structured-evidence.mjs'
import {
  hasPrimaryRetailerUrl,
  isNonAmazonPrimaryRetailerUrl,
  primaryRetailerCatalogUrl,
} from '../src/shared/agent1/amazon-source-consistency.mjs'
import {
  alignProductIdentityToPrimaryRetailer,
  applyRetailerSkuPrecedence,
  reconcileProductIdentityWarnings,
} from '../src/shared/agent1/gate1-product-identity.mjs'

const WS_URL = 'https://www.williams-sonoma.com/products/all-clad-g5-graphite-fry-pan-lid/'
const CATALOG_NAME = 'All-Clad G5 Graphite Core Stainless-Steel Fry Pan with Lid, 12 inch'

const structured = {
  product_identity: {
    subcategory: 'Cookware',
    product_name: 'All-Clad G5 Graphite Core Stainless Steel Skillet 12 Inch',
    brand: 'All-Clad',
  },
  primary_contact_material: {
    material_identity: 'stainless_steel_interior_5ply_graphite_aluminum_core',
    source_url: WS_URL,
  },
  coatings_and_finishes: [],
  secondary_components: [],
  safety_claims: {
    pfas_free_claim: {
      claimed: true,
      source_url: 'https://www.all-clad.com/cookware/collections/g5-graphite-core.html',
      structural_guarantee: true,
    },
  },
  retailer_links: {
    amazon_url: WS_URL,
    manufacturer_direct_url: 'https://www.all-clad.com/cookware/collections/g5-graphite-core.html',
  },
}

const product = { product_name: CATALOG_NAME }
alignProductIdentityToPrimaryRetailer(structured, product, [
  {
    url: WS_URL,
    title: CATALOG_NAME,
    source_type: 'other_retailer',
  },
])

assert.equal(structured.product_identity.product_name, CATALOG_NAME)

structured.product_identity.sku_or_model = 'GR112.55'
applyRetailerSkuPrecedence(structured, [], { retailerSkuOverride: '2477328' })
assert.equal(structured.product_identity.sku_or_model, '2477328')
assert.equal(structured.product_identity.manufacturer_context_sku, 'GR112.55')

const mappings = applyCanonicalMappings(structured, [])
assert.equal(mappings.primary_contact_material_id?.canonical_id, 'stainless_steel_unspecified')
assert.equal(mappings.pfas_status_id?.canonical_id, 'pfas_not_present_inert_material')
assert.equal(
  mappings.safety_claim_ids?.pfas_free_claim_structurally_verified?.canonical_id,
  undefined,
)

const warnings = reconcileProductIdentityWarnings(
  [
    'No Amazon listing found for this product; Williams Sonoma URL used as primary retailer source per catalog input.',
    'Product cataloged as 12 Inch but manufacturer pages consistently describe the skillet with lid as 12.5 inch; no separate 12-inch SKU confirmed in retrieval.',
  ],
  structured,
  product,
)
assert.ok(!warnings.some((w) => /cataloged as 12 Inch but manufacturer.*12\.5/i.test(w)))
assert.ok(warnings.some((w) => /Williams Sonoma retailer listing identifies this SKU/i.test(w)))
assert.ok(warnings.some((w) => /No Amazon listing found; Williams Sonoma used as primary retailer source/i.test(w)))

assert.equal(hasPrimaryRetailerUrl(structured), true)
assert.equal(isNonAmazonPrimaryRetailerUrl(primaryRetailerCatalogUrl(structured)), true)
assert.equal(
  isNonAmazonPrimaryRetailerUrl('https://www.amazon.com/dp/B00EXAMPLE'),
  false,
)

console.log('gate1-all-clad-cleanup: OK')
