#!/usr/bin/env node
/**
 * Layer B — assembleDisplay.ts regression fixtures (Lodge, All-Clad, Caraway, T-Fal).
 * Run: npx tsx scripts/test-apr-assemble-display.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  assembleAprPublicRenderInput,
  finalizeAssembledProductDescription,
  secondaryEchoesPrimary,
  approvedTransparencyBadge,
  assembledDescriptionContainsUncertaintyLanguage,
  SAFER_ALTERNATIVES_SUBHEAD,
  SAFER_ALTERNATIVES_FOOTER,
  splitAssembledDescriptionSentences,
  assembledSentenceHasVerb,
} from '../src/lib/apr/assembleDisplay.ts'
import { alternativeProductBuyCtas } from '../src/lib/apr/alternativeBuyCta.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const NONE_DISTINCT = 'None distinct from primary material'
const ABSOLUTE_EXPOSURE_RE =
  /lower expected PAC exposure|expected PAC exposure|plastic-associated chemical migration under typical kitchen use/i

function assertEverySentenceHasVerb(text, label) {
  for (const sentence of splitAssembledDescriptionSentences(text)) {
    assert.ok(
      assembledSentenceHasVerb(sentence),
      `${label}: sentence fragment (no verb): "${sentence}"`,
    )
  }
}

function assertNoLowercaseFragmentAfterPeriod(text, label) {
  assert.ok(
    !/\.\s+[a-z]/.test(text),
    `${label}: description has lowercase fragment after period`,
  )
  assert.ok(!/;\s*Because/i.test(text), `${label}: dangling semicolon before Because`)
  assert.ok(!/,\s*;\s*/.test(text), `${label}: dangling separator in description`)
}

function assertNoAbsoluteExposureInDisplay(display, label) {
  const blob = JSON.stringify(display)
  assert.ok(!ABSOLUTE_EXPOSURE_RE.test(blob), `${label}: absolute exposure claim in display`)
  assert.ok(!/lower expected PAC exposure/i.test(blob), `${label}: lower expected PAC exposure copy`)
}

function assertNoSelfReferentialClauses(text, label) {
  assert.ok(
    !/Marketing claims contradict that marketing claim/i.test(text),
    `${label}: self-referential marketing clause`,
  )
  assert.ok(
    !/contradict that marketing claim/i.test(text),
    `${label}: broken marketing-contradiction clause`,
  )
}

function assertNoUncertaintyForFullyDisclosed(text, label) {
  assert.ok(
    !assembledDescriptionContainsUncertaintyLanguage(text),
    `${label}: Fully Disclosed must not contain uncertainty/disclosure-gap copy`,
  )
}

const approvedScore = (overrides = {}) => ({
  pac_safety_score: 88,
  tier: 'Excellent',
  displayed_confidence_range: '85–91',
  transparency_badge: 'Documentation Incomplete',
  ...overrides,
})

const LODGE_AMAZON = 'https://www.amazon.com/Lodge-Skillet/dp/B00006JSUA'
const LODGE_TARGET = 'https://www.target.com/p/lodge-10-25-cast-iron-skillet/-/A-10291925'
const LODGE_WALMART_1025 =
  'https://www.walmart.com/ip/Lodge-10-1-4-Cast-Iron-Skillet/596962815'
const LODGE_WALMART_12 =
  'https://www.walmart.com/ip/Lodge-Cast-Iron-Seasoned-12-Skillet/5969628'
const ALL_CLAD_WS =
  'https://www.williams-sonoma.com/products/all-clad-g5-graphite-fry-pan-lid/'
const CARAWAY_AMAZON = 'https://www.amazon.com/dp/B09SS34H3K'
const CARAWAY_TARGET =
  'https://www.target.com/p/caraway-home-10-5-ceramic-fry-pan/-/A-84082481'

function buyLabels(result) {
  return result.display.buy_cta.map((c) => c.label)
}

