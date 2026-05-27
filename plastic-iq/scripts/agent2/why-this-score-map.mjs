/**
 * Why This Score options — one vocabulary label per row in scoring_inputs.components only.
 * Evidence prose and taxonomy *Options arrays are not used (prevents phantom dropdown values).
 */

import { isPacRelevant, resolveCertEntry } from '../../src/shared/certification-taxonomy.mjs'
import { isUnknownFoodContactCoatingMaterial } from './deterministic/material-taxonomy.mjs'
import { whyThisScoreLabelForComponent } from './why-this-score-labels.mjs'
import { finalizeOptions, NONE, VOCABULARY } from './why-this-score-vocabulary.mjs'
import { factValue } from './deterministic/evidence-facts.mjs'

const PRIMARY_ROLES = new Set(['primary_food_contact', 'formulation'])
const SECONDARY_ROLES = new Set(['handle', 'lid', 'rivet', 'gasket', 'packaging', 'structural'])

function labelsFromComponents(components, field) {
  const picked = []
  for (const c of components ?? []) {
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

function mapSecondaryMaterials(_evidence, inputs) {
  const components = (inputs?.components ?? []).filter((c) =>
    SECONDARY_ROLES.has(c.component_role ?? c.role),
  )
  const picked = labelsFromComponents(components, 'secondary')
  if (!picked.length) {
    return finalizeOptions([NONE], 'secondary_materials_options')
  }
  return finalizeOptions(picked, 'secondary_materials_options')
}

function mapCoatingsFinishes(_evidence, inputs) {
  const picked = []
  for (const c of inputs?.components ?? []) {
    const role = c.component_role ?? c.role
    if (role === 'coating') {
      const label = whyThisScoreLabelForComponent(c.material_id, role, 'coating')
      if (label && !picked.includes(label)) picked.push(label)
    } else if (
      role === 'primary_food_contact' &&
      (isUnknownFoodContactCoatingMaterial(c.material_id) ||
        /^ptfe/i.test(String(c.material_id ?? '')))
    ) {
      const label = whyThisScoreLabelForComponent(c.material_id, role, 'coating')
      if (label && !picked.includes(label)) picked.push(label)
    }
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

  if (
    inputs?.is_formulation_product ||
    inputs?.product_category_default === 'rinse-off' ||
    /rinse.off|dish soap|dishwashing|handwash|hand wash|hand dish|cleaning concentrate/.test(auth)
  ) {
    picked.push('Brief rinse-off contact')
  } else if (/water bottle|travel mug|drinkware|beverage|sippy/.test(auth)) {
    picked.push('Direct oral contact during drinking')
  } else if (/utensil set|kitchen utensil|spatula|ladle|tongs/.test(auth)) {
    picked.push('Direct food handling (utensils)')
  } else if (/food storage|meal prep/.test(auth)) {
    picked.push(/hot|heated|microwave/.test(auth) ? 'Hot food storage' : 'Cold food storage')
  } else if (/cookware|frying pan|skillet|stovetop|sauté|saute|grill/.test(auth)) {
    if (/oven|broil|bake|roast/.test(auth)) picked.push('Oven heat with fat exposure')
    if (/acid|tomato|vinegar|citrus/.test(auth)) picked.push('Stovetop heat with acid exposure')
    picked.push('Stovetop heat with fat exposure')
  } else if (/leave.on|lotion|moisturizer|skincare/.test(auth)) {
    picked.push('Skin contact leave-on')
  } else if (/hand contact only|handle only/.test(auth)) {
    picked.push('Hand contact only')
  }

  return finalizeOptions(picked, 'use_conditions_options')
}

function mapDisclosureQuality(inputs) {
  const badge = String(inputs?.layer_4b?.transparency_badge ?? '').trim()
  if (VOCABULARY.disclosure_quality.includes(badge)) {
    return finalizeOptions([badge], 'disclosure_quality_options')
  }
  return finalizeOptions([], 'disclosure_quality_options')
}

function mapCertifications(evidence) {
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
  if (!picked.length) {
    return finalizeOptions(['Third-party verification absent'], 'certifications_options')
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
    disclosure_quality_options: mapDisclosureQuality(inputs),
    certifications_options: mapCertifications(evidence),
  }
}

/** @deprecated alias */
export const buildWhyThisScoreFields = buildWhyThisScoreOptions
