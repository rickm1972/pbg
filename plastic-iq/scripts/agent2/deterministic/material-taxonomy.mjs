/**
 * Material taxonomy — single conservative hazard + migration per material_id.
 * Agent 2 assigns exactly these values; CI bands remain Agent 3-only.
 */

/** @typedef {'primary_food_contact'|'formulation'|'handle'|'lid'|'rivet'|'gasket'|'packaging'|'coating'|'structural'} ComponentRole */

/**
 * @typedef {object} MaterialEntry
 * @property {string} name
 * @property {number} hazard
 * @property {number} migration
 * @property {string} tier
 * @property {string} hazardTableEntry
 * @property {string} migrationTableEntry
 * @property {ComponentRole[]} roles
 * @property {string[]} [primaryOptions]
 * @property {string[]} [secondaryOptions]
 * @property {string[]} [coatingOptions]
 * @property {boolean} [inertProtection]
 * @property {boolean} [unknownFoodContactCoating]
 * @property {boolean} [riskDashboardDominant] — cap-dominant Material/Migration bars (UI)
 * @property {string} [categoryForDescription] — plain-language category for product description copy
 */

/** @type {Record<string, MaterialEntry>} */
export const MATERIAL_TAXONOMY = {
  cast_iron: {
    name: 'Cast iron',
    hazard: 0.03,
    migration: 0.035,
    tier: 'Inert',
    hazardTableEntry: 'cast iron 0.03 (Inert 0.01–0.05)',
    migrationTableEntry: 'Inert range 0.02–0.05; midpoint 0.035',
    roles: ['primary_food_contact', 'handle'],
    primaryOptions: ['Cast iron'],
    inertProtection: true,
  },
  cast_iron_seasoned: {
    name: 'Cast iron (pre-seasoned with natural vegetable oil)',
    hazard: 0.03,
    migration: 0.035,
    tier: 'Inert',
    hazardTableEntry: 'cast iron 0.03 (Inert 0.01–0.05)',
    migrationTableEntry: 'Inert range 0.02–0.05; midpoint 0.035',
    roles: ['primary_food_contact'],
    primaryOptions: ['Cast iron'],
    coatingOptions: ['Natural vegetable oil seasoning'],
    inertProtection: true,
  },
  carbon_steel: {
    name: 'Carbon steel',
    hazard: 0.03,
    migration: 0.035,
    tier: 'Inert',
    hazardTableEntry: 'carbon steel — 0.03 (Inert band)',
    migrationTableEntry: 'Inert range 0.02–0.05; midpoint 0.035',
    roles: ['primary_food_contact'],
    primaryOptions: ['Carbon steel'],
    inertProtection: true,
  },
  plant_mineral_formulation: {
    name: 'Plant- and mineral-based aqueous formulation',
    hazard: 0.08,
    migration: 0.1,
    tier: 'Natural low risk',
    hazardTableEntry: 'certified organic clean formulation — 0.08',
    migrationTableEntry: 'full ingredient disclosure clean formulation — 0.10',
    roles: ['formulation'],
    primaryOptions: ['Plant- and mineral-based formulation'],
  },
  plant_based_formulation: {
    name: 'Plant-based formulation',
    hazard: 0.1,
    migration: 0.12,
    tier: 'Natural low risk',
    hazardTableEntry: 'plant-based formulation — 0.10',
    migrationTableEntry: 'plant-based formulation — 0.12',
    roles: ['formulation'],
    primaryOptions: ['Plant-based formulation'],
  },
  synthetic_surfactant_formulation: {
    name: 'Synthetic surfactant formulation',
    hazard: 0.35,
    migration: 0.38,
    tier: 'Moderate',
    hazardTableEntry: 'synthetic surfactant formulation — 0.35',
    migrationTableEntry: 'synthetic surfactant formulation — 0.38',
    roles: ['formulation'],
    primaryOptions: ['Synthetic surfactant formulation'],
  },
  stainless_steel_304: {
    name: 'Stainless steel 304',
    hazard: 0.03,
    migration: 0.02,
    tier: 'Inert',
    hazardTableEntry: 'SS304 — 0.03',
    migrationTableEntry: 'Inert: stainless steel 0.02',
    roles: ['primary_food_contact', 'handle', 'rivet', 'structural'],
    primaryOptions: ['Stainless steel 304'],
    secondaryOptions: ['Stainless steel handle', 'Stainless steel rivets'],
    inertProtection: true,
  },
  stainless_steel_316: {
    name: 'Stainless steel 316',
    hazard: 0.02,
    migration: 0.02,
    tier: 'Inert',
    hazardTableEntry: 'SS316 — 0.02',
    migrationTableEntry: 'Inert: stainless steel 0.02',
    roles: ['primary_food_contact', 'structural'],
    primaryOptions: ['Stainless steel 316'],
    inertProtection: true,
  },
  stainless_steel_unspecified: {
    name: 'Stainless steel (grade unspecified)',
    hazard: 0.03,
    migration: 0.02,
    tier: 'Inert',
    hazardTableEntry: 'SS304 — 0.03 (grade unspecified; conservative)',
    migrationTableEntry: 'Inert: stainless steel 0.02',
    roles: ['primary_food_contact', 'structural'],
    primaryOptions: ['Stainless steel grade unspecified'],
    secondaryOptions: ['Stainless steel grade unspecified'],
    inertProtection: true,
  },
  /** Agent 1 primary_contact_material.undisclosed_code === PROPRIETARY_NAMED */
  proprietary_named_food_contact: {
    name: 'Unknown proprietary food-contact coating (PROPRIETARY_NAMED)',
    hazard: 0.8,
    migration: 0.875,
    tier: 'Extreme',
    hazardTableEntry:
      'unknown proprietary food-contact coating — 0.80 (TRIGGERS HARD CAP AT 72 + Layer 4A -3)',
    migrationTableEntry:
      'Extreme-risk migration band lower midpoint 0.875 (server-enforced for undisclosed food-contact coatings)',
    roles: ['primary_food_contact', 'coating'],
    primaryOptions: ['Proprietary ceramic coating (undisclosed)'],
    coatingOptions: ['Proprietary ceramic nonstick (undisclosed)'],
    unknownFoodContactCoating: true,
  },
  hybrid_stainless_nonstick_food_contact: {
    name: 'Hybrid stainless lattice + nonstick surface',
    hazard: 0.35,
    migration: 0.38,
    tier: 'Moderate',
    hazardTableEntry: 'Hybrid stainless + nonstick food-contact — 0.35 (coated surface; inert protection blocked)',
    migrationTableEntry: 'Hybrid nonstick food-contact — 0.38 (coated surface; inert protection blocked)',
    roles: ['primary_food_contact', 'coating'],
    primaryOptions: ['Hybrid stainless + nonstick food-contact surface'],
    coatingOptions: ['Proprietary ceramic nonstick (undisclosed)', 'Ceramic nonstick sol-gel coating'],
    inertProtection: false,
  },
  terrabond_proprietary: {
    name: 'Proprietary ceramic nonstick coating (TerraBond™)',
    hazard: 0.35,
    migration: 0.38,
    tier: 'Moderate',
    hazardTableEntry: 'Ceramic nonstick sol-gel — 0.35 (category-known proprietary ceramic)',
    migrationTableEntry: 'Ceramic nonstick sol-gel — 0.38 (category-known proprietary ceramic)',
    roles: ['primary_food_contact', 'coating'],
    primaryOptions: ['Proprietary ceramic coating (undisclosed)'],
    coatingOptions: ['Proprietary ceramic nonstick (undisclosed)'],
    inertProtection: false,
  },
  ceramic_nonstick_sol_gel: {
    name: 'Ceramic nonstick sol-gel coating',
    hazard: 0.35,
    migration: 0.38,
    tier: 'Moderate',
    hazardTableEntry: 'Ceramic nonstick sol-gel — 0.35',
    migrationTableEntry: 'Ceramic nonstick sol-gel — 0.38',
    roles: ['primary_food_contact', 'coating'],
    primaryOptions: ['Ceramic nonstick sol-gel coating'],
    coatingOptions: ['Ceramic nonstick sol-gel coating'],
  },
  thermolon_ceramic: {
    name: 'Thermolon ceramic coating',
    hazard: 0.35,
    migration: 0.38,
    tier: 'Moderate',
    hazardTableEntry: 'Thermolon ceramic — 0.35',
    migrationTableEntry: 'Thermolon ceramic — 0.38',
    roles: ['primary_food_contact', 'coating'],
    primaryOptions: ['Thermolon ceramic coating'],
    coatingOptions: ['Thermolon ceramic nonstick coating'],
  },
  ptfe_coating: {
    name: 'PTFE coating (lower band)',
    hazard: 0.6,
    migration: 0.65,
    tier: 'Moderate',
    hazardTableEntry: 'PTFE coating (lower band) — 0.60',
    migrationTableEntry: 'PTFE coating (lower band) — 0.65',
    roles: ['primary_food_contact', 'coating'],
    primaryOptions: ['PTFE coating'],
    coatingOptions: ['PTFE nonstick coating'],
  },
  ptfe_nonstick: {
    name: 'PTFE nonstick coating',
    hazard: 0.85,
    migration: 0.75,
    tier: 'High',
    hazardTableEntry: 'PTFE nonstick coating — 0.85',
    migrationTableEntry: 'PTFE nonstick coating — 0.75',
    roles: ['primary_food_contact', 'coating'],
    primaryOptions: ['PTFE nonstick coating'],
    coatingOptions: ['PTFE nonstick coating'],
  },
  ptfe_nonstick_titanium_reinforced: {
    name: 'PTFE nonstick coating (titanium reinforced)',
    hazard: 0.85,
    migration: 0.75,
    tier: 'High',
    hazardTableEntry: 'PTFE nonstick coating (titanium reinforced) — 0.85',
    migrationTableEntry: 'PTFE nonstick coating (titanium reinforced) — 0.75',
    roles: ['primary_food_contact', 'coating'],
    primaryOptions: ['PTFE nonstick coating (titanium reinforced)'],
    coatingOptions: ['PTFE nonstick coating (titanium reinforced)'],
  },
  hard_anodized_aluminum: {
    name: 'Hard anodized aluminum',
    hazard: 0.2,
    migration: 0.15,
    tier: 'Moderate',
    hazardTableEntry: 'hard anodized aluminum — 0.20',
    migrationTableEntry: 'hard anodized aluminum — 0.15',
    roles: ['primary_food_contact', 'structural'],
    primaryOptions: ['Hard anodized aluminum'],
  },
  silicone_over_riveted_base: {
    name: 'Silicone-coated handle',
    hazard: 0.1,
    migration: 0.08,
    tier: 'Low risk',
    hazardTableEntry: 'silicone-coated handle — 0.10',
    migrationTableEntry: 'silicone-coated handle — 0.08',
    roles: ['handle'],
    primaryOptions: ['Silicone-coated handle'],
  },
  vitreous_enamel: {
    name: 'Vitreous enamel',
    hazard: 0.05,
    migration: 0.05,
    tier: 'Inert',
    hazardTableEntry: 'food-safe ceramic verified glaze — 0.05',
    migrationTableEntry: 'vitreous enamel — 0.05',
    roles: ['primary_food_contact', 'coating'],
    primaryOptions: ['Vitreous enamel over cast iron'],
    coatingOptions: ['Vitreous enamel glaze'],
    inertProtection: true,
  },
  vegetable_oil_seasoning: {
    name: 'Natural vegetable oil seasoning',
    hazard: 0.08,
    migration: 0.08,
    tier: 'Natural low risk',
    hazardTableEntry: 'natural vegetable oil seasoning — 0.08',
    migrationTableEntry: 'natural vegetable oil seasoning — 0.08',
    roles: ['coating'],
    coatingOptions: ['Natural vegetable oil seasoning'],
  },
  laser_etched_stainless_surface: {
    name: 'Laser-etched stainless steel cooking surface',
    hazard: 0.03,
    migration: 0.02,
    tier: 'Inert',
    hazardTableEntry: 'SS304 — 0.03 (laser-etched peaks)',
    migrationTableEntry: 'Inert: stainless steel 0.02',
    roles: ['primary_food_contact', 'coating'],
    primaryOptions: ['Stainless steel grade unspecified'],
    coatingOptions: ['Laser-etched stainless steel surface'],
    inertProtection: true,
  },
  hard_anodized_aluminum: {
    name: 'Hard anodized aluminum',
    hazard: 0.15,
    migration: 0.2,
    tier: 'Lower-risk synthetic',
    hazardTableEntry: 'aluminum anodized — 0.15',
    migrationTableEntry: 'hard anodized aluminum — 0.20',
    roles: ['primary_food_contact', 'structural'],
    primaryOptions: ['Hard anodized aluminum'],
    coatingOptions: ['Hard anodized finish'],
  },
  aluminum_core: {
    name: 'Aluminum core',
    hazard: 0.22,
    migration: 0.25,
    tier: 'Lower-risk synthetic',
    hazardTableEntry: 'aluminum uncoated — 0.22',
    migrationTableEntry: 'aluminum core — 0.25',
    roles: ['structural'],
    primaryOptions: ['Aluminum core'],
    secondaryOptions: ['Aluminum core'],
  },
  graphite_core: {
    name: 'Graphite structural core',
    hazard: 0.02,
    migration: 0.02,
    tier: 'Inert',
    hazardTableEntry: 'Graphite bonded core — structural (not food-contact)',
    migrationTableEntry: 'Inert: internal structural layer 0.02',
    roles: ['structural'],
    primaryOptions: ['Graphite core (structural)'],
    secondaryOptions: ['Graphite core layer'],
    inertProtection: true,
  },
  tempered_glass_lid: {
    name: 'Tempered glass lid',
    hazard: 0.02,
    migration: 0.02,
    tier: 'Inert',
    hazardTableEntry: 'tempered glass — 0.02',
    migrationTableEntry: 'tempered glass — 0.02',
    roles: ['lid'],
    secondaryOptions: ['Tempered glass lid'],
    inertProtection: true,
  },
  plastic_lid_unspecified: {
    name: 'Plastic lid (resin unspecified)',
    hazard: 0.2,
    migration: 0.29,
    tier: 'Lower-risk synthetic',
    hazardTableEntry: 'plastic lid resin unspecified — 0.20',
    migrationTableEntry: 'Lower risk synthetics — 0.29',
    roles: ['lid'],
    secondaryOptions: ['Plastic lid resin unspecified'],
  },
  bpa_free_plastic_lid: {
    name: 'BPA-free plastic lid',
    hazard: 0.2,
    migration: 0.29,
    tier: 'Lower-risk synthetic',
    hazardTableEntry: 'BPA-free plastic lid — 0.20',
    migrationTableEntry: 'Lower risk synthetics — 0.29',
    roles: ['lid'],
    secondaryOptions: ['BPA-free plastic lid'],
  },
  bamboo_lid_silicone: {
    name: 'Bamboo lid with silicone seal',
    hazard: 0.12,
    migration: 0.15,
    tier: 'Natural low risk',
    hazardTableEntry: 'bamboo lid — 0.12',
    migrationTableEntry: 'bamboo lid with silicone — 0.15',
    roles: ['lid'],
    secondaryOptions: ['Bamboo lid with silicone seal'],
  },
  stainless_steel_handle: {
    name: 'Stainless steel handle',
    hazard: 0.03,
    migration: 0.02,
    tier: 'Inert',
    hazardTableEntry: 'SS304 — 0.03 (handle)',
    migrationTableEntry: 'Inert: stainless steel 0.02',
    roles: ['handle'],
    secondaryOptions: ['Stainless steel handle'],
    inertProtection: true,
  },
  stay_cool_handle_undisclosed: {
    name: 'Stay-cool handle (material undisclosed)',
    hazard: 0.15,
    migration: 0.2,
    tier: 'Lower-risk synthetic',
    hazardTableEntry: 'undisclosed stay-cool handle — pending server inference',
    migrationTableEntry: 'undisclosed handle — pending server inference',
    roles: ['handle'],
    secondaryOptions: ['Stay-cool handle material unspecified'],
  },
  cast_iron_integrated_handle: {
    name: 'Integrated cast iron handle',
    hazard: 0.03,
    migration: 0.035,
    tier: 'Inert',
    hazardTableEntry: 'cast iron 0.03 (integrated handle)',
    migrationTableEntry: 'Inert range 0.02–0.05',
    roles: ['handle'],
    inertProtection: true,
  },
  tpr_soft_grip_handle: {
    name: 'TPR soft grip handle',
    hazard: 0.38,
    migration: 0.4,
    tier: 'Moderate',
    hazardTableEntry: 'thermoplastic rubber (TPR) — 0.38',
    migrationTableEntry: 'TPR handle — 0.40',
    roles: ['handle'],
    secondaryOptions: ['TPR soft grip handle'],
  },
  stainless_steel_rivets: {
    name: 'Stainless steel rivets',
    hazard: 0.03,
    migration: 0.02,
    tier: 'Inert',
    hazardTableEntry: 'SS304 rivets — 0.03',
    migrationTableEntry: 'Inert: stainless steel 0.02',
    roles: ['rivet'],
    secondaryOptions: ['Stainless steel rivets'],
    inertProtection: true,
  },
  silicone_gasket_verified: {
    name: 'Silicone gasket (food-grade verified)',
    hazard: 0.15,
    migration: 0.18,
    tier: 'Lower-risk synthetic',
    hazardTableEntry: 'silicone food-grade verified — 0.15',
    migrationTableEntry: 'silicone gasket — 0.18',
    roles: ['gasket'],
    secondaryOptions: ['Silicone gasket food-grade verified'],
  },
  silicone_gasket_unverified: {
    name: 'Silicone gasket (unverified)',
    hazard: 0.25,
    migration: 0.3,
    tier: 'Lower-risk synthetic',
    hazardTableEntry: 'silicone unverified — 0.25',
    migrationTableEntry: 'silicone gasket — 0.30',
    roles: ['gasket'],
    secondaryOptions: ['Silicone gasket unverified'],
  },
  magnetic_stainless_base: {
    name: 'Magnetic stainless steel base',
    hazard: 0.03,
    migration: 0.02,
    tier: 'Inert',
    hazardTableEntry: 'SS304 magnetic base — 0.03',
    migrationTableEntry: 'Inert: stainless steel 0.02',
    roles: ['structural'],
    secondaryOptions: ['Magnetic stainless steel base'],
    inertProtection: true,
  },
  refill_container_hdpe_unspecified: {
    name: 'Refill container (HDPE or similar, resin unspecified)',
    hazard: 0.18,
    migration: 0.29,
    tier: 'Lower-risk synthetic',
    hazardTableEntry: 'HDPE 0.18 (resin unspecified; conservative)',
    migrationTableEntry: 'Lower risk synthetics midpoint 0.29',
    roles: ['packaging'],
    secondaryOptions: ['Refill container (non-product-contact)'],
  },
  hdpe: {
    name: 'HDPE',
    hazard: 0.18,
    migration: 0.29,
    tier: 'Lower-risk synthetic',
    hazardTableEntry: 'HDPE — 0.18',
    migrationTableEntry: 'HDPE — 0.29',
    roles: ['packaging', 'primary_food_contact'],
    primaryOptions: ['HDPE'],
    secondaryOptions: ['Recyclable plastic packaging'],
  },
  borosilicate_glass: {
    name: 'Borosilicate glass',
    hazard: 0.02,
    migration: 0.02,
    tier: 'Inert',
    hazardTableEntry: 'borosilicate glass — 0.02',
    migrationTableEntry: 'borosilicate glass — 0.02',
    roles: ['primary_food_contact'],
    primaryOptions: ['Borosilicate glass'],
    inertProtection: true,
  },
  tempered_glass: {
    name: 'Tempered glass',
    hazard: 0.02,
    migration: 0.02,
    tier: 'Inert',
    hazardTableEntry: 'tempered glass — 0.02',
    migrationTableEntry: 'tempered glass — 0.02',
    roles: ['primary_food_contact'],
    primaryOptions: ['Tempered glass'],
    inertProtection: true,
  },
  tritan: {
    name: 'Tritan plastic',
    hazard: 0.45,
    migration: 0.48,
    tier: 'Moderate',
    hazardTableEntry: 'Tritan BPA-free claim — 0.45',
    migrationTableEntry: 'Tritan — 0.48',
    roles: ['primary_food_contact', 'packaging'],
    primaryOptions: ['Tritan plastic'],
  },
  bpa_free_plastic_unspecified: {
    name: 'BPA-free plastic (resin unspecified)',
    hazard: 0.2,
    migration: 0.29,
    tier: 'Lower-risk synthetic',
    hazardTableEntry: 'BPA-free plastic unspecified — 0.20',
    migrationTableEntry: 'Lower risk synthetics — 0.29',
    roles: ['packaging', 'primary_food_contact'],
    primaryOptions: ['BPA-free plastic resin unspecified'],
  },
  teak_wood: {
    name: 'Natural teak wood',
    hazard: 0.06,
    migration: 0.08,
    tier: 'Natural low risk',
    hazardTableEntry: 'teak untreated — 0.06',
    migrationTableEntry: 'natural teak — 0.08',
    roles: ['primary_food_contact'],
    primaryOptions: ['Natural teak wood'],
  },
  bamboo_natural: {
    name: 'Natural bamboo',
    hazard: 0.08,
    migration: 0.1,
    tier: 'Natural low risk',
    hazardTableEntry: 'bamboo natural — 0.08',
    migrationTableEntry: 'bamboo natural — 0.10',
    roles: ['primary_food_contact'],
    primaryOptions: ['Natural bamboo'],
  },
  nylon_food_contact: {
    name: 'Nylon food-contact',
    hazard: 0.68,
    migration: 0.7,
    tier: 'High',
    hazardTableEntry: 'nylon food-contact — 0.68',
    migrationTableEntry: 'nylon food-contact — 0.70',
    roles: ['primary_food_contact'],
    primaryOptions: ['Nylon food-contact'],
  },
  titanium: {
    name: 'Titanium',
    hazard: 0.01,
    migration: 0.02,
    tier: 'Inert',
    hazardTableEntry: 'titanium — 0.01 (Inert)',
    migrationTableEntry: 'titanium — 0.02',
    roles: ['primary_food_contact', 'structural'],
    primaryOptions: ['Titanium'],
    inertProtection: true,
  },
  food_grade_copper_lined: {
    name: 'Food-grade copper (lined)',
    hazard: 0.05,
    migration: 0.05,
    tier: 'Inert',
    hazardTableEntry: 'food-grade copper (lined) — 0.05',
    migrationTableEntry: 'food-grade copper (lined) — 0.05',
    roles: ['primary_food_contact'],
    primaryOptions: ['Food-grade copper (lined)'],
    inertProtection: true,
  },
  bare_copper_acidic_food_contact: {
    name: 'Bare copper (acidic-food contact)',
    hazard: 0.55,
    migration: 0.6,
    tier: 'High',
    hazardTableEntry: 'bare copper acidic-food contact — 0.55',
    migrationTableEntry: 'bare copper acidic-food contact — 0.60',
    roles: ['primary_food_contact'],
    primaryOptions: ['Bare copper (acidic-food contact)'],
  },
  food_safe_ceramic_verified_glaze: {
    name: 'Food-safe ceramic (verified glaze)',
    hazard: 0.05,
    migration: 0.05,
    tier: 'Inert',
    hazardTableEntry: 'food-safe ceramic verified glaze — 0.05',
    migrationTableEntry: 'food-safe ceramic verified glaze — 0.05',
    roles: ['primary_food_contact', 'coating'],
    primaryOptions: ['Food-safe ceramic (verified glaze)'],
    inertProtection: true,
  },
}

