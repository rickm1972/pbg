/**
 * Why This Score vocabulary labels per material_id + role.
 * Keep in sync with scripts/agent2/why-this-score-labels.mjs
 */

type MaterialRoleMap = Partial<
  Record<
    | 'primary_food_contact'
    | 'formulation'
    | 'coating'
    | 'handle'
    | 'lid'
    | 'rivet'
    | 'gasket'
    | 'packaging'
    | 'structural',
    string
  >
>

export const WHY_THIS_SCORE_BY_MATERIAL_ROLE: Record<string, MaterialRoleMap> = {
  cast_iron: { primary_food_contact: 'Cast iron', handle: 'Cast iron' },
  cast_iron_seasoned: {
    primary_food_contact: 'Cast iron',
    coating: 'Natural vegetable oil seasoning',
  },
  plant_mineral_formulation: { formulation: 'Plant- and mineral-based formulation' },
  plant_based_formulation: { formulation: 'Plant-based formulation' },
  synthetic_surfactant_formulation: { formulation: 'Synthetic surfactant formulation' },
  stainless_steel_304: {
    primary_food_contact: 'Stainless steel 304',
    handle: 'Stainless steel handle',
    rivet: 'Stainless steel rivets',
    structural: 'Stainless steel grade unspecified',
  },
  stainless_steel_316: {
    primary_food_contact: 'Stainless steel 316',
    structural: 'Stainless steel grade unspecified',
  },
  stainless_steel_unspecified: {
    primary_food_contact: 'Stainless steel grade unspecified',
    structural: 'Stainless steel grade unspecified',
  },
  proprietary_named_food_contact: {
    primary_food_contact: 'Proprietary ceramic coating (undisclosed)',
    coating: 'Proprietary ceramic nonstick (undisclosed)',
  },
  terrabond_proprietary: {
    primary_food_contact: 'Proprietary ceramic coating (undisclosed)',
    coating: 'Proprietary ceramic nonstick (undisclosed)',
  },
  thermolon_ceramic: {
    primary_food_contact: 'Thermolon ceramic coating',
    coating: 'Thermolon ceramic nonstick coating',
  },
  ptfe_coating: {
    primary_food_contact: 'PTFE coating',
    coating: 'PTFE nonstick coating',
  },
  ptfe_nonstick: {
    primary_food_contact: 'PTFE coating',
    coating: 'PTFE nonstick coating',
  },
  ptfe_nonstick_titanium_reinforced: {
    primary_food_contact: 'PTFE coating',
    coating: 'PTFE nonstick coating',
  },
  vitreous_enamel: {
    primary_food_contact: 'Vitreous enamel over cast iron',
    coating: 'Vitreous enamel glaze',
  },
  vegetable_oil_seasoning: { coating: 'Natural vegetable oil seasoning' },
  laser_etched_stainless_surface: {
    primary_food_contact: 'Laser-etched stainless steel surface',
  },
  hard_anodized_aluminum: {
    primary_food_contact: 'Hard anodized aluminum',
    structural: 'Hard anodized aluminum',
    coating: 'Hard anodized finish',
  },
  silicone_over_riveted_base: { handle: 'Silicone-coated handle' },
  aluminum_core: { structural: 'Aluminum core' },
  tempered_glass_lid: { lid: 'Tempered glass lid' },
  plastic_lid_unspecified: { lid: 'Plastic lid resin unspecified' },
  bpa_free_plastic_lid: { lid: 'BPA-free plastic lid' },
  bamboo_lid_silicone: { lid: 'Bamboo lid with silicone seal' },
  stainless_steel_handle: { handle: 'Stainless steel handle' },
  stay_cool_handle_undisclosed: { handle: 'Stay-cool handle material unspecified' },
  cast_iron_integrated_handle: { handle: 'Cast iron' },
  tpr_soft_grip_handle: { handle: 'TPR soft grip handle' },
  stainless_steel_rivets: { rivet: 'Stainless steel rivets' },
  silicone_gasket_verified: { gasket: 'Silicone gasket food-grade verified' },
  silicone_gasket_unverified: { gasket: 'Silicone gasket unverified' },
  magnetic_stainless_base: { structural: 'Magnetic stainless steel base' },
  refill_container_hdpe_unspecified: {
    packaging: 'Refill container (non-product-contact)',
  },
  hdpe: { packaging: 'Recyclable plastic packaging', primary_food_contact: 'HDPE' },
  borosilicate_glass: { primary_food_contact: 'Borosilicate glass' },
  tempered_glass: { primary_food_contact: 'Tempered glass' },
  tritan: { primary_food_contact: 'Tritan plastic' },
  bpa_free_plastic_unspecified: {
    primary_food_contact: 'BPA-free plastic resin unspecified',
    packaging: 'Recyclable plastic packaging',
  },
  teak_wood: { primary_food_contact: 'Natural teak wood' },
  bamboo_natural: { primary_food_contact: 'Natural bamboo' },
  nylon_food_contact: { primary_food_contact: 'Nylon food-contact' },
}

export function whyThisScoreLabelForComponent(
  materialId: string | undefined | null,
  role: string,
  field: 'primary' | 'secondary' | 'coating',
): string | null {
  const map = WHY_THIS_SCORE_BY_MATERIAL_ROLE[String(materialId ?? '')]
  if (!map) return null

  if (field === 'coating') return map.coating ?? null
  if (field === 'primary') {
    if (role === 'formulation') return map.formulation ?? null
    return map.primary_food_contact ?? map.formulation ?? null
  }
  if (field === 'secondary') {
    return (map as Record<string, string>)[role] ?? null
  }
  return null
}