function assertBuyCtaVerbs(result, verb, label) {
  const labels = buyLabels(result)
  assert.ok(labels.length > 0, `${label}: expected at least one buy CTA`)
  for (const ctaLabel of labels) {
    assert.ok(
      ctaLabel.startsWith(`${verb} on `),
      `${label}: expected "${verb} on …", got "${ctaLabel}"`,
    )
  }
}

// --- Approved Gate 2 product descriptions (factually correct per transparency tier) ---
const LODGE_APPROVED_DESC =
  "Lodge uses cast iron as its food-contact surface. The disclosed food-contact material is inert for PAC exposure purposes and has minimal expected plastic-associated chemical migration under typical kitchen use. It's used for oven heat with fat exposure and stovetop heat with fat exposure; because cast iron is an inert material, routine heat and use conditions do not increase plastic-associated chemical migration."

const ALL_CLAD_APPROVED_DESC =
  "All-Clad uses stainless steel of unspecified grade as its food-contact surface. Stainless steel of unspecified grade has low potential to release plastic-associated chemicals under typical use. It's used for oven heat with fat exposure and stovetop heat with fat exposure; because key food-contact chemistry is not fully disclosed, that uncertainty is reflected in the score and transparency badge."

const CARAWAY_APPROVED_DESC =
  "Caraway uses ceramic nonstick coating (sol-gel) on aluminum core as its food-contact surface. Ceramic nonstick coating (sol-gel) has moderate potential to release plastic-associated chemicals under typical use. It's used for oven heat and stovetop heat with fat exposure; because the exact coating formulation is not fully disclosed, that uncertainty is reflected in the score and transparency badge."

const TFAL_APPROVED_DESC =
  "T-Fal uses PTFE nonstick coating, titanium reinforced as its food-contact surface. PTFE nonstick coating, titanium reinforced is a PFAS-related nonstick coating and can release plastic-associated chemicals into food, particularly under high heat, scratching, or as the coating wears with use. It's used for stovetop heat with fat exposure, conditions associated with greater release potential for PFAS-related nonstick coatings."

// --- Fragment grammar only (no content rewrite) ---
const fragmentGrammarBroken =
  'T-Fal confirms PTFE nonstick. oven and stovetop heat, including fat exposure, conditions associated with greater release potential for PFAS-related nonstick coatings.'
const fragmentGrammarFixed = finalizeAssembledProductDescription(fragmentGrammarBroken)
assertEverySentenceHasVerb(fragmentGrammarFixed, 'fragment grammar')
assert.ok(
  !/\.\s+Conditions associated/i.test(fragmentGrammarFixed),
  'fragment fix: conditions clause comma-joined, not period-split',
)
assert.ok(
  /It is used with oven and stovetop heat, including fat exposure, conditions associated/i.test(
    fragmentGrammarFixed,
  ),
  'fragment fix: use-conditions sentence present',
)
console.log('✓ fragment grammar fix (comma-join, no verb-less sentences)')