/** Ordered patterns — first match wins; negative PTFE claims must not match ptfe_coating. */
export const MATERIAL_DETECTORS = [
  { id: 'plant_mineral_formulation', pattern: /plant.and.mineral|decyl glucoside|coco-glucoside|sodium phytate/i },
  { id: 'plant_based_formulation', pattern: /plant.based formula|plant derived|saponified|coconut oil soap/i },
  { id: 'synthetic_surfactant_formulation', pattern: /sles|sodium lauryl sulfate|synthetic surfactant|mit\/bit preservative/i },
  { id: 'cast_iron_seasoned', pattern: /cast iron.*(?:season|vegetable oil)|pre.seasoned.*cast iron/i },
  { id: 'titanium', pattern: /\btitanium\b/i },
  { id: 'food_grade_copper_lined', pattern: /food.grade copper.*lined|lined copper/i },
  {
    id: 'bare_copper_acidic_food_contact',
    pattern: /bare copper.*acidic|acidic.food contact.*copper/i,
  },
  {
    id: 'food_safe_ceramic_verified_glaze',
    pattern: /food.safe ceramic.*verified|verified glaze/i,
  },
  { id: 'cast_iron', pattern: /cast iron|cast-iron/i },
  { id: 'carbon_steel', pattern: /carbon steel|blue steel/i },
  { id: 'terrabond_proprietary', pattern: /terrabond|terra\s*bond|proprietary.*ceramic.*nonstick/i },
  {
    id: 'ceramic_nonstick_sol_gel',
    pattern:
      /ceramic_nonstick_sol_gel|diamond[-\s]?infused.*ceramic|ceramic.*diamond[-\s]?infused|sol_gel_ceramic_nonstick|sol[-\s]?gel.*ceramic.*nonstick|ceramic.*non[-\s]?stick.*sol[-\s]?gel|ceramic.*non[-\s]?stick/i,
  },
  { id: 'thermolon_ceramic', pattern: /thermolon/i },
  { id: 'ptfe_coating', pattern: /\bptfe\b|teflon/i, negative: /ptfe-free|without ptfe|no ptfe|pfas-free.*ptfe-free/i },
  { id: 'vitreous_enamel', pattern: /vitreous enamel|enameled cast iron/i },
  { id: 'laser_etched_stainless_surface', pattern: /laser.etched.*stainless|hexagonal peaks.*stainless/i },
  { id: 'stainless_steel_316', pattern: /\b316\b|18\/10|18-10/i },
  { id: 'stainless_steel_304', pattern: /\b304\b|18\/8|18-8/i },
  { id: 'stainless_steel_unspecified', pattern: /stainless steel|stainless/i },
  { id: 'hard_anodized_aluminum', pattern: /hard anodized|hard anodised/i },
  { id: 'aluminum_core', pattern: /aluminum core|aluminium core|aluminum_core|on_aluminum_core/i },
  { id: 'tempered_glass_lid', pattern: /tempered glass lid/i },
  { id: 'tempered_glass', pattern: /tempered glass/i },
  { id: 'borosilicate_glass', pattern: /borosilicate/i },
  { id: 'bpa_free_plastic_lid', pattern: /bpa.free.*lid|lid.*bpa.free/i },
  { id: 'plastic_lid_unspecified', pattern: /\blid\b.*(?:plastic|pp|pet|resin)/i },
  { id: 'bamboo_lid_silicone', pattern: /bamboo lid/i },
  { id: 'stainless_steel_rivets', pattern: /stainless steel rivets?/i },
  { id: 'stainless_steel_handle', pattern: /stainless steel handle/i },
  { id: 'stay_cool_handle_undisclosed', pattern: /stay.cool handle|handle material not disclosed|handle composition not/i },
  { id: 'cast_iron_integrated_handle', pattern: /integrated cast iron handle/i },
  { id: 'tpr_soft_grip_handle', pattern: /tpr|thermoplastic rubber|soft.grip handle/i },
  { id: 'refill_container_hdpe_unspecified', pattern: /refill bottle|refill pouch|hdpe or similar/i },
  { id: 'hdpe', pattern: /\bhdpe\b|high.density polyethylene/i },
  { id: 'tritan', pattern: /tritan|copolyester/i },
  { id: 'bpa_free_plastic_unspecified', pattern: /bpa.free.*plastic|plastic.*bpa.free/i },
  { id: 'teak_wood', pattern: /\bteak\b/i },
  { id: 'bamboo_natural', pattern: /natural bamboo|\bbamboo\b(?! lid)/i },
  { id: 'nylon_food_contact', pattern: /nylon.*(?:food|utensil|bristle)/i },
  { id: 'vegetable_oil_seasoning', pattern: /vegetable oil seasoning|100% natural vegetable oil|pre.seasoned with/i },
  { id: 'magnetic_stainless_base', pattern: /magnetic.*base|induction base/i },
  { id: 'silicone_gasket_verified', pattern: /silicone gasket.*food.grade|food.grade.*silicone gasket/i },
  { id: 'silicone_gasket_unverified', pattern: /silicone gasket|silicone seal|o-ring/i },
]

