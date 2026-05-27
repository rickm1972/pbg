/**
 * Deterministic component extraction — affirmative evidence only.
 */

import { detectMaterialId, getMaterial, requireMaterial } from './material-taxonomy.mjs'
import { factByKey, factSource, factValue, getFacts } from './evidence-facts.mjs'
import { resolveConfidenceLabel } from './source-hierarchy.mjs'
import {
  getCoatingsFromSchema,
  getIngredientList,
  getPrimaryContact,
  getSecondaryComponentsFromSchema,
  getStructuredEvidence,
  getStructuredSubcategory,
  hasStructuredEvidence,
} from './schema-input.mjs'

const COMPOUND_MATERIAL_RE = /^([a-z0-9_]+)_on_([a-z0-9_]+)$/i

/** @param {string} materialId */
function parseCompoundMaterialId(materialId) {
  const m = COMPOUND_MATERIAL_RE.exec(String(materialId ?? '').trim())
  if (!m) return null
  return { coatingId: m[1], bodyId: m[2] }
}

function pushCompoundMaterialComponents(
  components,
  { coatingId, bodyId, materialText, evidence_source, confidence },
) {
  const coatingMat = requireMaterial(coatingId)
  const bodyMat = requireMaterial(bodyId)
  if (!hasPrimaryCookingMaterial(components, coatingId)) {
    components.push({
      component_name: `Cooking Surface — ${coatingMat.name}`,
      role: 'primary_food_contact',
      material_id: coatingId,
      material: materialText,
      evidence_source,
      data_confidence: confidence,
    })
  }
  if (!components.some((c) => c.role === 'structural' && c.material_id === bodyId)) {
    components.push({
      component_name: `Pan Body — ${bodyMat.name}`,
      role: 'structural',
      material_id: bodyId,
      material: materialText,
      evidence_source,
      data_confidence: confidence,
    })
  }
}

function isFormulationSubcategory(subcategory) {
  return /^(dish_soap|detergent|hand_soap|body_wash|shampoo|laundry|cleaner|formulation)/.test(
    subcategory,
  )
}

/** Affirmative text for laser-etched stainless cooking-surface peaks. */
const PEAKS_AFFIRMATIVE =
  /laser[\s-]?etched|hexagonal\s+(peaks|pattern|surface)|stainless\s+steel\s+hexagonal|steel\s+hexagon\s+peaks|stainless.*peaks?|peaks.*stainless/i

const TERRABOND_AFFIRMATIVE = /terrabond|terra\s*bond|proprietary.*ceramic.*nonstick|ceramic.*nonstick.*valley/i

function hasPrimaryCookingMaterial(components, materialId) {
  return components.some(
    (c) =>
      (c.role === 'primary_food_contact' || c.role === 'coating') &&
      c.material_id === materialId,
  )
}

function draftPeaksComponent({ fact_key, excerpt, source_url, confidence, materialText }) {
  return {
    component_name: 'Cooking Surface — Stainless Steel Hexagonal Peaks (laser-etched)',
    role: 'primary_food_contact',
    material_id: 'laser_etched_stainless_surface',
    material:
      materialText ??
      'Laser-etched stainless steel hexagonal peaks — raised food-contact surfaces above ceramic coating valleys',
    evidence_source: {
      fact_key,
      excerpt: excerpt ?? '',
      source_url: source_url ?? null,
    },
    data_confidence: confidence ?? 'manufacturer confirmed',
  }
}

function draftTerrabondValleysComponent({ fact_key, excerpt, source_url, confidence }) {
  return {
    component_name: 'Cooking Surface — TerraBond™ Ceramic Nonstick Coating (valleys)',
    role: 'primary_food_contact',
    material_id: 'terrabond_proprietary',
    material:
      'TerraBond™ proprietary ceramic nonstick coating in surface valleys — composition undisclosed (PROPRIETARY_NAMED)',
    evidence_source: {
      fact_key,
      excerpt: excerpt ?? '',
      source_url: source_url ?? null,
    },
    data_confidence: confidence ?? 'manufacturer confirmed',
  }
}

function isLaserEtchedPeaksCoating(coat) {
  const name = String(coat.coating_name ?? '')
  const type = String(coat.coating_type ?? '')
  if (type === 'laser_etched_finish') return true
  if (PEAKS_AFFIRMATIVE.test(name)) return true
  if (/stainless.*peak|peak.*stainless|hexagonal.*stainless/i.test(name)) return true
  return false
}

