/**
 * Public source display eligibility (global rules).
 * Run: npx tsx scripts/test-public-source-display.mjs
 */
import { buildPublicSourcesFromEvidence } from '../src/lib/publicSourceDisplay.ts'
import { isVerifiedPublicRetailerUrl } from '../src/lib/publicRetailerLinks.ts'

const evidence = {
  sources: [
    { source_type: 'manufacturer', url: 'https://www.t-fal.com/product', title: 'T-Fal product page' },
    { source_type: 'amazon', url: 'https://www.amazon.com/dp/B000EXAMPLE', title: 'Amazon listing' },
    { source_type: 'target', url: 'https://www.target.com/p/wrong-sku', title: 'Target wrong model' },
    { source_type: 'other', url: 'https://www.shein.com/product', title: 'Shein listing' },
    { source_type: 'regulatory', url: 'https://www.pca.state.mn.us/pfas', title: 'Minnesota PCA' },
  ],
  agent_metadata: {
    warnings: [
      'Target URL mismatch — different product configuration: https://www.target.com/p/wrong-sku',
    ],
    structured_evidence: {
      retailer_links: {
        amazon_url: 'https://www.amazon.com/dp/B000EXAMPLE',
        manufacturer_direct_url: 'https://www.t-fal.com/product',
      },
    },
  },
}

const publicSources = buildPublicSourcesFromEvidence(evidence)
const urls = publicSources.map((s) => s.url)

const ok =
  urls.some((u) => u.includes('t-fal.com')) &&
  urls.some((u) => u.includes('amazon.com')) &&
  !urls.some((u) => u.includes('pca.state.mn.us')) &&
  !urls.some((u) => u.includes('shein.com')) &&
  !urls.some((u) => u.includes('target.com')) &&
  isVerifiedPublicRetailerUrl('https://www.amazon.com/dp/B000EXAMPLE', evidence, {
    product_name: 'T-Fal Ultimate Hard Anodized Fry Pan Set',
    amazon_url: 'https://www.amazon.com/dp/B000EXAMPLE',
  }) &&
  !isVerifiedPublicRetailerUrl('https://www.target.com/p/wrong-sku', evidence, {
    product_name: 'T-Fal Ultimate Hard Anodized Fry Pan Set',
    target_url: 'https://www.target.com/p/wrong-sku',
  })

console.log('public sources:', urls)

if (!ok) {
  console.error('FAIL')
  process.exit(1)
}
console.log('PASS')