/**
 * @param {string} text
 * @param {{ allowPtfeNegative?: boolean }} [opts]
 */
export function detectMaterialId(text, opts = {}) {
  const blob = String(text ?? '')
  for (const row of MATERIAL_DETECTORS) {
    if (row.negative && row.negative.test(blob)) continue
    if (row.pattern.test(blob)) return row.id
  }
  return null
}

/** Agent 1 schema ids that map to canonical taxonomy keys. */
export const MATERIAL_ID_ALIASES = {
  ptfe: 'ptfe_nonstick',
  pfoa: 'ptfe_nonstick',
  teflon: 'ptfe_nonstick',
  stainless_steel_interior_graphite_aluminum_core_5ply: 'stainless_steel_unspecified',
}

/**
 * Agent 1 canonical material IDs → MATERIAL_TAXONOMY keys.
 * Only methodology-documented equivalences (see canonical-taxonomy agent2_material_id links).
 * Do not add ambiguous proprietary/hybrid/unknown coating aliases here.
 */
export const MATERIAL_TAXONOMY_ALIASES = {
  // Substrate taxonomy — explicit agent2_material_id links
  cast_iron_body: 'cast_iron',
  stainless_steel_body: 'stainless_steel_unspecified',
  graphite_structural_core: 'graphite_core',
  // Primary taxonomy — canonical_id differs from agent2_material_id
  ceramic_nonstick_sol_gel_coating: 'ceramic_nonstick_sol_gel',
  ceramic_nonstick_verified: 'ceramic_nonstick_sol_gel',
  ptfe_nonstick_coating: 'ptfe_nonstick',
  enameled_cast_iron_food_contact: 'vitreous_enamel',
  enamel_coating: 'vitreous_enamel',
  ceramic_food_contact: 'vitreous_enamel',
  glass_food_contact: 'borosilicate_glass',
  stainless_steel_18_8: 'stainless_steel_304',
  stainless_steel_18_10: 'stainless_steel_316',
  stainless_steel_cooking_surface: 'stainless_steel_unspecified',
}

