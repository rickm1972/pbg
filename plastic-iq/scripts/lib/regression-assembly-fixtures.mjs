/**
 * REGRESSION ONLY — Layer B assembleDisplay fixtures (Lodge, All-Clad, Caraway, T-Fal).
 *
 * Do NOT use for published baseline snapshot generation or diff-gate truth validation.
 * Published baselines must load approved DB/Gate truth via approvedPublishedTruth.ts.
 */
import { PUBLISHED_BASELINE_PRODUCT_IDS } from '../../src/lib/apr/publishedBaselineIds.ts'

const approvedScore = (overrides = {}) => ({
  pac_safety_score: 88,
  tier: 'Excellent',
  displayed_confidence_range: '85–91',
  transparency_badge: 'Documentation Incomplete',
  ...overrides,
})

const LODGE_NAME = 'Lodge 10.25 Inch Cast Iron Skillet'
const ALL_CLAD_NAME =
  'All-Clad G5 Graphite Core Stainless-Steel Fry Pan with Lid, 12 inch'
const CARAWAY_NAME = 'Caraway Nonstick Ceramic Frying Pan 10.5 Inch'
const TFAL_NAME =
  'T-Fal Ultimate Hard Anodized Nonstick Fry Pan Set 3 Piece: 8, 10.25, 12 inch'

