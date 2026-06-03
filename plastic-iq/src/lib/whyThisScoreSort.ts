import type { NormalizationComponent } from '../types/agent'
import { isUnknownFoodContactCoatingMaterial } from './materialTaxonomy'
import type { WhyThisScoreFields } from './whyThisScoreApi'
import { whyThisScoreLabelForComponent } from './whyThisScoreLabels'

const PRIMARY_ROLES = new Set(['primary_food_contact', 'formulation'])
const SECONDARY_ROLES = new Set(['handle', 'lid', 'rivet', 'gasket', 'packaging', 'structural'])

export function componentHazard(component: NormalizationComponent): number {
  const h = Number(component.material_hazard)
  return Number.isFinite(h) ? h : 0
}

export function sortComponentsByHazardDesc(
  components: NormalizationComponent[],
): NormalizationComponent[] {
  return [...components].sort((a, b) => componentHazard(b) - componentHazard(a))
}

function labelsFromComponents(
  components: NormalizationComponent[],
  field: 'primary' | 'secondary' | 'coating',
): string[] {
  const picked: string[] = []
  for (const c of sortComponentsByHazardDesc(components)) {
    const role = String(c.component_role ?? c.role ?? '')
    const label = whyThisScoreLabelForComponent(c.material_id, role, field)
    if (label && !picked.includes(label)) picked.push(label)
  }
  return picked
}

function coatingComponents(components: NormalizationComponent[]): NormalizationComponent[] {
  const rows: NormalizationComponent[] = []
  for (const c of components) {
    const role = String(c.component_role ?? c.role ?? '')
    if (role === 'coating') {
      rows.push(c)
    } else if (
      role === 'primary_food_contact' &&
      (isUnknownFoodContactCoatingMaterial(c.material_id) ||
        /^ptfe/i.test(String(c.material_id ?? '')))
    ) {
      rows.push(c)
    }
  }
  return rows
}

/** Primary food-contact labels in hazard-descending order (description / Risk Dashboard rule). */
export function primaryMaterialLabelsFromComponents(
  components: NormalizationComponent[] | null | undefined,
): string[] {
  const rows = (components ?? []).filter((c) =>
    PRIMARY_ROLES.has(String(c.component_role ?? c.role ?? '')),
  )
  return labelsFromComponents(rows, 'primary')
}

function reorderMaterialOptions(stored: string[], hazardOrder: string[]): string[] {
  if (!hazardOrder.length) return stored
  const isNoneOnly = stored.length === 1 && stored[0] === 'None'
  const visible = stored.filter((o) => o !== 'None')
  if (!visible.length && isNoneOnly) {
    return hazardOrder.length ? hazardOrder : stored
  }
  const ordered: string[] = []
  for (const label of hazardOrder) {
    if (visible.includes(label) && !ordered.includes(label)) ordered.push(label)
  }
  for (const label of visible) {
    if (!ordered.includes(label)) ordered.push(label)
  }
  return ordered.length ? ordered : stored
}

/**
 * Reorder stored Why This Score material lists using normalization components.
 * Fixes legacy rows saved in extraction order until Agent 2 re-run.
 */
export function applyHazardSortToWhyThisScoreFields(
  fields: WhyThisScoreFields,
  components: NormalizationComponent[] | null | undefined,
): WhyThisScoreFields {
  if (!components?.length) return fields

  const primaryRows = components.filter((c) =>
    PRIMARY_ROLES.has(String(c.component_role ?? c.role ?? '')),
  )
  const secondaryRows = components.filter((c) =>
    SECONDARY_ROLES.has(String(c.component_role ?? c.role ?? '')),
  )

  return {
    ...fields,
    primary_material_options: reorderMaterialOptions(
      fields.primary_material_options,
      labelsFromComponents(primaryRows, 'primary'),
    ),
    secondary_materials_options: reorderMaterialOptions(
      fields.secondary_materials_options,
      labelsFromComponents(secondaryRows, 'secondary'),
    ),
    coatings_finishes_options: reorderMaterialOptions(
      fields.coatings_finishes_options,
      labelsFromComponents(coatingComponents(components), 'coating'),
    ),
  }
}