function isTerrabondValleyCoating(coat) {
  const name = String(coat.coating_name ?? '')
  const type = String(coat.coating_type ?? '')
  if (type === 'proprietary_undisclosed' && /terrabond|terra\s*bond/i.test(name)) return true
  if (TERRABOND_AFFIRMATIVE.test(name) && !PEAKS_AFFIRMATIVE.test(name)) return true
  return false
}

function addPrimaryFromStructuredContact(evidence, components) {
  const primary = getPrimaryContact(evidence)
  if (!primary) return

  const matId = primary.material_id
  const identity = String(primary.material_identity ?? '')
  const isTerrabond =
    matId === 'terrabond_proprietary' || /^terrabond|terra\s*bond/i.test(identity)
  const isGenericProprietaryNamed =
    !isTerrabond &&
    (primary.undisclosed_code === 'PROPRIETARY_NAMED' || identity === 'PROPRIETARY_NAMED')
  const proprietaryId = isTerrabond ? 'terrabond_proprietary' : 'proprietary_named_food_contact'

  if (isTerrabond || isGenericProprietaryNamed || matId === 'proprietary_named_food_contact') {
    if (!hasPrimaryCookingMaterial(components, proprietaryId)) {
      components.push(
        draftTerrabondValleysComponent({
          fact_key: 'primary_contact_material',
          excerpt: primary.excerpt,
          source_url: primary.source_url,
          confidence: primary.confidence,
        }),
      )
    }
    return
  }

  const compound =
    parseCompoundMaterialId(matId) ?? parseCompoundMaterialId(identity)
  if (compound) {
    pushCompoundMaterialComponents(components, {
      ...compound,
      materialText: primary.material_identity,
      evidence_source: {
        fact_key: 'primary_contact_material',
        excerpt: primary.excerpt,
        source_url: primary.source_url,
      },
      confidence: primary.confidence,
    })
    return
  }

  if (PEAKS_AFFIRMATIVE.test(identity) && !hasPrimaryCookingMaterial(components, 'laser_etched_stainless_surface')) {
    components.push(
      draftPeaksComponent({
        fact_key: 'primary_contact_material',
        excerpt: primary.excerpt,
        source_url: primary.source_url,
        confidence: primary.confidence,
        materialText: identity,
      }),
    )
    return
  }

  if (getMaterial(matId) && !hasPrimaryCookingMaterial(components, matId)) {
    const mat = requireMaterial(matId)
    components.push({
      component_name: `Cooking Surface and Body (${mat.name})`,
      role: 'primary_food_contact',
      material_id: matId,
      material: primary.material_identity,
      evidence_source: {
        fact_key: 'primary_contact_material',
        excerpt: primary.excerpt,
        source_url: primary.source_url,
      },
      data_confidence: primary.confidence,
    })
  }
}

function addPrimaryFromSchemaCoatings(evidence, components) {
  for (const coat of getCoatingsFromSchema(evidence)) {
    if (
      isLaserEtchedPeaksCoating(coat) &&
      !hasPrimaryCookingMaterial(components, 'laser_etched_stainless_surface')
    ) {
      components.push(
        draftPeaksComponent({
          fact_key: 'coatings_and_finishes',
          excerpt: coat.coating_name,
          source_url: coat.source_url,
          confidence: 'manufacturer confirmed',
          materialText: `${coat.coating_name} — laser-etched stainless peaks (direct food contact)`,
        }),
      )
    } else if (
      isTerrabondValleyCoating(coat) &&
      !hasPrimaryCookingMaterial(components, 'terrabond_proprietary')
    ) {
      components.push(
        draftTerrabondValleysComponent({
          fact_key: 'coatings_and_finishes',
          excerpt: coat.coating_name,
          source_url: coat.source_url,
          confidence: 'manufacturer confirmed',
        }),
      )
    }
  }
}

