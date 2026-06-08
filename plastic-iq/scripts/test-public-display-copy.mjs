#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { retailerListingMatchesProductVariant } from '../src/lib/retailerVariantMatch.ts'
import {
  publicRetailerSectionTitle,
  softenPublicDescription,
} from '../src/lib/publicProductDisplay.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const broken =
  "It's used for stovetop heat; because key food-contact chemistry is not fully disclosed, the score includes that uncertainty is reflected in the score and transparency badge."
const fixed = softenPublicDescription(broken)
assert.ok(!/the score includes that uncertainty/i.test(fixed))
console.log('✓ uncertainty sentence grammar')

const lodgeLegacy =
  'Lodge uses cast iron as its food-contact surface. The disclosed food-contact material is inert for PAC exposure purposes and has minimal expected plastic-associated chemical migration under typical kitchen use. It\'s used for oven heat with fat exposure and stovetop heat with fat exposure; because cast iron is an inert material, routine heat and use conditions do not increase plastic-associated chemical migration.'
const lodgeFixed = softenPublicDescription(lodgeLegacy)
assert.ok(!/plastic-associated chemical migration/i.test(lodgeFixed))
assert.ok(/cast iron is not a plastic- or PFAS-based food-contact material/i.test(lodgeFixed))
assert.ok(/even with oven and stovetop heat, including fat exposure/i.test(lodgeFixed))
assert.ok(!/oven heat with fat exposure and stovetop heat with fat exposure/i.test(lodgeFixed))
console.log('✓ Lodge non-PAC inert description soften')

assert.equal(
  retailerListingMatchesProductVariant(
    'Lodge 10.25 Inch Cast Iron Skillet',
    'https://www.walmart.com/ip/Lodge-12-Inch-Cast-Iron-Skillet/123',
    'Lodge 12 Inch Cast Iron Skillet',
    { strictMissingSize: true },
  ),
  false,
)
console.log('✓ walmart 12" blocked for 10.25" lodge')

const carawayLegacy =
  "It's used for oven heat and stovetop heat with fat exposure; because key food-contact chemistry is not fully disclosed, that uncertainty is reflected in the score and transparency badge."
const carawayFixed = softenPublicDescription(carawayLegacy)
assert.ok(/^It is used with oven and stovetop heat, including fat exposure\. Because/i.test(carawayFixed))

const awkward =
  'It is used with oven heat with fat exposure and stovetop heat, including fat exposure. Because key food-contact chemistry is not fully disclosed, that uncertainty is reflected in the score and transparency badge.'
assert.ok(
  /^It is used with oven and stovetop heat, including fat exposure\. Because/i.test(
    softenPublicDescription(awkward),
  ),
)
console.log('✓ Caraway use-condition grammar soften')

assert.equal(publicRetailerSectionTitle('Excellent'), 'Where to buy')
assert.equal(publicRetailerSectionTitle('High Risk'), 'Product listings')

const productPage = readFileSync(join(root, 'src/pages/ProductPage.tsx'), 'utf8')
assert.ok(/publicRetailerSectionTitle\(tier\)/.test(productPage))
assert.ok(/safer_alternatives_subhead/.test(productPage))
assert.ok(/safer_alternatives_footer/.test(productPage))
assert.ok(!/lower expected PAC exposure/i.test(productPage))
console.log('✓ ProductPage reads safer-alternatives copy from display')

console.log('\nAll public display copy tests passed')