export const backfillAssemblyInputs = {
  [PUBLISHED_BASELINE_PRODUCT_IDS.lodge]: {
    product: {
      product_id: PUBLISHED_BASELINE_PRODUCT_IDS.lodge,
      product_name: LODGE_NAME,
      brand: 'Lodge',
      amazon_url: 'https://www.amazon.com/Lodge-Skillet/dp/B00006JSUA',
      target_url: 'https://www.target.com/p/lodge-10-25-cast-iron-skillet/-/A-10291925',
      walmart_url: 'https://www.walmart.com/ip/Lodge-10-1-4-Cast-Iron-Skillet/596962815',
    },
    evidence: { evidence_id: 'ev-lodge', sources: [] },
    pageScore: approvedScore({ pac_safety_score: 96, tier: 'Excellent', transparency_badge: 'Fully Disclosed' }),
    whyThisScore: {
      primary_material_options: ['Cast iron'],
      secondary_materials_options: ['Cast iron'],
      coatings_finishes_options: ['None'],
      use_conditions_options: ['Oven heat with fat exposure', 'Stovetop heat with fat exposure'],
      disclosure_quality_options: ['Fully Disclosed'],
      certifications_options: ['None'],
    },
    productDescription:
      "Lodge uses cast iron as its food-contact surface. The disclosed food-contact material is inert for PAC exposure purposes and has minimal expected plastic-associated chemical migration under typical kitchen use. It's used for oven heat with fat exposure and stovetop heat with fat exposure; because cast iron is an inert material, routine heat and use conditions do not increase plastic-associated chemical migration.",
    normalizationComponents: [
      {
        component_role: 'primary_food_contact',
        material_id: 'cast_iron',
        material: 'Cast iron',
        material_hazard: 0.01,
        adjusted_migration_potential: 0.001,
        contact_intimacy: 1,
        exposure_severity: 0.2,
        severity_justification: 'Direct food contact',
        exposure_duration: 0.5,
        duration_justification: 'Typical cookware use',
      },
    ],
    rawSources: [],
  },
  [PUBLISHED_BASELINE_PRODUCT_IDS.allClad]: {
    product: {
      product_id: PUBLISHED_BASELINE_PRODUCT_IDS.allClad,
      product_name: ALL_CLAD_NAME,
      brand: 'All-Clad',
      affiliate_link: 'https://www.williams-sonoma.com/products/all-clad-g5-graphite-fry-pan-lid/',
    },
    evidence: { evidence_id: 'ev-allclad', sources: [] },
    pageScore: approvedScore({ pac_safety_score: 99, tier: 'Excellent' }),
    whyThisScore: {
      primary_material_options: ['Stainless steel of unspecified grade'],
      secondary_materials_options: ['Graphite core', 'Aluminum core'],
      coatings_finishes_options: ['None'],
      use_conditions_options: ['Oven heat with fat exposure', 'Stovetop heat with fat exposure'],
      disclosure_quality_options: ['Documentation Incomplete'],
      certifications_options: [
        'No third-party certification found; material family is identified, but the exact stainless steel grade/spec is not fully disclosed.',
      ],
    },
    productDescription:
      "All-Clad uses stainless steel of unspecified grade as its food-contact surface. Stainless steel of unspecified grade has low potential to release plastic-associated chemicals under typical use. It's used for oven heat with fat exposure and stovetop heat with fat exposure; because key food-contact chemistry is not fully disclosed, that uncertainty is reflected in the score and transparency badge.",
    normalizationComponents: [
      {
        component_role: 'primary_food_contact',
        material_id: 'stainless_steel_unspecified',
        material: 'Stainless steel (grade unspecified)',
        material_hazard: 0.03,
        adjusted_migration_potential: 0.01,
        contact_intimacy: 1,
        exposure_severity: 0.8,
        severity_justification: 'Direct food contact',
        exposure_duration: 0.5,
        duration_justification: 'Typical cookware use',
      },
    ],
    rawSources: [],
  },
  [PUBLISHED_BASELINE_PRODUCT_IDS.caraway]: {
    product: {
      product_id: PUBLISHED_BASELINE_PRODUCT_IDS.caraway,
      product_name: CARAWAY_NAME,
      brand: 'Caraway',
      amazon_url: 'https://www.amazon.com/dp/B09SS34H3K',
      target_url: 'https://www.target.com/p/caraway-home-10-5-ceramic-fry-pan/-/A-84082481',
    },
    evidence: { evidence_id: 'ev-caraway', sources: [] },
    pageScore: approvedScore({ pac_safety_score: 72, tier: 'Caution' }),
    whyThisScore: {
      primary_material_options: ['Ceramic nonstick coating (sol-gel) on aluminum core'],
      secondary_materials_options: ['Aluminum core', 'Stainless steel handle'],
      coatings_finishes_options: ['Ceramic nonstick coating (sol-gel)'],
      use_conditions_options: ['Oven heat with fat exposure', 'Stovetop heat with fat exposure'],
      disclosure_quality_options: ['Documentation Incomplete'],
      certifications_options: ['None'],
    },
    productDescription:
      "Caraway uses ceramic nonstick coating (sol-gel) on aluminum core as its food-contact surface. Ceramic nonstick coating (sol-gel) has moderate potential to release plastic-associated chemicals under typical use. It's used for oven heat and stovetop heat with fat exposure; because the exact coating formulation is not fully disclosed, that uncertainty is reflected in the score and transparency badge.",
    normalizationComponents: [
      {
        component_role: 'primary_food_contact',
        material_id: 'sol_gel_ceramic_nonstick_coating',
        material: 'Sol-gel ceramic nonstick coating',
        material_hazard: 0.35,
        adjusted_migration_potential: 0.2,
        contact_intimacy: 1,
        exposure_severity: 0.8,
        severity_justification: 'Direct food contact',
        exposure_duration: 0.5,
        duration_justification: 'Typical cookware use',
      },
    ],
    rawSources: [],
  },
  [PUBLISHED_BASELINE_PRODUCT_IDS.tfal]: {
    product: {
      product_id: PUBLISHED_BASELINE_PRODUCT_IDS.tfal,
      product_name: TFAL_NAME,
      brand: 'T-Fal',
      amazon_url: 'https://www.amazon.com/dp/B000AMAZON',
      target_url: 'https://www.target.com/p/t-fal-ultimate-hard-anodized-3pk-fry-pan-set/-/A-87417764',
      walmart_url:
        'https://www.walmart.com/ip/T-fal-Ultimate-Hard-Anodized-Non-Stick-Cookware-3-Piece-Frypan-Set-8-inch-10-25-inch-and-12-inch-Grey/83563821619',
    },
    evidence: { evidence_id: 'ev-tfal', sources: [] },
    pageScore: approvedScore({
      pac_safety_score: 2,
      tier: 'High Risk',
      transparency_badge: 'Documentation Incomplete',
    }),
    whyThisScore: {
      primary_material_options: ['PTFE nonstick coating, titanium reinforced'],
      secondary_materials_options: ['Hard anodized aluminum'],
      coatings_finishes_options: ['PTFE nonstick coating'],
      use_conditions_options: ['Stovetop heat with fat exposure'],
      disclosure_quality_options: ['Fully Disclosed'],
      certifications_options: ['None'],
    },
    productDescription:
      "T-Fal uses PTFE nonstick coating, titanium reinforced as its food-contact surface. PTFE nonstick coating, titanium reinforced is a PFAS-related nonstick coating and can release plastic-associated chemicals into food, particularly under high heat, scratching, or as the coating wears with use. It's used for stovetop heat with fat exposure, conditions associated with greater release potential for PFAS-related nonstick coatings.",
    normalizationComponents: [
      {
        component_role: 'primary_food_contact',
        material_id: 'ptfe_nonstick_titanium_reinforced',
        material: 'PTFE nonstick coating, titanium reinforced',
        material_hazard: 0.85,
        adjusted_migration_potential: 0.75,
        contact_intimacy: 1,
        exposure_severity: 0.9,
        severity_justification: 'Direct food contact',
        exposure_duration: 0.5,
        duration_justification: 'Typical cookware use',
      },
    ],
    rawSources: [],
  },
}

export const backfillBaselineSpecs = [
  { slug: 'lodge', product_id: PUBLISHED_BASELINE_PRODUCT_IDS.lodge },
  { slug: 'all-clad', product_id: PUBLISHED_BASELINE_PRODUCT_IDS.allClad },
  { slug: 'caraway', product_id: PUBLISHED_BASELINE_PRODUCT_IDS.caraway },
  { slug: 't-fal', product_id: PUBLISHED_BASELINE_PRODUCT_IDS.tfal },
]
