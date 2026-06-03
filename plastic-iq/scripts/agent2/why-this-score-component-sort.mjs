/**
 * Multi-material Why This Score lists — sort by component material_hazard descending
 * (same rule as product description sentence 1 and Risk Dashboard contact material).
 */

/** @param {object | null | undefined} component */
export function componentHazard(component) {
  const h = Number(component?.material_hazard)
  return Number.isFinite(h) ? h : 0
}

/** @param {object[] | null | undefined} components */
export function sortComponentsByHazardDesc(components) {
  return [...(components ?? [])].sort((a, b) => componentHazard(b) - componentHazard(a))
}
