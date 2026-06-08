/**
 * Layer 1 — material families (composable building blocks).
 */

/** @type {Record<string, { id: string, label: string }>} */
export const MATERIAL_FAMILIES = {
  plastics_resins: { id: 'plastics_resins', label: 'Plastics / resins' },
  stainless_steel: { id: 'stainless_steel', label: 'Stainless steel' },
  aluminum: { id: 'aluminum', label: 'Aluminum' },
  cast_iron_carbon_steel: { id: 'cast_iron_carbon_steel', label: 'Cast iron / carbon steel' },
  glass: { id: 'glass', label: 'Glass' },
  ceramic_enamel: { id: 'ceramic_enamel', label: 'Ceramic / enamel' },
  silicone: { id: 'silicone', label: 'Silicone' },
  rubber_elastomers: { id: 'rubber_elastomers', label: 'Rubber / elastomers' },
  textiles: { id: 'textiles', label: 'Textiles / fabrics' },
  coated_metals: { id: 'coated_metals', label: 'Coated metals' },
  paper_cardboard: { id: 'paper_cardboard', label: 'Paper / cardboard' },
  adhesives: { id: 'adhesives', label: 'Adhesives' },
  foams: { id: 'foams', label: 'Foams' },
}

export const MATERIAL_FAMILY_REFS = Object.keys(MATERIAL_FAMILIES)