/**
 * @param {string} materialId
 * @returns {string | null}
 */
export function getMaterialTaxonomyAliasTarget(materialId) {
  const raw = String(materialId ?? '').trim()
  if (!raw) return null
  if (MATERIAL_TAXONOMY_ALIASES[raw]) return MATERIAL_TAXONOMY_ALIASES[raw]
  if (MATERIAL_ID_ALIASES[raw]) return MATERIAL_ID_ALIASES[raw]
  return null
}

/**
 * Alias-aware material lookup metadata for Agent 1 validation (Phase 4.5).
 * @param {string | null | undefined} materialId — reviewed / Agent 1 canonical ID
 * @returns {{
 *   reviewed_canonical_material_id: string | null
 *   resolved_material_taxonomy_id: string | null
 *   alias_applied: boolean
 *   alias_target: string | null
 *   canonical_material_lookup_status: 'found' | 'alias_resolved' | 'missing' | 'expansion_required'
 *   material: MaterialEntry | null
 *   material_lookup_notes: string | null
 * }}
 */
export function resolveMaterialLookupMeta(materialId) {
  const reviewed = String(materialId ?? '').trim() || null
  if (!reviewed) {
    return {
      reviewed_canonical_material_id: null,
      resolved_material_taxonomy_id: null,
      alias_applied: false,
      alias_target: null,
      canonical_material_lookup_status: 'missing',
      material: null,
      material_lookup_notes: null,
    }
  }

  if (MATERIAL_TAXONOMY[reviewed]) {
    return {
      reviewed_canonical_material_id: reviewed,
      resolved_material_taxonomy_id: reviewed,
      alias_applied: false,
      alias_target: null,
      canonical_material_lookup_status: 'found',
      material: MATERIAL_TAXONOMY[reviewed],
      material_lookup_notes: null,
    }
  }

  const aliasTarget = getMaterialTaxonomyAliasTarget(reviewed)
  if (aliasTarget && MATERIAL_TAXONOMY[aliasTarget]) {
    return {
      reviewed_canonical_material_id: reviewed,
      resolved_material_taxonomy_id: aliasTarget,
      alias_applied: true,
      alias_target: aliasTarget,
      canonical_material_lookup_status: 'alias_resolved',
      material: MATERIAL_TAXONOMY[aliasTarget],
      material_lookup_notes: `Alias resolved ${reviewed} → ${aliasTarget} via MATERIAL_TAXONOMY_ALIASES`,
    }
  }

  const detected = detectMaterialId(reviewed.replace(/_/g, ' '))
  if (detected && MATERIAL_TAXONOMY[detected]) {
    return {
      reviewed_canonical_material_id: reviewed,
      resolved_material_taxonomy_id: detected,
      alias_applied: reviewed !== detected,
      alias_target: reviewed !== detected ? detected : null,
      canonical_material_lookup_status: reviewed !== detected ? 'alias_resolved' : 'found',
      material: MATERIAL_TAXONOMY[detected],
      material_lookup_notes:
        reviewed !== detected
          ? `Pattern-detected material ID ${reviewed} → ${detected}`
          : null,
    }
  }

  return {
    reviewed_canonical_material_id: reviewed,
    resolved_material_taxonomy_id: aliasTarget ?? reviewed,
    alias_applied: false,
    alias_target: aliasTarget,
    canonical_material_lookup_status:
      reviewed === 'TAXONOMY_EXPANSION_REQUIRED' ? 'expansion_required' : 'missing',
    material: null,
    material_lookup_notes: `ID ${reviewed} not in MATERIAL_TAXONOMY (${Object.keys(MATERIAL_TAXONOMY).length} entries)`,
  }
}

