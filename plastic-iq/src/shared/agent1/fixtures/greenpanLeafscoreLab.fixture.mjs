/**
 * GreenPan v4 LeafScore review — context/PFOA distinction only, not lab report evidence.
 */

export const GREENPAN_LEAFSCORE_URL =
  'https://www.leafscore.com/eco-friendly-kitchen-products/why-we-no-longer-recommend-greenpan/'

export const GREENPAN_LEAFSCORE_EXCERPT = `Non-toxic non-stick cookware typically translates to pans with PFAS, PTFE, and PFOA free ceramic coatings.
The original GreenPan cookware uses a patented Thermolon™ ceramic non-stick coating that the company has at one time or another advertised as "completely toxin-free," "healthy," and "free of PFOA, PFAS, lead, and cadmium."
GreenPan advertises that its non-stick pans contain "0% toxins" and are "good for the environment."
But, according to the 2019 lawsuit, GreenPan's Thermolon™ coating contains several toxins, including:
- Potassium titanate – harmful if inhaled; potential carcinogen.
Again, we don't know for sure that GreenPan cookware contains or contained these chemicals, given that the lawsuit was dismissed.
What we do know is that GreenPan's other claims that its pans are free of PFOA are suspect.
All non-stick cookware produced in the United States has been free of PFOA since 2013, when Teflon stopped using them in its coating.
GreenPan did not publish any test reports in 2020.
As such, we have no current test results to show if these heavy metals or others are present in the cookware.`

export function buildGreenPanLeafscoreSource() {
  return {
    source_type: 'retailer',
    url: GREENPAN_LEAFSCORE_URL,
    title: "Should You Cook With GreenPan? It's Complicated - LeafScore",
    page_excerpt: GREENPAN_LEAFSCORE_EXCERPT,
  }
}

export function buildGreenPanV4LabStructuredEvidence() {
  return {
    product_identity: {
      subcategory: 'Cookware',
      brand: 'GreenPan',
      product_name: 'GreenPan Valencia Pro Ceramic Nonstick 10” Frying Pan Skillet with Lid',
    },
    primary_contact_material: {
      material_identity: 'hard_anodized_aluminum',
      confidence_label: 'manufacturer_confirmed',
    },
    coatings_and_finishes: [
      {
        coating_name: 'Thermolon Minerals Pro',
        coating_type: 'ceramic_nonstick_unverified',
      },
    ],
    safety_claims: {
      pfoa_free_claim: { claimed: true, source_quote: 'PFOA free' },
      pfas_free_marketing_claim: { claimed: true, source_quote: 'PFAS free ceramic' },
    },
    retailer_links: {
      manufacturer_direct_url:
        'https://www.greenpan.us/products/valencia-pro-ceramic-non-stick-covered-frypan-10-inch',
      amazon_url:
        'https://www.amazon.com/GreenPan-CC000670-001-Valencia-Toxin-Free-Dishwasher/dp/B074CVZ7MM',
    },
  }
}