// --- Lodge assembly: single-material secondary echo ---
const LODGE_NAME = 'Lodge 10.25 Inch Cast Iron Skillet'
const lodgeComponents = [
  {
    component_name: 'Food contact surface',
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
  {
    component_name: 'Cast iron body',
    component_role: 'structural',
    material_id: 'cast_iron_body',
    material: 'Cast iron',
    material_hazard: 0.01,
    adjusted_migration_potential: 0.001,
    contact_intimacy: 0,
    exposure_severity: 0,
    severity_justification: 'Structural',
    exposure_duration: 0,
    duration_justification: 'Not food-contact',
  },
]

const lodgeWhy = {
  primary_material_options: ['Cast iron'],
  secondary_materials_options: ['Cast iron'],
  coatings_finishes_options: ['None'],
  use_conditions_options: ['Oven heat with fat exposure', 'Stovetop heat with fat exposure'],
  disclosure_quality_options: ['Fully Disclosed'],
  certifications_options: ['None'],
}

assert.ok(
  secondaryEchoesPrimary(lodgeWhy.primary_material_options, lodgeWhy.secondary_materials_options),
  'Lodge fixture: secondary echoes primary',
)

const lodgeResult = await assembleAprPublicRenderInput({
  product: {
    product_id: 'lodge-fixture',
    product_name: LODGE_NAME,
    brand: 'Lodge',
    amazon_url: LODGE_AMAZON,
    target_url: LODGE_TARGET,
    walmart_url: LODGE_WALMART_1025,
  },
  evidence: { evidence_id: 'ev-lodge', sources: [] },
  pageScore: approvedScore({ pac_safety_score: 96, tier: 'Excellent', transparency_badge: 'Fully Disclosed' }),
  whyThisScore: lodgeWhy,
  productDescription: LODGE_APPROVED_DESC,
  normalizationComponents: lodgeComponents,
  rawSources: [],
})

assert.ok(lodgeResult, 'Lodge assembly returned payload')
assertEverySentenceHasVerb(lodgeResult.display.product_description, 'Lodge assembly')
assertNoUncertaintyForFullyDisclosed(lodgeResult.display.product_description, 'Lodge assembly')
assertNoSelfReferentialClauses(lodgeResult.display.product_description, 'Lodge assembly')
assert.ok(
  /cast iron is not a plastic- or PFAS-based food-contact material/i.test(
    lodgeResult.display.product_description,
  ),
  'Lodge: inert cast iron copy preserved',
)
assert.ok(!/not fully disclosed|not fully characterized/i.test(lodgeResult.display.product_description))
assert.equal(lodgeResult.display.secondary_materials[0]?.name, NONE_DISTINCT)
assert.equal(
  lodgeResult.display.why_this_score.secondary_materials[0],
  NONE_DISTINCT,
  'Lodge WTS secondary',
)
const lodgeSecondarySection = lodgeResult.display.why_this_score.sections.find(
  (s) => s.title === 'Secondary materials',
)
assert.equal(lodgeSecondarySection?.items[0]?.text, NONE_DISTINCT)
assertNoAbsoluteExposureInDisplay(lodgeResult.display, 'Lodge')
const lodgeBuy = buyLabels(lodgeResult)
assert.ok(lodgeBuy.some((l) => /Amazon/i.test(l)), 'Lodge: Amazon buy CTA')
assert.ok(lodgeBuy.some((l) => /Target/i.test(l)), 'Lodge: Target buy CTA')
assert.ok(lodgeBuy.some((l) => /Walmart/i.test(l)), 'Lodge: admin walmart_url surfaces as buy CTA')
assertBuyCtaVerbs(lodgeResult, 'Buy', 'Lodge Excellent')
console.log('✓ Lodge single-material secondary + description grammar + buy CTAs')

// --- All-Clad assembly: multi-component secondary preserved ---
const ALL_CLAD_NAME =
  'All-Clad G5 Graphite Core Stainless-Steel Fry Pan with Lid, 12 inch'
const allCladComponents = [
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
  {
    component_role: 'structural',
    material_id: 'graphite_core',
    material: 'Graphite core',
    material_hazard: 0.02,
    adjusted_migration_potential: 0.001,
    contact_intimacy: 0,
    exposure_severity: 0,
    severity_justification: 'Internal bonded core',
    exposure_duration: 0,
    duration_justification: 'Not food-contact',
  },
  {
    component_role: 'structural',
    material_id: 'aluminum_core',
    material: 'Aluminum core',
    material_hazard: 0.22,
    adjusted_migration_potential: 0.001,
    contact_intimacy: 0,
    exposure_severity: 0,
    severity_justification: 'Internal bonded core',
    exposure_duration: 0,
    duration_justification: 'Not food-contact',
  },
]

const allCladWhy = {
  primary_material_options: ['Stainless steel of unspecified grade'],
  secondary_materials_options: ['Graphite core', 'Aluminum core'],
  coatings_finishes_options: ['None'],
  use_conditions_options: ['Oven heat with fat exposure', 'Stovetop heat with fat exposure'],
  disclosure_quality_options: ['Documentation Incomplete'],
  certifications_options: [
    'No third-party certification found; material family is identified, but the exact stainless steel grade/spec is not fully disclosed.',
  ],
}

const allCladResult = await assembleAprPublicRenderInput({
  product: {
    product_id: 'allclad-fixture',
    product_name: ALL_CLAD_NAME,
    brand: 'All-Clad',
    affiliate_link: ALL_CLAD_WS,
  },
  evidence: { evidence_id: 'ev-allclad', sources: [] },
  pageScore: approvedScore({ pac_safety_score: 99, tier: 'Excellent' }),
  whyThisScore: allCladWhy,
  productDescription: ALL_CLAD_APPROVED_DESC,
  normalizationComponents: allCladComponents,
  rawSources: [],
})

assert.ok(allCladResult, 'All-Clad assembly returned payload')
assertEverySentenceHasVerb(allCladResult.display.product_description, 'All-Clad assembly')
assertNoSelfReferentialClauses(allCladResult.display.product_description, 'All-Clad assembly')
assert.ok(/All-Clad uses/i.test(allCladResult.display.product_description), 'All-Clad: brand preserved')
assert.ok(
  /stainless steel of unspecified grade/i.test(allCladResult.display.product_description),
  'All-Clad: grade-gap copy preserved',
)
assert.ok(
  assembledDescriptionContainsUncertaintyLanguage(allCladResult.display.product_description),
  'All-Clad: Documentation Incomplete uncertainty copy retained',
)
const allCladSecondaryNames = allCladResult.display.secondary_materials.map((s) => s.name)
assert.ok(allCladSecondaryNames.includes('Graphite core'), 'All-Clad: Graphite core listed')
assert.ok(allCladSecondaryNames.includes('Aluminum core'), 'All-Clad: Aluminum core listed')
assert.ok(!allCladSecondaryNames.includes(NONE_DISTINCT), 'All-Clad: not collapsed to none-distinct')
assert.ok(
  buyLabels(allCladResult).some((l) => /Williams Sonoma/i.test(l)),
  'All-Clad: admin affiliate_link (Williams Sonoma) surfaces as buy CTA',
)
assertBuyCtaVerbs(allCladResult, 'Buy', 'All-Clad Excellent')
console.log('✓ All-Clad multi-component secondary preserved + buy CTA')

// --- Caraway assembly: distinct handle + core ---
const CARAWAY_NAME = 'Caraway Nonstick Ceramic Frying Pan 10.5 Inch'
const carawayComponents = [
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
  {
    component_role: 'structural',
    material_id: 'aluminum_core',
    material: 'Aluminum core',
    material_hazard: 0.22,
    adjusted_migration_potential: 0.001,
    contact_intimacy: 0,
    exposure_severity: 0,
    severity_justification: 'Internal core',
    exposure_duration: 0,
    duration_justification: 'Not food-contact',
  },
  {
    component_role: 'handle',
    material_id: 'stainless_steel',
    material: 'Stainless steel handle',
    material_hazard: 0.03,
    adjusted_migration_potential: 0.001,
    contact_intimacy: 0.1,
    exposure_severity: 0.1,
    severity_justification: 'Incidental contact',
    exposure_duration: 0.1,
    duration_justification: 'Brief handle contact',
  },
]

const carawayWhy = {
  primary_material_options: ['Ceramic nonstick coating (sol-gel) on aluminum core'],
  secondary_materials_options: ['Aluminum core', 'Stainless steel handle'],
  coatings_finishes_options: ['Ceramic nonstick coating (sol-gel)'],
  use_conditions_options: ['Oven heat with fat exposure', 'Stovetop heat with fat exposure'],
  disclosure_quality_options: ['Documentation Incomplete'],
  certifications_options: ['None'],
}

const carawayResult = await assembleAprPublicRenderInput({
  product: {
    product_id: 'caraway-fixture',
    product_name: CARAWAY_NAME,
    brand: 'Caraway',
    amazon_url: CARAWAY_AMAZON,
    target_url: CARAWAY_TARGET,
  },
  evidence: { evidence_id: 'ev-caraway', sources: [] },
  pageScore: approvedScore({ pac_safety_score: 72, tier: 'Caution' }),
  whyThisScore: carawayWhy,
  productDescription: CARAWAY_APPROVED_DESC,
  normalizationComponents: carawayComponents,
  rawSources: [],
})

assert.ok(carawayResult, 'Caraway assembly returned payload')
assertEverySentenceHasVerb(carawayResult.display.product_description, 'Caraway assembly')
assertNoSelfReferentialClauses(carawayResult.display.product_description, 'Caraway assembly')
assert.ok(
  assembledDescriptionContainsUncertaintyLanguage(carawayResult.display.product_description),
  'Caraway: coating formulation uncertainty copy retained',
)
const carawaySecondary = carawayResult.display.secondary_materials.map((s) => s.name)
assert.ok(carawaySecondary.some((n) => /aluminum core/i.test(n)), 'Caraway: aluminum core')
assert.ok(
  carawaySecondary.some((n) => /stainless steel handle/i.test(n)),
  'Caraway: stainless handle',
)
const carawayBuy = buyLabels(carawayResult)
assert.ok(carawayBuy.some((l) => /Amazon/i.test(l)), 'Caraway: Amazon buy CTA')
assert.ok(carawayBuy.some((l) => /Target/i.test(l)), 'Caraway: Target buy CTA')
assert.equal(carawayBuy.filter((l) => /Walmart/i.test(l)).length, 0, 'Caraway: no Walmart')
assertBuyCtaVerbs(carawayResult, 'View', 'Caraway Caution')
console.log('✓ Caraway multi-component secondary + description grammar + buy CTAs')

// --- T-Fal: transparency from normalization + Gate 1–filtered buy CTAs ---
const TFAL_NAME =
  'T-Fal Ultimate Hard Anodized Nonstick Fry Pan Set 3 Piece: 8, 10.25, 12 inch'
const TFAL_TARGET_WRONG = 'https://www.target.com/p/simply-cook-12-5'
const TFAL_WALMART_WRONG =
  'https://www.walmart.com/ip/T-fal-Ultimate-Hard-Anodized-Non-Stick-Cookware-2-Piece-Frypan-Set/123456'
const TFAL_WALMART_CORRECT =
  'https://www.walmart.com/ip/T-fal-Ultimate-Hard-Anodized-Non-Stick-Cookware-3-Piece-Frypan-Set-8-inch-10-25-inch-and-12-inch-Grey/83563821619'
const TFAL_TARGET_CORRECT =
  'https://www.target.com/p/t-fal-ultimate-hard-anodized-3pk-fry-pan-set/-/A-87417764'

const tfalWhy = {
  primary_material_options: ['PTFE nonstick coating, titanium reinforced'],
  secondary_materials_options: ['Hard anodized aluminum'],
  coatings_finishes_options: ['PTFE nonstick coating'],
  use_conditions_options: ['Stovetop heat with fat exposure'],
  disclosure_quality_options: ['Fully Disclosed'],
  certifications_options: ['None'],
}

const tfalPageScore = approvedScore({
  pac_safety_score: 2,
  tier: 'High Risk',
  transparency_badge: 'Documentation Incomplete',
})

assert.equal(
  approvedTransparencyBadge(tfalPageScore, tfalWhy),
  'Fully Disclosed',
  'T-Fal: badge from normalization, not page score downgrade',
)

const tfalEvidence = {
  evidence_id: 'ev-tfal',
  sources: [
    {
      source_type: 'target',
      url: TFAL_TARGET_WRONG,
      title: 'Target Simply Cook 12.5',
    },
    {
      source_type: 'walmart',
      url: TFAL_WALMART_WRONG,
      title: 'Walmart 2-piece frypan set',
    },
  ],
  agent_metadata: {
    warnings: [
      `Target URL mismatch — different product line: ${TFAL_TARGET_WRONG}`,
      `Walmart URL mismatch — wrong piece count: ${TFAL_WALMART_WRONG}`,
    ],
    structured_evidence: {
      product_identity: { product_name: TFAL_NAME, brand: 'T-Fal' },
    },
  },
}

const tfalResult = await assembleAprPublicRenderInput({
  product: {
    product_id: '7a457a86-ab62-4cbf-90b9-ccaeafe06896',
    product_name: TFAL_NAME,
    brand: 'T-Fal',
    amazon_url: 'https://www.amazon.com/dp/B000AMAZON',
    target_url: TFAL_TARGET_WRONG,
    walmart_url: TFAL_WALMART_WRONG,
  },
  evidence: tfalEvidence,
  pageScore: tfalPageScore,
  whyThisScore: tfalWhy,
  productDescription: TFAL_APPROVED_DESC,
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
    {
      component_role: 'structural',
      material_id: 'hard_anodized_aluminum',
      material: 'Hard anodized aluminum',
      material_hazard: 0.15,
      adjusted_migration_potential: 0.01,
      contact_intimacy: 0,
      exposure_severity: 0,
      severity_justification: 'Substrate',
      exposure_duration: 0,
      duration_justification: 'Not food-contact',
    },
  ],
  rawSources: [],
})

