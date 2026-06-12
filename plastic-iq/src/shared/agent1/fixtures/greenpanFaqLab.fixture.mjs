/**
 * GreenPan FAQ toxins page — marketing/compliance claims, not lab report evidence.
 */

export const GREENPAN_FAQ_URL =
  'https://www.greenpan.us/pages/faqs-do-greenpan-products-have-toxins'

export const GREENPAN_FAQ_EXCERPT = `Our pans are toxin-free!
GreenPan frypans lack harmful chemicals and toxins such as PFAS (per- and polyfluoroalkyl substances), also known as forever chemicals, as well as PFOA, lead, and cadmium.
Every GreenPan product is coated with Thermolon™.
The base ingredient for Thermolon™ is Silicon and does not contain PTFE.
Thermolon™ was tested by third-party labs, and is certified safe according to USA Food & Drug Administration, German LFGB, Swiss government, and KTR standards.
We make our coating and pans toxin-free.
We've Created a Better Way to Cook PFAS-Free`

export function buildGreenPanFaqSource() {
  return {
    source_type: 'retailer',
    url: GREENPAN_FAQ_URL,
    title: 'Do GreenPan Products Have Toxins?',
    page_excerpt: GREENPAN_FAQ_EXCERPT,
  }
}
