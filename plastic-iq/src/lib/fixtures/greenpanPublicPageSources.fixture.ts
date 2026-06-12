/**
 * GreenPan public page QA — misclassified Agent 1 sources (display-only tests).
 */

import type { ProductEvidence } from '../../types/agent'

export const GREENPAN_REVIEWED_NAME =
  'GreenPan Valencia Pro Ceramic Nonstick 10" Frying Pan Skillet with Lid'

export const GREENPAN_PUBLIC_PRODUCT = {
  product_name: GREENPAN_REVIEWED_NAME,
  brand: 'GreenPan',
  amazon_url:
    'https://www.amazon.com/GreenPan-CC000670-001-Valencia-Toxin-Free-Dishwasher/dp/B074CVZ7MM',
  target_url:
    'https://www.target.com/p/greenpan-valencia-pro-10-34-ceramic-frypan-with-lid-black/-/A-86482934',
  walmart_url:
    'https://www.walmart.com/ip/GreenPan-Valencia-Pro-Healthy-Ceramic-Nonstick-8-Fry-Pan/371763910',
}

export function buildGreenPanMisclassifiedSourcesEvidence(): ProductEvidence {
  return {
    sources: [
      {
        source_type: 'amazon',
        url: GREENPAN_PUBLIC_PRODUCT.amazon_url,
        title: 'Amazon listing',
        page_excerpt: 'Valencia Pro 10 inch ceramic frypan with lid',
      },
      {
        source_type: 'manufacturer',
        url: 'https://www.greenpan.us/products/valencia-pro-ceramic-non-stick-covered-frypan-10-inch',
        title: 'Valencia Pro — GreenPan',
        page_excerpt: 'Thermolon ceramic nonstick 10 inch covered frypan',
      },
      {
        source_type: 'manufacturer',
        url: 'https://www.consumerreports.org/cookware/best-nonstick-frying-pans-a123/',
        title: 'Best Nonstick Frying Pans - Consumer Reports',
        page_excerpt: 'Consumer Reports nonstick pan ratings',
      },
      {
        source_type: 'manufacturer',
        url: 'https://www.leafscore.com/eco-friendly-kitchen-products/greenpan-review/',
        title: 'LeafScore GreenPan review',
        page_excerpt: 'Third-party GreenPan assessment',
      },
      {
        source_type: 'manufacturer',
        url: 'https://www.leafscore.com/kitchen/hexclad-non-stick-pan-review/',
        title: 'Hexclad Non-Stick Pan Review: Read This Before Buying - LeafScore',
        page_excerpt: 'HexClad hybrid pan review',
      },
      {
        source_type: 'manufacturer',
        url: 'https://www.youtube.com/watch?v=example-greenpan-review',
        title: 'Best HEALTHY Non-Stick Pan? I Tested Caraway, GreenPan, Our ...',
        page_excerpt: 'YouTube cookware comparison',
      },
      {
        source_type: 'manufacturer',
        url: 'https://www.nytimes.com/wirecutter/reviews/non-toxic-cookware/',
        title: "You Can't Always Trust Claims on 'Non-Toxic' Cookware",
        page_excerpt: 'Wirecutter methodology context',
      },
    ],
    agent_metadata: {
      structured_evidence: {
        product_identity: {
          product_name: GREENPAN_REVIEWED_NAME,
          brand: 'GreenPan',
        },
        retailer_links: {
          amazon_url: GREENPAN_PUBLIC_PRODUCT.amazon_url,
          manufacturer_direct_url:
            'https://www.greenpan.us/products/valencia-pro-ceramic-non-stick-covered-frypan-10-inch',
        },
      },
      canonical_mappings: {
        provenance: {
          primary_contact_material: [
            'https://www.greenpan.us/products/valencia-pro-ceramic-non-stick-covered-frypan-10-inch',
          ],
        },
      },
    },
  } as ProductEvidence
}