/** @param {string} materialId */
export function resolveMaterialId(materialId) {
  const meta = resolveMaterialLookupMeta(materialId)
  return meta.resolved_material_taxonomy_id ?? String(materialId ?? '').trim()
}

/** @param {string} materialId */
export function getMaterial(materialId) {
  const id = resolveMaterialId(materialId)
  return MATERIAL_TAXONOMY[id] ?? null
}

/** @param {string} materialId */
export function requireMaterial(materialId) {
  const id = resolveMaterialId(materialId)
  const m = MATERIAL_TAXONOMY[id]
  if (!m) throw new Error(`Unknown material_id: ${materialId}`)
  return m
}

/** Layer 4A -3, score cap 72, and Layer 4B Opaque — truly unknown proprietary food-contact coating only. */
export function isUnknownFoodContactCoatingMaterial(materialId) {
  return Boolean(MATERIAL_TAXONOMY[materialId]?.unknownFoodContactCoating)
}

/** Primary food-contact material that is itself a coating (not bare metal/glass). */
export function isFoodContactCoatingPrimaryMaterial(materialId) {
  const id = String(materialId ?? '')
  if (!id) return false
  if (isUnknownFoodContactCoatingMaterial(id)) return true
  const mat = MATERIAL_TAXONOMY[id]
  if (!mat) return /^ptfe|ceramic_nonstick|ceramic.*nonstick/i.test(id)
  const roles = mat.roles ?? []
  return roles.includes('primary_food_contact') && roles.includes('coating')
}

