/**
 * GreenPan Gate 1 v6 matrix routing — granular subcategory without category field in identity.
 * Pattern fixture only; no product_id in resolver logic.
 */

import { buildCeramicOverHardAnodizedStructuredEvidence } from '../../canonical-taxonomy/fixtures/ceramicOverHardAnodized.fixture.mjs'

export const GREENPAN_V6_MATRIX_PRODUCT = {
  product_id: '860b2128-015b-4d8d-8710-7ad7751ec7c5',
  product_name: 'GreenPan Valencia Pro Ceramic Nonstick 10" Frying Pan Skillet with Lid',
  brand: 'GreenPan',
  category: 'Kitchen',
  subcategory: 'Frying Pan / Skillet',
}

/** Mirrors Agent 1 v6 structured_evidence.product_identity (no category in evidence blob). */
export function buildGreenPanV6MatrixStructuredEvidence() {
  const base = buildCeramicOverHardAnodizedStructuredEvidence()
  return {
    ...base,
    product_identity: {
      brand: GREENPAN_V6_MATRIX_PRODUCT.brand,
      subcategory: 'Frying Pan / Skillet',
      product_name: GREENPAN_V6_MATRIX_PRODUCT.product_name,
      sku_or_model: 'CC000670-001',
      country_null_code: 'NOT_DISCLOSED',
      country_of_origin: null,
    },
  }
}
