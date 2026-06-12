#!/usr/bin/env node
/**
 * Public product page — manufacturer source title fallbacks.
 * Run: npm run test:product-page-sources
 */
import assert from 'node:assert/strict'
import {
  isGenericManufacturerSourceTitle,
  manufacturerFallbackTitleFromUrl,
} from '../src/lib/publicSourceTitleFormat.ts'
import { publicSourceDisplayTitle, buildPublicDisplayContract } from '../src/lib/publicProductDisplayContract.ts'
import { buildPublicSourcesFromEvidence } from '../src/lib/publicSourceDisplay.ts'
import {
  buildGreenPanMisclassifiedSourcesEvidence,
  GREENPAN_PUBLIC_PRODUCT,
} from '../src/lib/fixtures/greenpanPublicPageSources.fixture.ts'

const contract = {
  reviewedProductName: 'ExampleBrand Hybrid Nonstick 10 Inch Frying Pan',
  primaryRetailerUrl: 'https://www.amazon.com/dp/example',
  brand: 'ExampleBrand',
}

for (const generic of ['Hybrid', 'Home', 'Shop', 'Product', 'Collections', 'Learn More']) {
  assert.ok(isGenericManufacturerSourceTitle(generic), `${generic} should be generic`)
}

const titled = publicSourceDisplayTitle(
  {
    url: 'https://hexclad.com/collections/fry-pans/products/10-inch-pan',
    title: 'Hybrid',
    public_label: 'Manufacturer',
    public_status: 'supporting',
  },
  contract,
)
assert.match(titled, /ExampleBrand/)
assert.match(titled, /Hybrid Nonstick 10 Inch Frying Pan/)
assert.ok(!/^Hybrid$/i.test(titled))

const meaningful = publicSourceDisplayTitle(
  {
    url: 'https://examplebrand.com/pages/materials',
    title: 'ExampleBrand TerraBond materials FAQ',
    public_label: 'Manufacturer',
    public_status: 'supporting',
  },
  contract,
)
assert.match(meaningful, /TerraBond materials FAQ/i)

assert.match(
  manufacturerFallbackTitleFromUrl('https://examplebrand.com/collections/fry-pans', 'ExampleBrand'),
  /ExampleBrand/i,
)

const gpEvidence = buildGreenPanMisclassifiedSourcesEvidence()
const gpContract = buildPublicDisplayContract(GREENPAN_PUBLIC_PRODUCT, gpEvidence)
const gpSources = buildPublicSourcesFromEvidence(gpEvidence, gpContract).filter(
  (s) => s.public_source_eligible !== false,
)
const gpManufacturer = gpSources.filter((s) => s.public_label === 'Manufacturer')
assert.ok(
  gpManufacturer.every((s) => /greenpan\.us/i.test(s.url)),
  'Manufacturer section must only include GreenPan brand-domain sources',
)
assert.ok(
  !gpManufacturer.some((s) => /hexclad|consumerreports|youtube|leafscore/i.test(`${s.url} ${s.title}`)),
  'third-party sources must not appear under Manufacturer',
)

console.log('All product page source title + grouping tests passed.')