function addPrimaryFromLegacyFacts(evidence, components) {
  const legacyKeys = [
    'primary_contact_surface',
    'finishing_treatments',
    'primary_contact_surface_coating_detail',
  ]

  for (const key of legacyKeys) {
    const text = factValue(evidence, key)
    if (!text.trim()) continue
    const row = factByKey(evidence, key)
    const confidence = resolveConfidenceLabel(evidence, row)

    if (
      PEAKS_AFFIRMATIVE.test(text) &&
      !hasPrimaryCookingMaterial(components, 'laser_etched_stainless_surface')
    ) {
      components.push(
        draftPeaksComponent({
          fact_key: key,
          excerpt: row?.excerpt ?? text.slice(0, 200),
          source_url: row?.source_url ?? null,
          confidence,
          materialText: text,
        }),
      )
    }
    if (
      TERRABOND_AFFIRMATIVE.test(text) &&
      !hasPrimaryCookingMaterial(components, 'terrabond_proprietary')
    ) {
      components.push(
        draftTerrabondValleysComponent({
          fact_key: key,
          excerpt: row?.excerpt ?? text.slice(0, 200),
          source_url: row?.source_url ?? null,
          confidence,
        }),
      )
    }
  }

  for (const row of getFacts(evidence)) {
    const key = String(row.fact_key ?? '')
    if (!key.startsWith('coating_')) continue
    const text = String(row.fact_value ?? '')
    if (!text.trim()) continue
    const confidence = resolveConfidenceLabel(evidence, row)

    if (
      PEAKS_AFFIRMATIVE.test(text) &&
      !hasPrimaryCookingMaterial(components, 'laser_etched_stainless_surface')
    ) {
      components.push(
        draftPeaksComponent({
          fact_key: key,
          excerpt: row.excerpt ?? text.slice(0, 200),
          source_url: row.source_url ?? null,
          confidence,
          materialText: text,
        }),
      )
    }
    if (
      TERRABOND_AFFIRMATIVE.test(text) &&
      !hasPrimaryCookingMaterial(components, 'terrabond_proprietary')
    ) {
      components.push(
        draftTerrabondValleysComponent({
          fact_key: key,
          excerpt: row.excerpt ?? text.slice(0, 200),
          source_url: row.source_url ?? null,
          confidence,
        }),
      )
    }
  }
}

/** Hybrid cookware: affirmative "Hybrid" identity + stainless + TerraBond valleys → separate peaks component. */
function addHybridDualSurfacePeaks(evidence, product, components) {
  if (hasPrimaryCookingMaterial(components, 'laser_etched_stainless_surface')) return
  if (!hasPrimaryCookingMaterial(components, 'terrabond_proprietary')) return

  const se = getStructuredEvidence(evidence)
  const name = se?.product_identity?.product_name ?? product?.product_name ?? ''
  const useCase = se?.product_use_case ?? factValue(evidence, 'product_use_case')
  if (!/\bhybrid\b/i.test(`${name} ${useCase}`)) return

  const secondaries = getSecondaryComponentsFromSchema(evidence) ?? []
  const hasStainless =
    secondaries.some((s) => /stainless/i.test(String(s.material_identity ?? ''))) ||
    getFacts(evidence).some((f) => /stainless/i.test(String(f.fact_value ?? '')))
  if (!hasStainless) return

  components.push(
    draftPeaksComponent({
      fact_key: 'hybrid_dual_surface_construction',
      excerpt: `Hybrid dual-surface cookware: ${name.trim()}`,
      source_url: se?.retailer_links?.amazon_url ?? null,
      confidence: 'manufacturer confirmed',
      materialText:
        'Laser-etched stainless steel hexagonal peaks — affirmative hybrid dual-surface construction (stainless peaks over ceramic valleys)',
    }),
  )
}

/**
 * One component per primary food-contact cooking-surface material (multi-material surfaces).
 * @param {object} evidence
 * @param {object} [product]
 */
function extractAllPrimaryCookingSurfaces(evidence, product) {
  const components = []
  addPrimaryFromStructuredContact(evidence, components)
  addPrimaryFromSchemaCoatings(evidence, components)
  addPrimaryFromLegacyFacts(evidence, components)
  addHybridDualSurfacePeaks(evidence, product, components)
  return components
}

/** Segments that deny presence of a part — never create components. */
const NEGATIVE_SEGMENT =
  /^\s*(?:no|without|not|none|zero)\b|(?:^|;\s*)(?:no|without)\s+(?:lid|gasket|seal|straw|plastic|ptfe|pfoa|pfas|handle|rivet)/i

