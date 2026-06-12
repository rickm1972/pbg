/**
 * Manufacturer PDP with hidden modal/dialog lab evidence (HexClad pattern, no product_id).
 */

export const FIXTURE_MODAL_PDP_URL = 'https://examplebrand.com/products/10-hybrid-fry-pan'

export const FIXTURE_MODAL_PDP_HTML = `<!DOCTYPE html><html><body>
<div class="product">
  <h1>ExampleBrand 10" Hybrid Fry Pan</h1>
  <p>Free From Forever Chemicals</p>
  <p>Our cookware features our proprietary TerraBond™ ceramic nonstick which is PFAS-free, ensuring a better cooking experience.</p>
  <button type="button" class="js-global-modal-trigger" data-modal-target-id="popup-labs2">Learn More</button>
</div>
<div id="popup-labs2" class="global-modal" hidden aria-hidden="true" style="display:none">
  <div class="TableLab">
    <div class="TableLab__title">Test Results Verified by 3rd Party Lab
      <div class="TableLab__logo"><img src="/logo-light-labs.png" alt="Logo of Light Labs"></div>
    </div>
    <div class="TableLab__description">
      <p>Tested our pots and pans for PFAS compounds and all results were below the laboratory's detection limits, known as "Non-Detect".</p>
    </div>
    <div class="TableLab__table">
      <div class="TableLab__table__row"><div>PFOS</div><div>Passed</div><div>Non-Detect</div></div>
      <div class="TableLab__table__row"><div>PTFE</div><div>Passed</div><div>Non-Detect</div></div>
      <div class="TableLab__table__row"><div>PFOA</div><div>Passed</div><div>Non-Detect</div></div>
      <div class="TableLab__table__row"><div>PFAS</div><div>Passed</div><div>Non-Detect</div></div>
      <div class="TableLab__table__row"><div>PFBS</div><div>Passed</div><div>Non-Detect</div></div>
      <div class="TableLab__table__row"><div>PFNA</div><div>Passed</div><div>Non-Detect</div></div>
    </div>
    <p>Any potential presence is so low it can't even be detected. We're talking less than a drop in an Olympic-sized pool.</p>
  </div>
</div>
</body></html>`

export const FIXTURE_MODAL_WRONG_REGION_URL = 'https://examplebrand.eu/'

export function buildManufacturerModalLabProduct() {
  return {
    product_name: 'ExampleBrand Hybrid Nonstick 10 Inch Fry Pan',
    brand: 'ExampleBrand',
    amazon_url: 'https://www.amazon.com/dp/B0EXAMPLE01',
    manufacturer_product_url: FIXTURE_MODAL_PDP_URL,
  }
}

export function buildManufacturerModalLabSource() {
  return {
    url: FIXTURE_MODAL_PDP_URL,
    title: 'ExampleBrand 10" Hybrid Fry Pan — manufacturer PDP',
    source_type: 'manufacturer',
    page_excerpt: `Free From Forever Chemicals TerraBond ceramic nonstick PFAS-free Learn More
--- manufacturer PDP modal/dialog evidence ---
Test Results Verified by 3rd Party Lab Logo of Light Labs Tested our pots and pans for PFAS compounds Non-Detect PFOS Passed Non-Detect PTFE Passed Non-Detect PFOA Passed Non-Detect PFAS Passed Non-Detect`,
    provided_intake: true,
    manufacturer_modal_evidence: true,
  }
}
