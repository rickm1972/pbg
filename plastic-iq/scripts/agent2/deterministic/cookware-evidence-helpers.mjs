/**
 * Cookware evidence guards — global (no tri-ply inference, body role support).
 */
import { getStructuredEvidence } from './schema-input.mjs'

const TRI_PLY_RE =
  /\btri[-\s]?ply\b|\bthree[-\s]?ply\b|\b3[-\s]?ply\b|\bclad\b.*\b(stainless|aluminum)\b/i

/**
 * @param {object} evidence
 */
export function evidenceSupportsTriPlyConstruction(evidence) {
  const s = getStructuredEvidence(evidence)
  const parts = [
    s?.primary_contact_material?.material_identity,
    s?.substrate_material_id?.raw_value,
    ...(s?.secondary_components ?? []).map((c) => c.material_identity),
    ...(s?.coatings_and_finishes ?? []).map((c) => `${c.coating_name} ${c.coating_type}`),
  ]
  for (const f of evidence?.facts ?? []) {
    parts.push(f.fact_value)
  }
  const blob = parts.filter(Boolean).join(' ').toLowerCase()
  return TRI_PLY_RE.test(blob)
}

/**
 * @param {string} materialId
 * @param {string} componentRole — schema component_role
 * @param {string} materialIdentity
 */
export function structuralComponentDisplayName(materialId, componentRole, materialIdentity) {
  const id = String(materialIdentity ?? '').toLowerCase()
  if (materialId === 'aluminum_core') {
    return 'Pan Body — Aluminum core'
  }
  if (materialId === 'stainless_steel_unspecified') {
    if (componentRole === 'handle' || /\bhandle\b/i.test(id)) return 'Handle — Stainless steel'
    if (/induction|magnetic|disc|base plate/i.test(id)) return 'Induction base — Stainless steel'
    if (/exterior|shell|body|tri.ply|clad/i.test(id)) return 'Exterior body — Stainless steel'
    return 'Exterior — Stainless steel'
  }
  return null
}

/**
 * Skip unsupported secondary rows (e.g. Body: stainless with no body evidence).
 * @param {{ component_role: string, material_identity?: string | null }} sec
 */
export function isSecondaryComponentEvidenceSupported(sec) {
  const role = String(sec.component_role ?? '')
  const id = String(sec.material_identity ?? '').toLowerCase()

  if (role === 'handle' || role === 'lid' || role === 'rivet' || role === 'gasket' || role === 'knob') {
    return true
  }
  if (role === 'refill_bottle' || role === 'cap' || role === 'strap' || role === 'brush_bristle') {
    return true
  }
  if (role === 'base' || role === 'magnetic_base') {
    return /base|induction|magnetic|disc/i.test(id) || role === 'magnetic_base'
  }
  if (role === 'body' || role === 'pan_body') {
    if (/handle\b/i.test(id) && !/body|exterior|shell/i.test(id)) return false
    if (/stainless|steel/.test(id)) {
      return /body|exterior|shell|tri.ply|clad|pan body|base plate/i.test(id)
    }
    return true
  }
  if (role === 'other') {
    if (/stainless/.test(id) && !/body|exterior|tri.ply|clad|base/i.test(id)) return false
    return true
  }
  return true
}