/** Cap-triggering materials dominate Risk Dashboard Material/Migration fills (not CI-averaged down). */
export function isRiskDashboardDominantMaterial(materialId) {
  const m = MATERIAL_TAXONOMY[materialId]
  return Boolean(m?.unknownFoodContactCoating || m?.riskDashboardDominant)
}

/** Explicit overrides — required for product description generation. */
const CATEGORY_FOR_DESCRIPTION_BY_ID = {
  cast_iron: 'inert material',
  cast_iron_seasoned: 'inert material',
  carbon_steel: 'inert material',
  cast_iron_integrated_handle: 'inert material',
  stainless_steel_304: 'inert material',
  stainless_steel_316: 'inert material',
  stainless_steel_unspecified: 'inert material',
  stainless_steel_handle: 'inert material',
  stainless_steel_rivets: 'inert material',
  magnetic_stainless_base: 'inert material',
  laser_etched_stainless_surface: 'inert material',
  borosilicate_glass: 'inert material',
  tempered_glass: 'inert material',
  tempered_glass_lid: 'inert material',
  vitreous_enamel: 'inert material',
  ptfe: 'PFAS',
  ptfe_coating: 'PFAS',
  ptfe_nonstick: 'PFAS',
  ptfe_nonstick_titanium_reinforced: 'PFAS',
  aluminum_core: 'reactive metal',
  hard_anodized_aluminum: 'reactive metal',
  proprietary_named_food_contact: 'undisclosed coating',
  terrabond_proprietary: 'undisclosed coating',
  plant_mineral_formulation: 'plant-based formulation',
  plant_based_formulation: 'plant-based formulation',
}

