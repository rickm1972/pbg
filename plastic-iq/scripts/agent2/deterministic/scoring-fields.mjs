/**
 * Formulation pathway only — component scoring is taxonomy-lookup.mjs + normalize-enforce.mjs.
 */

function num(v, fallback = 0) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

export function buildFormulationPathway(components, isFormulation) {
  if (!isFormulation) {
    return {
      applicable: false,
      pathway_2_hazard: null,
      pathway_2_migration: null,
      pathway_2_basis: null,
      container_weight: null,
      formulation_weight: null,
      ingredient_transparency_score: null,
      ingredient_transparency_tier: null,
    }
  }
  const form = components.find((c) => c.component_role === 'formulation')
  if (!form) {
    return {
      applicable: false,
      pathway_2_hazard: null,
      pathway_2_migration: null,
      pathway_2_basis: null,
      container_weight: 0.5,
      formulation_weight: 0.5,
      ingredient_transparency_score: null,
      ingredient_transparency_tier: null,
    }
  }
  const hazard = num(form.material_hazard, 0.08)
  const migration = num(form.adjusted_migration_potential, 0.1)
  const its = 100 - hazard * migration * 100
  return {
    applicable: true,
    pathway_2_hazard: hazard,
    pathway_2_migration: migration,
    pathway_2_basis: 'Full ingredient list in approved evidence; Pathway 2 from taxonomy values.',
    container_weight: 0.5,
    formulation_weight: 0.5,
    ingredient_transparency_score: Math.round(its * 10) / 10,
    ingredient_transparency_tier: 'Full ingredient disclosure — deterministic extraction',
  }
}
