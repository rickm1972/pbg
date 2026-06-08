/**
 * Layer 1 — chemical families (composable building blocks).
 */

/** @type {Record<string, { id: string, label: string }>} */
export const CHEMICAL_FAMILIES = {
  pfas: { id: 'pfas', label: 'PFAS / fluorinated compounds' },
  phthalates: { id: 'phthalates', label: 'Phthalates' },
  bisphenols_bpa_bps: { id: 'bisphenols_bpa_bps', label: 'Bisphenols (BPA/BPS)' },
  parabens: { id: 'parabens', label: 'Parabens' },
  styrene: { id: 'styrene', label: 'Styrene / polystyrene' },
  melamine_formaldehyde: { id: 'melamine_formaldehyde', label: 'Melamine / formaldehyde' },
  flame_retardants: { id: 'flame_retardants', label: 'Flame retardants' },
  pvc_vinyl_plasticizers: { id: 'pvc_vinyl_plasticizers', label: 'PVC / vinyl plasticizers' },
  silicone_additives: { id: 'silicone_additives', label: 'Silicone additives' },
  unknown_proprietary_additive: {
    id: 'unknown_proprietary_additive',
    label: 'Unknown proprietary additive',
  },
}

export const CHEMICAL_FAMILY_REFS = Object.keys(CHEMICAL_FAMILIES)
