import assert from 'node:assert/strict'
import {
  hasRecordedAmazonUrl,
  isAmazonUnavailableWarning,
  reconcileAmazonRetrievalWarnings,
} from '../src/shared/agent1/amazon-source-consistency.mjs'

assert.equal(isAmazonUnavailableWarning('Amazon URL was not available'), true)
assert.equal(isAmazonUnavailableWarning('Primary Amazon/retailer page retrieval did not return usable content'), false)

const structured = {
  retailer_links: { amazon_url: 'https://www.amazon.com/dp/B00EXAMPLE' },
}
const warnings = reconcileAmazonRetrievalWarnings(
  ['Amazon URL was not available'],
  structured,
  { ok: false, error: 'Anthropic returned no text for primary retailer retrieval' },
  [],
)
assert.equal(warnings.some((w) => isAmazonUnavailableWarning(w)), false)
assert.ok(warnings.some((w) => /catalog URL recorded as supporting link/i.test(w)))
assert.equal(hasRecordedAmazonUrl(structured, []), true)

console.log('amazon-source-consistency: OK')
