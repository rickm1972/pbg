/**
 * Why This Score options — one vocabulary label per row in scoring_inputs.components only.
 * Evidence prose and taxonomy *Options arrays are not used (prevents phantom dropdown values).
 */

import { isPacRelevant, resolveCertEntry } from '../../src/shared/certification-taxonomy.mjs'
import {
  extractManufacturerPublishedLabTesting,
  formatManufacturerLabTestingCertOption,
} from '../../src/shared/agent2/manufacturer-lab-testing-evidence.mjs'
import { isExpansionRequired } from '../../src/shared/canonical-taxonomy/constants.mjs'
import {
  isFoodContactCoatingPrimaryMaterial,
  isUnknownFoodContactCoatingMaterial,
} from './deterministic/material-taxonomy.mjs'
import { getCanonicalMappings } from './deterministic/schema-input.mjs'
import { sortComponentsByHazardDesc } from './why-this-score-component-sort.mjs'
import { whyThisScoreLabelForComponent } from './why-this-score-labels.mjs'
import {
  CERT_VERIFICATION_ABSENT,
  finalizeOptions,
  NONE,
  VOCABULARY,
} from './why-this-score-vocabulary.mjs'
import { factValue } from './deterministic/evidence-facts.mjs'
import { getSubstrateCanonical } from './deterministic/schema-input.mjs'
import { getMaterial } from './deterministic/material-taxonomy.mjs'
import { getUseConditionTemplatesForScoringCategory } from '../../src/shared/product-type-registry/index.mjs'

const PRIMARY_ROLES = new Set(['primary_food_contact', 'formulation'])
const SECONDARY_ROLES = new Set(['handle', 'lid', 'rivet', 'gasket', 'packaging', 'structural'])

function labelsFromComponents(components, field) {
  const picked = []
  for (const c of sortComponentsByHazardDesc(components)) {
    const role = c.component_role ?? c.role
    const label = whyThisScoreLabelForComponent(c.material_id, role, field)
    if (label && !picked.includes(label)) picked.push(label)
  }
  return picked
}

function mapPrimaryMaterial(_evidence, inputs) {
  const components = (inputs?.components ?? []).filter((c) =>
    PRIMARY_ROLES.has(c.component_role ?? c.role),
  )
  const picked = labelsFromComponents(components, 'primary')
  return finalizeOptions(picked, 'primary_material_options')
}

function substrateBodyLabel(evidence) {
  const substrate = getSubstrateCanonical(evidence)
  const substrateId = substrate?.agent2_material_id ?? substrate?.canonical_id
  if (!substrateId || isExpansionRequired(substrateId) || !getMaterial(substrateId)) {
    return null
  }
  return whyThisScoreLabelForComponent(substrateId, 'structural', 'secondary')
}

function mapSecondaryMaterials(evidence, inputs) {
  const components = (inputs?.components ?? []).filter((c) =>
    SECONDARY_ROLES.has(c.component_role ?? c.role),
  )
  const picked = labelsFromComponents(components, 'secondary')
  const bodyLabel = substrateBodyLabel(evidence)
  if (bodyLabel && !picked.includes(bodyLabel)) {
    picked.push(bodyLabel)
  }
  if (!picked.length) {
    return finalizeOptions([NONE], 'secondary_materials_options')
  }
  return finalizeOptions(picked, 'secondary_materials_options')
}

function coatingModifierLabel(evidence) {
  const mod = getCanonicalMappings(evidence)?.coating_modifier_id
  const modId = mod?.canonical_id ?? ''
  if (!modId || modId === 'no_coating_modifier' || modId === 'not_applicable') return null
  const agent2Id = mod?.agent2_material_id ?? modId
  const fromTaxonomy = whyThisScoreLabelForComponent(agent2Id, 'coating', 'coating')
  if (fromTaxonomy) return fromTaxonomy
  const raw = String(mod.raw_value ?? '').trim()
  if (/ceramic.*sol.*gel|sol.*gel.*ceramic/i.test(raw)) {
    return 'Ceramic sol-gel nonstick coating'
  }
  return mod.display_label ?? null
}