/**
 * @param {string} materialId
 * @param {MaterialEntry} entry
 */
function inferCategoryForDescription(materialId, entry) {
  if (CATEGORY_FOR_DESCRIPTION_BY_ID[materialId]) {
    return CATEGORY_FOR_DESCRIPTION_BY_ID[materialId]
  }
  if (entry.inertProtection || entry.tier === 'Inert') return 'inert material'
  if (entry.unknownFoodContactCoating) return 'undisclosed coating'
  if (/^ptfe|pfa|fep/i.test(materialId)) return 'PFAS'
  if (/aluminum|aluminium/i.test(materialId)) return 'reactive metal'
  if (/plant/i.test(materialId)) return 'plant-based formulation'
  if (/glass|enamel/i.test(materialId)) return 'inert material'
  if (entry.hazard < 0.1) return 'inert material'
  if (entry.hazard >= 0.5) return 'high-hazard food-contact material'
  return 'food-contact material'
}

for (const [id, entry] of Object.entries(MATERIAL_TAXONOMY)) {
  if (!entry.categoryForDescription) {
    entry.categoryForDescription = inferCategoryForDescription(id, entry)
  }
}

/**
 * @param {string} materialId
 */
export function getCategoryForDescription(materialId) {
  const id = resolveMaterialId(materialId)
  const entry = MATERIAL_TAXONOMY[id]
  if (!entry) return null
  return entry.categoryForDescription ?? inferCategoryForDescription(id, entry)
}

/**
 * @param {string} materialId
 */
export function requireCategoryForDescription(materialId) {
  const category = getCategoryForDescription(materialId)
  if (!category) {
    throw new Error(`Missing category_for_description in taxonomy: ${materialId}`)
  }
  return category
}