assert.ok(tfalResult, 'T-Fal assembly returned payload')
assert.equal(tfalResult.score.transparency_badge, 'Fully Disclosed')
assert.equal(tfalResult.display.disclosure_quality, 'Fully Disclosed')
assert.equal(tfalResult.display.why_this_score.disclosure_quality, 'Fully Disclosed')
assert.notEqual(tfalResult.display.disclosure_quality, 'Documentation Incomplete')

const buyUrls = tfalResult.display.buy_cta.map((c) => c.url)
assert.equal(buyUrls.length, 1, 'T-Fal: only Amazon when Gate 1 rejects mismatched admin URLs')
assert.ok(buyUrls[0]?.includes('amazon'), 'T-Fal: Amazon buy CTA retained')
assert.ok(!buyUrls.some((u) => u.includes('simply-cook')), 'T-Fal: Target Simply Cook excluded (Gate 1)')
assert.ok(
  !buyUrls.some((u) => /2-piece|2pc|2-pc/i.test(u)),
  'T-Fal: Walmart 2-piece excluded (Gate 1)',
)
assertBuyCtaVerbs(tfalResult, 'View', 'T-Fal High Risk')
assert.equal(tfalResult.display.buy_section_title, 'Product listings')

const tfalMatchedResult = await assembleAprPublicRenderInput({
  product: {
    product_id: '7a457a86-ab62-4cbf-90b9-ccaeafe06896',
    product_name: TFAL_NAME,
    brand: 'T-Fal',
    target_url: TFAL_TARGET_CORRECT,
    walmart_url: TFAL_WALMART_CORRECT,
  },
  evidence: tfalEvidence,
  pageScore: tfalPageScore,
  whyThisScore: tfalWhy,
  productDescription: TFAL_APPROVED_DESC,
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
    {
      component_role: 'structural',
      material_id: 'hard_anodized_aluminum',
      material: 'Hard anodized aluminum',
      material_hazard: 0.15,
      adjusted_migration_potential: 0.01,
      contact_intimacy: 0,
      exposure_severity: 0,
      severity_justification: 'Substrate',
      exposure_duration: 0,
      duration_justification: 'Not food-contact',
    },
  ],
  rawSources: [],
})