const SECONDARY_AFFIRMATIVE = [
  { pattern: /tempered\s+glass\s+lid/i, role: 'lid', name: 'Tempered Glass Lid', material_id: 'tempered_glass_lid' },
  { pattern: /bpa[- ]?free\s+plastic\s+lid/i, role: 'lid', name: 'Lid (BPA-free plastic)', material_id: 'bpa_free_plastic_lid' },
  { pattern: /\bplastic\s+lid\b/i, role: 'lid', name: 'Lid (plastic)', material_id: 'plastic_lid_unspecified' },
  { pattern: /bamboo\s+lid/i, role: 'lid', name: 'Bamboo Lid', material_id: 'bamboo_lid_silicone' },
  {
    pattern: /integrated\s+cast\s+iron\s+handle/i,
    role: 'handle',
    name: 'Handle (integrated cast iron)',
    material_id: 'cast_iron_integrated_handle',
  },
  {
    pattern: /stainless\s+steel\s+handle/i,
    role: 'handle',
    name: 'Handle (stainless steel)',
    material_id: 'stainless_steel_handle',
  },
  {
    pattern: /stay[- ]?cool\s+handle/i,
    role: 'handle',
    name: 'Handle (Stay-Cool)',
    material_id: 'stay_cool_handle_undisclosed',
  },
  {
    pattern: /handle\s+material\s+not\s+disclosed/i,
    role: 'handle',
    name: 'Handle (Stay-Cool)',
    material_id: 'stay_cool_handle_undisclosed',
  },
  {
    pattern: /stainless\s+steel\s+rivets?/i,
    role: 'rivet',
    name: 'Stainless Steel Rivets',
    material_id: 'stainless_steel_rivets',
  },
  {
    pattern: /silicone\s+gasket.*food.grade|food.grade.*silicone\s+gasket/i,
    role: 'gasket',
    name: 'Silicone Gasket',
    material_id: 'silicone_gasket_verified',
  },
  {
    pattern: /silicone\s+gasket|silicone\s+seal/i,
    role: 'gasket',
    name: 'Silicone Gasket',
    material_id: 'silicone_gasket_unverified',
  },
  {
    pattern: /refill\s+bottle|refill\s+pouch/i,
    role: 'packaging',
    name: 'Refill Bottle (Container)',
    material_id: 'refill_container_hdpe_unspecified',
  },
  {
    pattern: /magnetic\s+stainless|induction\s+base/i,
    role: 'structural',
    name: 'Magnetic Stainless Steel Base',
    material_id: 'magnetic_stainless_base',
  },
]

/**
 * @typedef {object} DraftComponent
 * @property {string} component_name
 * @property {string} role
 * @property {string} material_id
 * @property {string} material
 * @property {object} evidence_source
 * @property {string} data_confidence
 */

function isNegativeSegment(segment) {
  return NEGATIVE_SEGMENT.test(segment.trim())
}