function mapCoatingsFinishes(evidence, inputs) {
  const coatingComponents = []
  for (const c of inputs?.components ?? []) {
    const role = c.component_role ?? c.role
    if (role === 'coating') {
      coatingComponents.push(c)
    } else if (
      role === 'primary_food_contact' &&
      (isFoodContactCoatingPrimaryMaterial(c.material_id) ||
        isUnknownFoodContactCoatingMaterial(c.material_id) ||
        /^ptfe/i.test(String(c.material_id ?? '')))
    ) {
      coatingComponents.push(c)
    }
  }
  const picked = labelsFromComponents(coatingComponents, 'coating')
  const modLabel = coatingModifierLabel(evidence)
  if (modLabel && !picked.includes(modLabel)) {
    const ceramicDup = picked.some(
      (p) => /ceramic.*sol.*gel|sol.*gel.*ceramic/i.test(p) && /ceramic.*sol.*gel|sol.*gel.*ceramic/i.test(modLabel),
    )
    if (!ceramicDup) picked.push(modLabel)
  }
  if (!picked.length) {
    return finalizeOptions([NONE], 'coatings_finishes_options')
  }
  return finalizeOptions(picked, 'coatings_finishes_options')
}

function mapUseConditions(_evidence, inputs) {
  const auth = [factValue(_evidence, 'product_use_case'), inputs?.normal_intended_use]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  const picked = []
  const templates = getUseConditionTemplatesForScoringCategory(inputs?.product_category_default)

  for (const tpl of templates) {
    if (tpl.match) {
      if (tpl.match.test(auth)) {
        picked.push(tpl.label)
      } else if (tpl.else_label) {
        picked.push(tpl.else_label)
      }
    } else {
      picked.push(tpl.label)
    }
  }

  return finalizeOptions(picked, 'use_conditions_options')
}

function mapDisclosureQuality(inputs, evidence) {
  let badge = String(inputs?.layer_4b?.transparency_badge ?? '').trim()
  const gate1 = evidence?.agent_metadata?.structured_evidence?.transparency_assessment
  if (gate1?.transparency_badge && !gate1.fully_disclosed_eligible) {
    const gate1Badge = String(gate1.transparency_badge).trim()
    const rank = { 'Fully Disclosed': 0, 'Documentation Incomplete': 1, 'Material Uncertain': 2, 'Opaque': 3 }
    const cur = rank[badge] ?? 2
    const g = rank[gate1Badge] ?? 1
    if (g > cur) badge = gate1Badge
  }
  if (/^full\s+disclosed$/i.test(badge)) badge = 'Fully Disclosed'
  if (VOCABULARY.disclosure_quality.includes(badge)) {
    return finalizeOptions([badge], 'disclosure_quality_options')
  }
  return finalizeOptions([], 'disclosure_quality_options')
}

function mapCertifications(evidence, inputs) {
  const rows = evidence?.agent_metadata?.certifications_verified ?? []
  const picked = []
  for (const row of rows) {
    if (!/verified|kept|confirmed|valid/i.test(String(row.action_taken ?? ''))) continue
    const raw = String(row.certification_name ?? '').trim()
    if (!raw || /no third.party|not found|e\.g\.,\s*made safe/i.test(raw.toLowerCase())) continue
    if (!isPacRelevant(raw)) continue

    const label = resolveCertEntry(raw)?.name ?? raw
    if (!picked.includes(label)) picked.push(label)
  }

  const lab =
    inputs?.testing_evidence ?? extractManufacturerPublishedLabTesting(evidence)
  const labOption = formatManufacturerLabTestingCertOption(lab)
  if (labOption && !picked.includes(labOption)) picked.push(labOption)

  const pacCerts = picked.filter(
    (p) => p !== CERT_VERIFICATION_ABSENT && p !== labOption,
  )
  if (!pacCerts.length) {
    const base = [CERT_VERIFICATION_ABSENT]
    if (labOption) base.push(labOption)
    return finalizeOptions(base, 'certifications_options')
  }
  return finalizeOptions(picked, 'certifications_options')
}

/**
 * @param {object} evidence
 * @param {object} inputs
 */
export function buildWhyThisScoreOptions(evidence, inputs) {
  return {
    primary_material_options: mapPrimaryMaterial(evidence, inputs),
    secondary_materials_options: mapSecondaryMaterials(evidence, inputs),
    coatings_finishes_options: mapCoatingsFinishes(evidence, inputs),
    use_conditions_options: mapUseConditions(evidence, inputs),
    disclosure_quality_options: mapDisclosureQuality(inputs, evidence),
    certifications_options: mapCertifications(evidence, inputs),
  }
}

/** @deprecated alias */
export const buildWhyThisScoreFields = buildWhyThisScoreOptions