const matchedBuyUrls = tfalMatchedResult.display.buy_cta.map((c) => c.url)
assert.ok(matchedBuyUrls.includes(TFAL_WALMART_CORRECT), 'T-Fal: variant-matched Walmart 3-piece retained')
assert.ok(matchedBuyUrls.includes(TFAL_TARGET_CORRECT), 'T-Fal: variant-matched Target 3pk retained')
assertNoLowercaseFragmentAfterPeriod(tfalResult.display.product_description, 'T-Fal assembly')
assertEverySentenceHasVerb(tfalResult.display.product_description, 'T-Fal assembly')
assertNoUncertaintyForFullyDisclosed(tfalResult.display.product_description, 'T-Fal assembly')
assertNoSelfReferentialClauses(tfalResult.display.product_description, 'T-Fal assembly')
assert.ok(
  /conditions associated with greater release potential for PFAS-related nonstick coatings/i.test(
    tfalResult.display.product_description,
  ),
  'T-Fal: PFAS use-condition clause comma-joined',
)
assertNoAbsoluteExposureInDisplay(tfalResult.display, 'T-Fal')
console.log('✓ T-Fal transparency badge + Gate 1–filtered buy CTAs')

// --- Safer alternatives copy (relative score language only) ---
assert.equal(SAFER_ALTERNATIVES_SUBHEAD, 'Higher PAC Safety Scores in this category.')
assert.equal(SAFER_ALTERNATIVES_FOOTER, 'These alternatives have higher PAC Safety Scores.')
assert.equal(lodgeResult.display.safer_alternatives_subhead, SAFER_ALTERNATIVES_SUBHEAD)
assert.equal(lodgeResult.display.safer_alternatives_footer, SAFER_ALTERNATIVES_FOOTER)
assert.ok(!/lower expected PAC exposure/i.test(SAFER_ALTERNATIVES_SUBHEAD))
console.log('✓ Safer alternatives relative-score copy only')