/** Semicolon-separated only — do not split on periods (e.g. "33.8 oz"). */
function splitSecondarySegments(text) {
  return String(text ?? '')
    .split(/;/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function matchSecondarySegment(segment) {
  for (const rule of SECONDARY_AFFIRMATIVE) {
    if (rule.pattern.test(segment)) {
      return { ...rule, segment }
    }
  }
  return null
}

/**
 * @param {object} evidence
 * @param {object} factRow
 * @param {string} role
 * @param {string} name
 * @param {string} materialText
 */
function draftFromFact(evidence, factRow, role, name, materialText) {
  const materialId = detectMaterialId(materialText)
  if (!materialId) return null
  const mat = requireMaterial(materialId)
  if (!mat.roles.includes(role) && role !== 'coating') return null

  const confidence = resolveConfidenceLabel(evidence, factRow, {
    fullIngredientList: factRow?.fact_key === 'ingredient_list',
  })

  return {
    component_name: name,
    role,
    material_id: materialId,
    material: materialText.trim(),
    evidence_source: {
      fact_key: factRow.fact_key,
      excerpt: factRow.excerpt ?? '',
      source_index: factRow.source_index ?? null,
    },
    data_confidence: confidence,
  }
}

function extractFormulationPrimary(evidence) {
  const row = factByKey(evidence, 'ingredient_list')
  const ingredients = factValue(evidence, 'ingredient_list').trim()
  if (!ingredients || /^n\/a/i.test(ingredients)) return { isFormulation: false, components: [] }

  const primaryMat = factValue(evidence, 'primary_material')
  const blob = `${ingredients} ${primaryMat}`
  const materialId = detectMaterialId(blob) ?? 'plant_mineral_formulation'

  const confidence = resolveConfidenceLabel(evidence, row, { fullIngredientList: true })

  return {
    isFormulation: true,
    components: [
      {
        component_name: 'Liquid Formulation (Concentrate)',
        role: 'formulation',
        material_id: materialId,
        material: ingredients,
        evidence_source: {
          fact_key: 'ingredient_list',
          excerpt: row?.excerpt ?? '',
          source_index: row?.source_index ?? null,
        },
        data_confidence: confidence,
      },
    ],
  }
}

function extractCookwarePrimary(evidence, product) {
  const materialRow = factByKey(evidence, 'primary_material')
  const contact = factValue(evidence, 'primary_contact_surface')
  const material = factValue(evidence, 'primary_material')
  const finishing = factValue(evidence, 'finishing_treatments')
  const components = extractAllPrimaryCookingSurfaces(evidence, product)

  // Compound primary material IDs like "ptfe_nonstick_on_hard_anodized_aluminum"
  // should split into distinct coating + body components instead of falling back.
  const compound = parseCompoundMaterialId(material)
  if (compound && components.length === 0) {
    const contactRow = factByKey(evidence, 'primary_contact_surface')
    const coatingConfidence = resolveConfidenceLabel(evidence, contactRow || materialRow)
    pushCompoundMaterialComponents(components, {
      ...compound,
      materialText: contact || material,
      evidence_source: factSource(
        evidence,
        contactRow ? 'primary_contact_surface' : 'primary_material',
      ),
      confidence: coatingConfidence,
    })
  }

  const hasSeasoning =
    /vegetable oil|pre.seasoned|natural oil seasoning/i.test(`${contact} ${finishing}`) &&
    /cast iron/i.test(`${contact} ${material}`)

  if (
    components.length === 0 &&
    (detectMaterialId(contact) || detectMaterialId(material))
  ) {
    const blob = `${contact} ${material}`
    const contactRow = factByKey(evidence, 'primary_contact_surface')
    const materialId = hasSeasoning
      ? 'cast_iron_seasoned'
      : detectMaterialId(blob) ?? detectMaterialId(material)
    if (materialId) {
      const mat = requireMaterial(materialId)
      const confidence = resolveConfidenceLabel(evidence, contactRow || materialRow)
      components.push({
        component_name: `Cooking Surface and Body (${mat.name})`,
        role: 'primary_food_contact',
        material_id: materialId,
        material: contact || material,
        evidence_source: factSource(evidence, contactRow ? 'primary_contact_surface' : 'primary_material'),
        data_confidence: confidence,
      })
    }
  }

  if (/thermolon/i.test(contact)) {
    const contactRow = factByKey(evidence, 'primary_contact_surface')
    const d = draftFromFact(
      evidence,
      contactRow,
      'primary_food_contact',
      'Cooking Surface — Thermolon Coating',
      contact,
    )
    if (d && !hasPrimaryCookingMaterial(components, d.material_id)) components.push(d)
  }

  if (/aluminum core|aluminium core/i.test(material)) {
    const d = draftFromFact(
      evidence,
      materialRow,
      'structural',
      'Pan Body — Aluminum Core',
      material,
    )
    if (d) components.push({ ...d, material_id: 'aluminum_core', material: 'Aluminum core (tri-ply construction)' })
  }

  if (/stainless.*exterior|tri.ply.*stainless/i.test(material) && !components.some((c) => c.role === 'structural' && /exterior/i.test(c.component_name))) {
    const confidence = resolveConfidenceLabel(evidence, materialRow)
    components.push({
      component_name: 'Pan Body — Tri-Ply Stainless Steel Exterior',
      role: 'structural',
      material_id: 'stainless_steel_unspecified',
      material: material,
      evidence_source: factSource(evidence, 'primary_material'),
      data_confidence: confidence,
    })
  }

  return { isFormulation: false, components }
}

function extractCoatingComponents(evidence, existing) {
  const row = factByKey(evidence, 'finishing_treatments')
  const text = factValue(evidence, 'finishing_treatments')
  if (!text.trim() || /^n\/a|not applicable|self-preserving|hurdle technology/i.test(text)) {
    return []
  }

  const coatings = []
  if (/vegetable oil|pre.seasoned/i.test(text) && !existing.some((c) => c.material_id === 'cast_iron_seasoned')) {
    const d = draftFromFact(evidence, row, 'coating', 'Seasoning Layer (vegetable oil)', text)
    if (d) coatings.push({ ...d, material_id: 'vegetable_oil_seasoning' })
  }
  if (/terrabond|proprietary.*ceramic/i.test(text) && !existing.some((c) => c.material_id === 'terrabond_proprietary')) {
    const d = draftFromFact(evidence, row, 'coating', 'TerraBond Ceramic Coating', text)
    if (d) coatings.push({ ...d, material_id: 'terrabond_proprietary' })
  }
  if (/laser.etched|hexagonal pattern/i.test(text) && !existing.some((c) => c.material_id === 'laser_etched_stainless_surface')) {
    const d = draftFromFact(evidence, row, 'coating', 'Laser-Etched Stainless Pattern', text)
    if (d) coatings.push({ ...d, material_id: 'laser_etched_stainless_surface' })
  }
  return coatings
}

function extractSecondaryComponents(evidence) {
  const row = factByKey(evidence, 'secondary_components')
  const text = factValue(evidence, 'secondary_components')
  if (!text.trim()) return []

  const drafts = []
  const seen = new Set()

  for (const segment of splitSecondarySegments(text)) {
    if (isNegativeSegment(segment)) continue
    const match = matchSecondarySegment(segment)
    if (!match) continue
    const key = `${match.role}:${match.material_id}`
    if (seen.has(key)) continue
    seen.add(key)

    const confidence = resolveConfidenceLabel(evidence, row)
    let dataConfidence = confidence
    if (match.role === 'packaging' && /resin unspecified|not disclosed|hdpe or similar/i.test(segment)) {
      dataConfidence = 'inferred from category pattern'
    }
    if (match.role === 'handle' && match.material_id === 'stay_cool_handle_undisclosed') {
      dataConfidence = 'inferred from category pattern'
    }

    drafts.push({
      component_name: match.name,
      role: match.role,
      material_id: match.material_id,
      material: segment,
      evidence_source: {
        fact_key: 'secondary_components',
        excerpt: row?.excerpt ?? '',
        source_index: row?.source_index ?? null,
        affirmative_segment: segment,
      },
      data_confidence: dataConfidence,
    })
  }

  return drafts
}

const ROLE_TO_INTERNAL = {
  refill_bottle: 'packaging',
  cap: 'packaging',
  magnetic_base: 'structural',
  base: 'structural',
  other: 'structural',
  body: 'structural',
  pan_body: 'structural',
}

function componentNameForRole(role) {
  const labels = {
    handle: 'Handle',
    lid: 'Tempered Glass Lid',
    rivet: 'Stainless Steel Rivets',
    gasket: 'Silicone Gasket',
    refill_bottle: 'Refill Bottle (Container)',
    knob: 'Knob',
    strap: 'Strap',
    brush_bristle: 'Brush Bristles',
  }
  return labels[role] ?? role.replace(/_/g, ' ')
}

function extractFromStructuredSchema(evidence, product) {
  const components = []
  const log = [{ step: 'structured_schema_v1', multi_material_cooking_surface: true }]

  const subcategory = getStructuredSubcategory(evidence, product)
  const primaryContact = getPrimaryContact(evidence)
  const ingredients = getIngredientList(evidence)
  if (
    ingredients?.text &&
    isFormulationSubcategory(subcategory) &&
    !primaryContact
  ) {
    const materialId = detectMaterialId(ingredients.text) ?? 'plant_mineral_formulation'
    components.push({
      component_name: 'Liquid Formulation (Concentrate)',
      role: 'formulation',
      material_id: materialId,
      material: ingredients.text,
      evidence_source: {
        fact_key: 'ingredient_list',
        excerpt: ingredients.excerpt,
        source_url: ingredients.source_url,
      },
      data_confidence: ingredients.confidence,
    })
    return { isFormulation: true, components, extraction_log: log }
  }

  const cookingSurfaces = extractAllPrimaryCookingSurfaces(evidence, product)
  components.push(...cookingSurfaces)
  log.push({ step: 'primary_cooking_surfaces', count: cookingSurfaces.length })

  for (const sec of getSecondaryComponentsFromSchema(evidence) ?? []) {
    const role = ROLE_TO_INTERNAL[sec.component_role] ?? sec.component_role
    let materialId = sec.material_id
    if (!getMaterial(materialId)) {
      materialId = detectMaterialId(sec.material_identity) ?? materialId
    }
    if (!getMaterial(materialId)) continue

    if (
      components.some(
        (c) =>
          c.material_id === materialId &&
          (c.role === role ||
            (role === 'structural' && c.role === 'structural') ||
            (sec.component_role === 'other' && c.role === 'structural')),
      )
    ) {
      continue
    }
    let confidence = sec.confidence
    if (role === 'packaging' && /unspecified|not disclosed/i.test(sec.material_identity ?? '')) {
      confidence = 'inferred from category pattern'
    }
    if (role === 'handle' && materialId === 'stay_cool_handle_undisclosed') {
      confidence = 'inferred from category pattern'
    }
    const mat = getMaterial(materialId)
    let component_name = componentNameForRole(sec.component_role)
    if (role === 'structural' && mat) {
      component_name =
        materialId === 'aluminum_core'
          ? `Tri-ply Body (${mat.name})`
          : materialId === 'stainless_steel_unspecified'
            ? `Body (${mat.name})`
            : component_name
    }
    if (role === 'handle' && materialId === 'stay_cool_handle_undisclosed') {
      component_name = 'Handle (Stay-Cool)'
    }
    components.push({
      component_name,
      role,
      material_id: materialId,
      material: sec.material_identity,
      evidence_source: {
        fact_key: 'secondary_components',
        excerpt: sec.excerpt,
        source_url: sec.source_url,
        affirmative_segment: sec.material_identity,
      },
      data_confidence: confidence,
    })
  }

  return { isFormulation: false, components, extraction_log: log }
}

/**
 * @param {object} evidence
 * @param {object} product
 * @returns {{ isFormulation: boolean, components: DraftComponent[], extraction_log: object[] }}
 */
export function extractComponents(evidence, product) {
  if (hasStructuredEvidence(evidence)) {
    const structured = extractFromStructuredSchema(evidence)
    if (structured.components.length === 0) {
      throw new Error('Structured schema extraction produced no components')
    }
    for (const c of structured.components) {
      if (!getMaterial(c.material_id)) {
        throw new Error(`Invalid material_id ${c.material_id} on ${c.component_name}`)
      }
    }
    return structured
  }

  const extraction_log = []
  const formulation = extractFormulationPrimary(evidence)
  let components = []

  if (formulation.isFormulation) {
    components = [...formulation.components]
    extraction_log.push({ step: 'formulation_primary', count: components.length })
  } else {
    const cookware = extractCookwarePrimary(evidence, product)
    components = [...cookware.components]
    extraction_log.push({ step: 'cookware_primary', count: components.length })
  }

  const secondary = extractSecondaryComponents(evidence)
  for (const s of secondary) {
    if (!components.some((c) => c.role === s.role && c.material_id === s.material_id)) {
      components.push(s)
    }
  }
  extraction_log.push({ step: 'secondary_affirmative', count: secondary.length })

  const coatings = extractCoatingComponents(evidence, components)
  for (const c of coatings) {
    if (!components.some((x) => x.material_id === c.material_id && x.role === 'coating')) {
      components.push(c)
    }
  }
  extraction_log.push({ step: 'finishing_coatings', count: coatings.length })

  if (components.length === 0) {
    throw new Error(
      'Component extraction failed: no affirmative components identified in approved evidence',
    )
  }

  for (const c of components) {
    if (!c.evidence_source?.fact_key || !c.evidence_source?.excerpt) {
      throw new Error(
        `Component "${c.component_name}" missing evidence_source (affirmative citation required)`,
      )
    }
    if (!getMaterial(c.material_id)) {
      throw new Error(`Component "${c.component_name}" has invalid material_id ${c.material_id}`)
    }
  }

  return {
    isFormulation: formulation.isFormulation,
    components,
    extraction_log,
  }
}