const lodgeAltBuy = alternativeProductBuyCtas(
  {
    product_id: 'lodge-alt',
    product_name: LODGE_NAME,
    brand: 'Lodge',
    amazon_url: LODGE_AMAZON,
    target_url: LODGE_TARGET,
    walmart_url: LODGE_WALMART_1025,
  },
  'Excellent',
)
assert.equal(lodgeAltBuy.length, 3, 'Safer alternatives: all admin retailer links surface')
assert.ok(lodgeAltBuy.some((c) => /Amazon/i.test(c.label)), 'Safer alternatives: Amazon branded CTA')
assert.ok(lodgeAltBuy.some((c) => /Target/i.test(c.label)), 'Safer alternatives: Target branded CTA')
assert.ok(lodgeAltBuy.some((c) => /Walmart/i.test(c.label)), 'Safer alternatives: Walmart branded CTA')
console.log('✓ Safer-alternative rows expose all admin retailer buy CTAs')

const retailerButtonsSrc = readFileSync(
  join(root, 'src/lib/apr/retailerButtonStyle.ts'),
  'utf8',
)
for (const brandColor of ['#232F3E', '#CC0000', '#0071CE', '#1A1A1A']) {
  assert.ok(
    retailerButtonsSrc.includes(brandColor),
    `RetailerBuyButtons: missing brand color ${brandColor}`,
  )
}
assert.ok(
  /retailerButtonStyleFromBuyCta/.test(retailerButtonsSrc),
  'RetailerBuyButtons: maps display CTA to per-retailer brand styling',
)
console.log('✓ Retailer buy buttons use per-retailer brand colors (Amazon, Target, Walmart, Williams Sonoma)')

console.log('\n--- Assembled product descriptions ---')
console.log('Lodge:', lodgeResult.display.product_description)
console.log('All-Clad:', allCladResult.display.product_description)
console.log('Caraway:', carawayResult.display.product_description)
console.log('T-Fal:', tfalResult.display.product_description)

console.log('\nAPR assembleDisplay regression tests passed')
